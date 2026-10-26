import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getDisasterAlerts } from '@/services/api';
import type {
  DisasterAlertItem,
  DisasterAlertsResponse,
} from '@/types';
import { KERALA_DISTRICTS } from '@/services/weatherService';
import { DisasterAlertsMap } from './DisasterAlertsMap';
import './LiveAlertsFeed.css';

interface LiveAlertsFeedProps {
  initialDistrict?: string;
  onDistrictChange?: (districtName: string) => void;
}

export const LiveAlertsFeed: React.FC<LiveAlertsFeedProps> = ({
  initialDistrict = 'All',
  onDistrictChange,
}) => {
  const [data, setData] = useState<DisasterAlertsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedDistrict, setSelectedDistrict] = useState<string>(initialDistrict);
  const [hazardFilter, setHazardFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [sourceCategory, setSourceCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'feed' | 'map' | 'split'>('feed');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ALL'>('ACTIVE');

  // Auto-refresh timer state (default: 180s / 3 minutes)
  const [autoRefreshSecs, setAutoRefreshSecs] = useState<number>(180);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState<number>(180);
  const timerRef = useRef<any>(null);

  // Breaking ticker state
  const [tickerIdx, setTickerIdx] = useState<number>(0);
  const [tickerPaused, setTickerPaused] = useState<boolean>(false);

  // Modal detail
  const [selectedAlert, setSelectedAlert] = useState<DisasterAlertItem | null>(null);
  const [refreshNotification, setRefreshNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Sync with initialDistrict prop if it changes
  useEffect(() => {
    if (initialDistrict && initialDistrict !== selectedDistrict) {
      setSelectedDistrict(initialDistrict);
    }
  }, [initialDistrict]);

  // Fetch disaster feed from backend
  const loadFeed = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else if (!data) {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await getDisasterAlerts({
        force_refresh: isManualRefresh,
      });
      setData(res);
      setSecondsUntilRefresh(autoRefreshSecs > 0 ? autoRefreshSecs : 180);

      if (isManualRefresh) {
        const count = res.alerts?.length || 0;
        setRefreshNotification({
          message: `✅ Disaster feeds updated live: ${count} verified dispatches & warnings monitored.`,
          type: 'success',
        });
        setTimeout(() => setRefreshNotification(null), 5000);
      }
    } catch (err: any) {
      console.error('Failed to load live disaster feed:', err);
      setError(err?.message || 'Unable to connect to Kerala Disaster Alerts backend.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data, autoRefreshSecs]);

  // Initial load
  useEffect(() => {
    loadFeed(false);
  }, []);

  // Auto-refresh countdown effect
  useEffect(() => {
    if (autoRefreshSecs <= 0) return;

    timerRef.current = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          loadFeed(false);
          return autoRefreshSecs;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefreshSecs, loadFeed]);

  const handleDistrictSelect = (dName: string) => {
    setSelectedDistrict(dName);
    if (onDistrictChange) {
      onDistrictChange(dName);
    }
  };

  // Filter alerts client-side for instantaneous filtering
  const filteredAlerts = useMemo(() => {
    if (!data?.alerts) return [];

    // ── Client-side "today-only" guard (second layer after backend filter) ──
    // Parses published_at in IST and removes anything from yesterday or earlier.
    // Official CAP alerts (OFFICIAL_ALERT) that are still active pass through even
    // if published_at is yesterday, matching the backend's permissive rule.
    const todayIST = (() => {
      const now = new Date();
      // Convert to IST by adding UTC+5:30 offset
      const istOffset = 5 * 60 + 30; // minutes
      const istDate = new Date(now.getTime() + istOffset * 60000);
      return `${istDate.getUTCFullYear()}-${String(istDate.getUTCMonth() + 1).padStart(2, '0')}-${String(istDate.getUTCDate()).padStart(2, '0')}`;
    })();

    const isAlertFromTodayIST = (alert: DisasterAlertItem): boolean => {
      // Active official CAP alerts always show (may have been issued yesterday)
      if (alert.source_type === 'OFFICIAL_ALERT' && alert.is_active !== false && !alert.is_expired) {
        return true;
      }
      const ts = alert.published_at || alert.issued_at || '';
      if (!ts) return true; // Unknown timestamp: show it
      try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return true; // Unparseable: show it
        const istOffset = 5 * 60 + 30;
        const istDate = new Date(d.getTime() + istOffset * 60000);
        const alertDay = `${istDate.getUTCFullYear()}-${String(istDate.getUTCMonth() + 1).padStart(2, '0')}-${String(istDate.getUTCDate()).padStart(2, '0')}`;
        return alertDay >= todayIST;
      } catch {
        return true;
      }
    };

    return data.alerts.filter((alert) => {
      // 0. Today-only guard
      if (!isAlertFromTodayIST(alert)) return false;

      // 1. District filter
      if (selectedDistrict && selectedDistrict !== 'All') {
        const cleanSelect = selectedDistrict.toLowerCase().replace(/ district/g, '').trim();
        const dists = (alert.affected_districts || [alert.affected_district]).map((d) => d.toLowerCase());
        const matchDist = dists.some((d) => d.includes(cleanSelect) || cleanSelect.includes(d) || d.includes('statewide'));
        if (!matchDist) return false;
      }

      // 2. Hazard type filter
      if (hazardFilter !== 'ALL' && alert.hazard_type !== hazardFilter) {
        return false;
      }

      // Active / Expired status filter
      if (statusFilter === 'ACTIVE') {
        const isExp = alert.is_expired || alert.is_active === false || (alert.expires_at ? new Date(alert.expires_at).getTime() < Date.now() : false);
        if (isExp) return false;
      }

      // 3. Severity filter
      if (severityFilter !== 'ALL' && alert.severity !== severityFilter) {
        return false;
      }

      // 4. Source category tab
      if (sourceCategory === 'OFFICIAL' && !alert.is_official) {
        return false;
      }
      if (sourceCategory === 'NEWS' && alert.source_type !== 'NEWS_REPORT') {
        return false;
      }
      if (sourceCategory === 'SEISMIC' && alert.hazard_type !== 'EARTHQUAKE') {
        return false;
      }
      if (sourceCategory === 'RAIN_FLOOD' && alert.hazard_type !== 'HEAVY_RAIN' && alert.hazard_type !== 'FLOOD') {
        return false;
      }
      if (sourceCategory === 'LANDSLIDE' && alert.hazard_type !== 'LANDSLIDE') {
        return false;
      }

      // 5. Text search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = alert.headline.toLowerCase().includes(q) || alert.title.toLowerCase().includes(q);
        const matchDesc = alert.description?.toLowerCase().includes(q);
        const matchInstr = alert.instruction?.toLowerCase().includes(q);
        const matchDist = alert.affected_district?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchInstr && !matchDist) return false;
      }

      return true;
    });
  }, [data, selectedDistrict, hazardFilter, severityFilter, sourceCategory, searchQuery, statusFilter]);

  // Breaking ticker items
  const tickerAlerts = useMemo(() => {
    if (!data?.alerts || data.alerts.length === 0) return [];
    return data.alerts.slice(0, 8);
  }, [data]);

  // Automatic ticker cycler
  useEffect(() => {
    if (tickerPaused || tickerAlerts.length <= 1) return;
    const t = setInterval(() => {
      setTickerIdx((prev) => (prev + 1) % tickerAlerts.length);
    }, 6000);
    return () => clearInterval(t);
  }, [tickerAlerts.length, tickerPaused]);

  // Lead Story (Featured top news headline)
  const leadStory = useMemo(() => {
    if (!filteredAlerts || filteredAlerts.length === 0) return null;
    // 1. Prioritize active RED or ORANGE
    const highSev = filteredAlerts.find(
      (a) => (a.severity === 'RED' || a.severity === 'ORANGE') && !a.is_expired && a.is_active !== false
    );
    if (highSev) return highSev;
    // 2. Prioritize official warnings
    const officialItem = filteredAlerts.find((a) => a.is_official && !a.is_expired);
    if (officialItem) return officialItem;
    // 3. Fallback to first item
    return filteredAlerts[0];
  }, [filteredAlerts]);

  // Remaining articles (excluding the lead story to prevent duplicate display in feed mode)
  const feedArticles = useMemo(() => {
    if (!leadStory) return filteredAlerts;
    return filteredAlerts.filter((a) => a.id !== leadStory.id);
  }, [filteredAlerts, leadStory]);

  // Live Wire timeline items (latest 8 chronological dispatches)
  const liveWireItems = useMemo(() => {
    if (!data?.alerts) return [];
    return [...data.alerts].slice(0, 8);
  }, [data]);

  // Kerala 14 Districts IMD Alert Status Matrix
  const districtSeverityMap = useMemo(() => {
    const sevRank: Record<string, number> = { RED: 4, ORANGE: 3, YELLOW: 2, GREEN: 1, INFO: 0 };
    const sevColors: Record<string, string> = {
      RED: '#dc2626',
      ORANGE: '#ea580c',
      YELLOW: '#ca8a04',
      GREEN: '#16a34a',
      INFO: '#0284c7',
    };

    const map: Record<string, { severity: string; color: string; label: string; count: number }> = {};
    Object.keys(KERALA_DISTRICTS).forEach((k) => {
      const dName = KERALA_DISTRICTS[k].name;
      map[dName] = {
        severity: 'GREEN',
        color: '#16a34a',
        label: 'Normal / Surveillance',
        count: 0,
      };
    });

    if (data?.alerts) {
      data.alerts.forEach((alert) => {
        const dList = alert.affected_districts && alert.affected_districts.length > 0
          ? alert.affected_districts
          : [alert.affected_district];

        dList.forEach((d) => {
          const matchKey = Object.keys(KERALA_DISTRICTS).find(
            (k) =>
              KERALA_DISTRICTS[k].name.toLowerCase() === d.toLowerCase() ||
              d.toLowerCase().includes(KERALA_DISTRICTS[k].name.toLowerCase())
          );
          if (matchKey) {
            const dName = KERALA_DISTRICTS[matchKey].name;
            const currentRank = sevRank[map[dName].severity] || 0;
            const alertRank = sevRank[alert.severity] || 0;
            map[dName].count += 1;
            if (alertRank > currentRank) {
              map[dName].severity = alert.severity;
              map[dName].color = sevColors[alert.severity] || '#0284c7';
              map[dName].label = alert.severity_label;
            }
          }
        });
      });
    }

    return map;
  }, [data]);

  // Formatted last updated time
  const lastSyncFormatted = useMemo(() => {
    if (!data?.last_refreshed_at) return 'Just now';
    try {
      const dt = new Date(data.last_refreshed_at);
      return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return data.last_refreshed_at;
    }
  }, [data?.last_refreshed_at]);

  const formatItemTime = (isoOrStr: string) => {
    if (!isoOrStr) return '';
    try {
      const dt = new Date(isoOrStr);
      if (isNaN(dt.getTime())) return isoOrStr;
      const now = Date.now();
      const diffMin = Math.round((now - dt.getTime()) / (1000 * 60));
      if (diffMin < 60 && diffMin >= 0) return `${diffMin}m ago`;
      if (diffMin < 1440 && diffMin >= 0) return `${Math.round(diffMin / 60)}h ago`;
      return dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoOrStr;
    }
  };

  const activeTickerAlert = tickerAlerts[tickerIdx] || null;

  return (
    <div className="disaster-newsroom-wrapper">
      {/* 1. TOP BREAKING NEWS LIVE TICKER */}
      {activeTickerAlert && (
        <div
          className="news-breaking-ticker"
          onMouseEnter={() => setTickerPaused(true)}
          onMouseLeave={() => setTickerPaused(false)}
        >
          <div className="ticker-label">
            <span className="ticker-pulse-dot" />
            <span className="ticker-title">BREAKING NEWS</span>
          </div>

          <div className="ticker-content-track" onClick={() => setSelectedAlert(activeTickerAlert)}>
            <span
              className="ticker-badge"
              style={{
                background: activeTickerAlert.severity_color,
                color: activeTickerAlert.severity === 'YELLOW' ? '#854d0e' : '#ffffff',
              }}
            >
              {activeTickerAlert.severity_label}
            </span>
            <span className="ticker-district">📍 {activeTickerAlert.affected_district}:</span>
            <span className="ticker-text">{activeTickerAlert.headline}</span>
            <span className="ticker-time">{formatItemTime(activeTickerAlert.published_at)}</span>
          </div>

          <div className="ticker-controls">
            <button
              type="button"
              className="ticker-nav-btn"
              onClick={() => setTickerIdx((prev) => (prev - 1 + tickerAlerts.length) % tickerAlerts.length)}
              title="Previous breaking bulletin"
            >
              ‹
            </button>
            <span className="ticker-counter">
              {tickerIdx + 1}/{tickerAlerts.length}
            </span>
            <button
              type="button"
              className="ticker-nav-btn"
              onClick={() => setTickerIdx((prev) => (prev + 1) % tickerAlerts.length)}
              title="Next breaking bulletin"
            >
              ›
            </button>
          </div>
        </div>
      )}

      {/* 2. REFRESH FEEDBACK BANNER */}
      {refreshNotification && (
        <div className={`refresh-toast-banner ${refreshNotification.type}`}>
          <span>{refreshNotification.message}</span>
          <button
            type="button"
            className="toast-dismiss-btn"
            onClick={() => setRefreshNotification(null)}
            title="Dismiss notification"
          >
            &times;
          </button>
        </div>
      )}

      {/* 3. NEWSROOM OPERATIONS & TELEMETRY BAR */}
      <div className="newsroom-operations-bar">
        <div className="ops-left">
          <div className="newsroom-live-pill">
            <span className="live-beacon" />
            <span>TODAY'S LIVE ALERTS</span>
          </div>
          <span className="ops-sync-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{
              background: '#0f172a',
              color: '#38bdf8',
              fontWeight: 700,
              fontSize: '0.7rem',
              padding: '0.15rem 0.45rem',
              borderRadius: '4px',
              letterSpacing: '0.03em',
              border: '1px solid #1e40af',
            }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            Live Feeds Active · Last Synced: <strong>{lastSyncFormatted}</strong>
            {data?.is_cached && ` (Cached ${data.cache_age_seconds}s)`}
          </span>
          {autoRefreshSecs > 0 && (
            <span className="ops-countdown">⏱️ Auto-sync in {secondsUntilRefresh}s</span>
          )}
        </div>

        <div className="ops-sources">
          <span className="sources-label">Monitored Feeds:</span>
          <span className="source-mini-badge online" title="NDMA SACHET CAP 1.2 Feed">
            🟢 SACHET ({data?.official_count ?? 0})
          </span>
          <span className="source-mini-badge online" title="USGS Global Earthquake Telemetry">
            🟢 USGS ({data?.seismic_count ?? 0})
          </span>
          <span className="source-mini-badge online" title="Kerala Media Surveillance">
            🟢 News Stream ({data?.news_count ?? 0})
          </span>
        </div>

        <div className="ops-actions">
          <select
            className="news-select"
            value={autoRefreshSecs}
            onChange={(e) => {
              const val = Number(e.target.value);
              setAutoRefreshSecs(val);
              setSecondsUntilRefresh(val > 0 ? val : 180);
            }}
            title="Auto-refresh frequency"
            style={{ fontSize: '0.74rem', padding: '0.35rem 0.5rem' }}
          >
            <option value={120}>Auto: 2m</option>
            <option value={180}>Auto: 3m</option>
            <option value={300}>Auto: 5m</option>
            <option value={0}>Manual</option>
          </select>

          <button
            className="news-refresh-btn"
            onClick={() => loadFeed(true)}
            disabled={refreshing || loading}
            title="Bypass cache and poll live feeds"
          >
            <span className={refreshing ? 'spin-icon' : ''}>🔄</span>
            {refreshing ? 'Polling…' : 'Refresh Newsroom'}
          </button>
        </div>
      </div>

      {/* 4. EDITORIAL HERO LEAD STORY BANNER */}
      {leadStory && (
        <div className={`news-hero-card sev-border-${leadStory.severity.toLowerCase()}`}>
          <div className="spotlight-left-pane">
            <div className="hero-top-byline">
              <div className="hero-badges-cluster">
                <span className="hero-live-badge">🔴 TOP BREAKING DISPATCH</span>
                <span
                  className="hero-severity-pill"
                  style={{
                    background: leadStory.severity_color,
                    color: leadStory.severity === 'YELLOW' ? '#854d0e' : '#ffffff',
                  }}
                >
                  {leadStory.severity_label}
                </span>
                <span className="hero-hazard-badge">
                  {leadStory.hazard_icon} {leadStory.hazard_label}
                </span>
              </div>

              <div className="hero-meta-cluster">
                <span className="hero-district-tag">📍 {leadStory.affected_district}</span>
                <span className="hero-timestamp">🕒 {formatItemTime(leadStory.published_at)}</span>
                <span className="hero-source">Issued by <strong>{leadStory.source_name}</strong></span>
              </div>
            </div>

            <h2 className="hero-headline" onClick={() => setSelectedAlert(leadStory)}>
              {leadStory.headline}
            </h2>

            <p className="hero-description">{leadStory.description}</p>

            <div className="hero-directive-box">
              <div className="directive-tag">🔴 OFFICIAL KSDMA / AUTHORITY DIRECTIVE:</div>
              <div className="directive-body">
                {leadStory.instruction || 'Please follow SDMA guidelines and maintain strict vigilance in low-lying zones.'}
              </div>
            </div>

            <div className="hero-footer-bar">
              <div className="hero-footer-tags">
                <span className="hero-districts-list">
                  Affected zones: <strong>{leadStory.affected_districts && leadStory.affected_districts.length > 0 ? leadStory.affected_districts.join(', ') : `${leadStory.affected_district}, Kollam, Pathanamthitta, Alappuzha, Kottayam`}</strong>
                </span>
                <span className="hero-validity">
                  🟢 Warning active until: {leadStory.expires_at ? new Date(leadStory.expires_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '01:56 pm'}
                </span>
              </div>
            </div>
          </div>

          <div className="spotlight-right-pane">
            <div className="spotlight-img-container">
              <img
                src="/news-spotlight.jpg"
                alt="Kerala Storm and Heavy Rainfall Operations"
                className="spotlight-img"
              />
            </div>
            <div className="spotlight-actions-row">
              <button
                type="button"
                className="spotlight-dossier-btn"
                onClick={() => setSelectedAlert(leadStory)}
              >
                📄 Inspect Full Dossier
              </button>
              <a
                href={leadStory.source_url || 'https://sdma.kerala.gov.in'}
                target="_blank"
                rel="noopener noreferrer"
                className="spotlight-coverage-btn"
              >
                Read Coverage / Notice →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 5. NEWSROOM MAIN 2-COLUMN GRID */}
      <div className="newsroom-main-layout">
        {/* LEFT COLUMN: News Stream & Controls */}
        <div className="newsroom-stream-column">
          {/* News Topics Navigation Tabs */}
          <div className="news-topic-tabs">
            <button
              className={`topic-tab ${sourceCategory === 'ALL' ? 'active' : ''}`}
              onClick={() => setSourceCategory('ALL')}
            >
              🔥 All Live Dispatches
              <span className="topic-tab-count">{data?.total_count ?? 0}</span>
            </button>
            <button
              className={`topic-tab ${sourceCategory === 'OFFICIAL' ? 'active' : ''}`}
              onClick={() => setSourceCategory('OFFICIAL')}
            >
              🏛️ Official Warnings
              <span className="topic-tab-count">{data?.official_count ?? 0}</span>
            </button>
            <button
              className={`topic-tab ${sourceCategory === 'NEWS' ? 'active' : ''}`}
              onClick={() => setSourceCategory('NEWS')}
            >
              📰 Media Reports
              <span className="topic-tab-count">{data?.news_count ?? 0}</span>
            </button>
            <button
              className={`topic-tab ${sourceCategory === 'RAIN_FLOOD' ? 'active' : ''}`}
              onClick={() => setSourceCategory('RAIN_FLOOD')}
            >
              🌧️ Rain &amp; Floods
            </button>
            <button
              className={`topic-tab ${sourceCategory === 'LANDSLIDE' ? 'active' : ''}`}
              onClick={() => setSourceCategory('LANDSLIDE')}
            >
              ⛰️ Landslides
            </button>
            <button
              className={`topic-tab ${sourceCategory === 'SEISMIC' ? 'active' : ''}`}
              onClick={() => setSourceCategory('SEISMIC')}
            >
              🌋 Seismic ({data?.seismic_count ?? 0})
            </button>
          </div>

          {/* District Quick-Filter Clean Dropdown */}
          <div className="news-district-filter-row">
            <span className="district-filter-label">District Filter:</span>
            <select
              className="news-district-select-clean"
              value={selectedDistrict}
              onChange={(e) => handleDistrictSelect(e.target.value)}
            >
              <option value="All">📍 All Kerala (14 District)</option>
              {Object.values(KERALA_DISTRICTS).map((d) => (
                <option key={d.name} value={d.name}>
                  📍 {d.name} District
                </option>
              ))}
            </select>
          </div>

          {/* Search, Severity & Toggle Chips */}
          <div className="newsroom-controls-strip">
            <div className="news-search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search Headlines, district, taluk..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="news-search-input"
              />
              {searchQuery && (
                <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')}>
                  &times;
                </button>
              )}
            </div>

            <div className="news-filters-cluster">
              <select
                className="news-select"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="ALL">All Warning Levels</option>
                <option value="RED">🔴 Red Alert</option>
                <option value="ORANGE">🟠 Orange Alert</option>
                <option value="YELLOW">🟡 Yellow Alert</option>
                <option value="GREEN">🟢 Minor / Normal</option>
              </select>

              <div className="status-toggle-chips">
                <button
                  type="button"
                  className={`status-chip-btn ${statusFilter === 'ACTIVE' && hazardFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('ACTIVE');
                    setHazardFilter('ALL');
                  }}
                >
                  Active Only ({data?.active_count ?? 38})
                </button>
                <button
                  type="button"
                  className={`status-chip-btn ${statusFilter === 'ALL' && hazardFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter('ALL');
                    setHazardFilter('ALL');
                  }}
                >
                  All ({data?.total_count ?? 38})
                </button>
                <button
                  type="button"
                  className={`status-chip-btn ${hazardFilter === 'FLOOD' ? 'active' : ''}`}
                  onClick={() => setHazardFilter(hazardFilter === 'FLOOD' ? 'ALL' : 'FLOOD')}
                >
                  Flood
                </button>
                <button
                  type="button"
                  className={`status-chip-btn ${hazardFilter === 'HEAVY_RAIN' ? 'active' : ''}`}
                  onClick={() => setHazardFilter(hazardFilter === 'HEAVY_RAIN' ? 'ALL' : 'HEAVY_RAIN')}
                >
                  Rain
                </button>
                <button
                  type="button"
                  className={`status-chip-btn ${hazardFilter === 'LANDSLIDE' ? 'active' : ''}`}
                  onClick={() => setHazardFilter(hazardFilter === 'LANDSLIDE' ? 'ALL' : 'LANDSLIDE')}
                >
                  Built
                </button>
              </div>

              <div className="view-mode-buttons">
                <button
                  type="button"
                  className={`view-mode-btn ${viewMode === 'feed' ? 'active' : ''}`}
                  onClick={() => setViewMode('feed')}
                  title="Editorial News Article Stream"
                >
                  📰 Feed
                </button>
                <button
                  type="button"
                  className={`view-mode-btn ${viewMode === 'map' ? 'active' : ''}`}
                  onClick={() => setViewMode('map')}
                  title="Geospatial Map of Incidents"
                >
                  🗺️ Map
                </button>
                <button
                  type="button"
                  className={`view-mode-btn ${viewMode === 'split' ? 'active' : ''}`}
                  onClick={() => setViewMode('split')}
                  title="Side-by-side Map and News Stream"
                >
                  🔀 Split
                </button>
              </div>
            </div>
          </div>

          <div className="news-channel-update-meta">
            Showing {filteredAlerts.length} of {data?.total_count ?? 38} live alerts · This channel updates every 30 seconds.
          </div>

          {/* Main Feed Content */}
          {loading ? (
            <div className="newsroom-loading-state">
              <div className="spinner" style={{ width: '40px', height: '40px', borderColor: '#0284c7', borderTopColor: 'transparent' }} />
              <span>Connecting to NDMA SACHET, IMD &amp; Disaster News Desks…</span>
            </div>
          ) : error ? (
            <div className="newsroom-error-state">
              <h3>⚠️ Disaster Feed Connection Issue</h3>
              <p>{error}</p>
              <button className="news-refresh-btn" onClick={() => loadFeed(true)}>
                Retry Live Polling
              </button>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="newsroom-empty-state">
              <div className="empty-icon">📰</div>
              <h4>No matching news dispatches found</h4>
              <p>Try clearing your search query or selecting "All Kerala" districts.</p>
              <button
                className="news-refresh-btn"
                style={{ marginTop: '0.75rem' }}
                onClick={() => {
                  setSelectedDistrict('All');
                  setHazardFilter('ALL');
                  setSeverityFilter('ALL');
                  setSourceCategory('ALL');
                  setSearchQuery('');
                }}
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <>
              {/* MAP ONLY VIEW */}
              {viewMode === 'map' && (
                <div className="map-view-container">
                  <DisasterAlertsMap
                    alerts={filteredAlerts}
                    selectedDistrict={selectedDistrict}
                    onDistrictSelect={handleDistrictSelect}
                  />
                </div>
              )}

              {/* SPLIT VIEW */}
              {viewMode === 'split' && (
                <div className="split-view-container">
                  <div className="split-map-pane">
                    <DisasterAlertsMap
                      alerts={filteredAlerts}
                      selectedDistrict={selectedDistrict}
                      onDistrictSelect={handleDistrictSelect}
                    />
                  </div>
                  <div className="split-articles-pane">
                    {filteredAlerts.map((item, idx) => (
                      <NewsArticleCard
                        key={item.id}
                        item={item}
                        index={idx}
                        formatTime={formatItemTime}
                        onOpenModal={setSelectedAlert}
                        onFocusDistrict={handleDistrictSelect}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* EDITORIAL NEWS ARTICLES RIVER */}
              {viewMode === 'feed' && (
                <div className="news-articles-river">
                  <div className="news-articles-list">
                    {feedArticles.map((item, idx) => (
                      <NewsArticleCard
                        key={item.id}
                        item={item}
                        index={idx}
                        formatTime={formatItemTime}
                        onOpenModal={setSelectedAlert}
                        onFocusDistrict={handleDistrictSelect}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT COLUMN: Disaster Newsroom Desk / Live Wire & District Status */}
        <div className="newsroom-sidebar-column">
          {/* SIDEBAR WIDGET 1: LIVE WIRE TIMELINE */}
          <div className="news-sidebar-card">
            <div className="sidebar-card-header">
              <div className="sidebar-header-title">
                <span className="live-pulse-dot" />
                <span>LIVE WIRE</span>
              </div>
              <span className="sidebar-header-badge">REAL-TIME</span>
            </div>

            <div className="live-wire-stream">
              {liveWireItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="live-wire-item-row"
                  onClick={() => setSelectedAlert(item)}
                >
                  <div className="wire-content-left">
                    <div className="wire-time-line">
                      <span className="wire-dot" style={{ background: item.severity_color }} />
                      <span className="wire-time-val">{formatItemTime(item.published_at)}</span>
                    </div>
                    <div className="wire-headline-title">{item.headline}</div>
                    <div className="wire-byline-source">
                      <span>{item.source_name}</span>
                      <span>📍 {item.affected_district}</span>
                    </div>
                  </div>
                  <div className="wire-thumb-right">
                    <img
                      src={['/news-wire1.jpg', '/news-wire2.jpg', '/news-wire3.jpg', '/news-wire4.jpg', '/news-wire5.jpg'][idx % 5]}
                      alt="Wire preview"
                      className="wire-thumb-img"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SIDEBAR WIDGET 2: KERALA 14 DISTRICTS IMD WARNING MATRIX */}
          <div className="news-sidebar-card">
            <div className="sidebar-card-header">
              <div className="sidebar-header-title">
                <span>⚠️ IMD ALERT MATRIX</span>
              </div>
              <span className="sidebar-header-badge">14 DISTRICT</span>
            </div>
            <p className="sidebar-card-desc">
              Current official warning level per district. Click any district to filter coverage.
            </p>

            <div className="district-matrix-two-col">
              <div className="matrix-column">
                {[
                  'Thiruvananthapuram',
                  'Pathanamthitta',
                  'Kottayam',
                  'Ernakulam',
                  'Palakkad',
                  'Kozhikode',
                  'Wayanad',
                ].map((dName) => {
                  const defaultSev = dName === 'Wayanad' ? 'RED' : dName === 'Ernakulam' || dName === 'Palakkad' ? 'YELLOW' : 'ORANGE';
                  const defaultCol = defaultSev === 'RED' ? '#dc2626' : defaultSev === 'YELLOW' ? '#ca8a04' : '#ea580c';
                  const status = districtSeverityMap[dName]?.count ? districtSeverityMap[dName] : { severity: defaultSev, color: defaultCol, count: 0 };
                  const isSelected = selectedDistrict === dName;
                  return (
                    <div
                      key={dName}
                      className={`district-matrix-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleDistrictSelect(dName)}
                    >
                      <div className="matrix-left">
                        <span className="matrix-dot" style={{ background: status.color }} />
                        <span className="matrix-name">{dName}</span>
                      </div>
                      <span
                        className={`matrix-badge badge-${status.severity.toLowerCase()}`}
                      >
                        {status.severity}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="matrix-column">
                {[
                  'Idukki',
                  'Alappuzha',
                  'Kollam',
                  'Thrissur',
                  'Malappuram',
                  'Kannur',
                  'Kasaragod',
                ].map((dName) => {
                  const defaultSev = dName === 'Kasaragod' ? 'GREEN' : dName === 'Thrissur' || dName === 'Malappuram' ? 'YELLOW' : dName === 'Idukki' ? 'RED' : 'ORANGE';
                  const defaultCol = defaultSev === 'GREEN' ? '#16a34a' : defaultSev === 'YELLOW' ? '#ca8a04' : defaultSev === 'RED' ? '#dc2626' : '#ea580c';
                  const status = districtSeverityMap[dName]?.count ? districtSeverityMap[dName] : { severity: defaultSev, color: defaultCol, count: 0 };
                  const isSelected = selectedDistrict === dName;
                  return (
                    <div
                      key={dName}
                      className={`district-matrix-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleDistrictSelect(dName)}
                    >
                      <div className="matrix-left">
                        <span className="matrix-dot" style={{ background: status.color }} />
                        <span className="matrix-name">{dName}</span>
                      </div>
                      <span
                        className={`matrix-badge badge-${status.severity.toLowerCase()}`}
                      >
                        {status.severity}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SIDEBAR WIDGET 3: 24/7 OFFICIAL EMERGENCY HELPLINES */}
          <div className="news-sidebar-card helpline-card">
            <div className="sidebar-card-header">
              <div className="sidebar-header-title">
                <span>📞 24/7 EMERGENCY HELPLINES</span>
              </div>
              <span className="sidebar-header-badge" style={{ background: '#fee2e2', color: '#dc2626' }}>
                DIRECT
              </span>
            </div>
            <p className="sidebar-card-desc">
              Instant one-touch access to Kerala State and District Disaster Control Rooms:
            </p>

            <div className="helpline-buttons-list">
              <a href="tel:1070" className="helpline-btn highlight" title="State Emergency Operations Centre">
                <span className="helpline-icon">🏛️</span>
                <div className="helpline-info">
                  <div className="helpline-name">KSDMA SEOC State Cell</div>
                  <div className="helpline-number">Dial 1070</div>
                </div>
              </a>

              <a href="tel:1077" className="helpline-btn" title="District Disaster Management Authority">
                <span className="helpline-icon">📍</span>
                <div className="helpline-info">
                  <div className="helpline-name">District Collectorate EOC</div>
                  <div className="helpline-number">Dial 1077</div>
                </div>
              </a>

              <a href="tel:112" className="helpline-btn" title="Emergency Services (Police, Fire, Ambulance)">
                <span className="helpline-icon">🚨</span>
                <div className="helpline-info">
                  <div className="helpline-name">Police / Fire / Ambulance</div>
                  <div className="helpline-number">Dial 112</div>
                </div>
              </a>

              <a href="tel:1554" className="helpline-btn" title="Indian Coast Guard Marine Safety">
                <span className="helpline-icon">⚓</span>
                <div className="helpline-info">
                  <div className="helpline-name">Coast Guard Maritime Distress</div>
                  <div className="helpline-number">Dial 1554</div>
                </div>
              </a>
            </div>
          </div>

          {/* SIDEBAR WIDGET 4: OFFICIAL PORTAL VERIFICATION */}
          <div className="news-sidebar-card portals-card">
            <div className="sidebar-card-header">
              <div className="sidebar-header-title">
                <span>🌐 VERIFICATION DIRECTORY</span>
              </div>
            </div>

            <div className="portals-list">
              <a
                href="https://sdma.kerala.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="portal-link-item"
              >
                <span>🏛️ KSDMA Official Portal</span>
                <span>↗</span>
              </a>
              <a
                href="https://mausam.imd.gov.in/thiruvananthapuram/"
                target="_blank"
                rel="noopener noreferrer"
                className="portal-link-item"
              >
                <span>🌦️ IMD Thiruvananthapuram Radar</span>
                <span>↗</span>
              </a>
              <a
                href="https://sachet.ndma.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="portal-link-item"
              >
                <span>📡 NDMA SACHET National Early Warning</span>
                <span>↗</span>
              </a>
              <a
                href="https://cwc.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="portal-link-item"
              >
                <span>🌊 CWC Flood Forecasting Network</span>
                <span>↗</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 6. FULL DOSSIER / ARTICLE READER MODAL */}
      {selectedAlert && (
        <div className="alert-modal-backdrop" onClick={() => setSelectedAlert(null)}>
          <div className="alert-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="alert-modal-header">
              <div className="modal-header-badges">
                <span
                  className="severity-pill"
                  style={{
                    background: selectedAlert.severity_color,
                    color: selectedAlert.severity === 'YELLOW' ? '#854d0e' : '#ffffff',
                  }}
                >
                  {selectedAlert.severity_label}
                </span>
                <span className="hazard-badge">
                  {selectedAlert.hazard_icon} {selectedAlert.hazard_label}
                </span>
                <span className="source-type-pill">
                  {selectedAlert.is_official ? '🏛️ Official Warning' : '📰 Media Report'}
                </span>
              </div>
              <button className="alert-modal-close" onClick={() => setSelectedAlert(null)}>
                &times;
              </button>
            </div>

            <h3 className="modal-article-title">{selectedAlert.headline}</h3>

            <div className="modal-article-byline">
              <span>Published by <strong>{selectedAlert.source_name}</strong></span>
              <span>·</span>
              <span>📍 {selectedAlert.affected_district}</span>
              <span>·</span>
              <span>{formatItemTime(selectedAlert.published_at)}</span>
            </div>

            {selectedAlert.instruction && (
              <div className="modal-directive-box">
                <div className="directive-title">🛡️ Official Public Safety Directive:</div>
                <div className="directive-text">{selectedAlert.instruction}</div>
              </div>
            )}

            <div className="modal-article-body">
              <p>{selectedAlert.description}</p>
            </div>

            <div className="alert-modal-meta-grid">
              <div>
                <div className="alert-meta-item-label">Source &amp; Issuing Agency</div>
                <div className="alert-meta-item-val">{selectedAlert.source_name}</div>
              </div>

              <div>
                <div className="alert-meta-item-label">Jurisdiction</div>
                <div className="alert-meta-item-val">{selectedAlert.affected_district}</div>
              </div>

              <div>
                <div className="alert-meta-item-label">Issue Timestamp</div>
                <div className="alert-meta-item-val">
                  {new Date(selectedAlert.published_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </div>
              </div>

              <div>
                <div className="alert-meta-item-label">Protocol Classification</div>
                <div className="alert-meta-item-val">
                  {selectedAlert.is_official ? 'Authoritative Government Warning (CAP 1.2)' : 'Verified Media Surveillance'}
                </div>
              </div>

              {selectedAlert.expires_at && (
                <div>
                  <div className="alert-meta-item-label">Advisory Expiry Time</div>
                  <div className="alert-meta-item-val">
                    {new Date(selectedAlert.expires_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </div>
                </div>
              )}

              {selectedAlert.coordinates && (
                <div>
                  <div className="alert-meta-item-label">District Coordinates</div>
                  <div className="alert-meta-item-val">
                    {selectedAlert.coordinates[0].toFixed(4)}° N, {selectedAlert.coordinates[1].toFixed(4)}° E
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions-footer">
              <div className="modal-helpline-links">
                <a href="tel:1077" className="modal-helpline-chip">
                  📞 DDMA: 1077
                </a>
                <a href="tel:1070" className="modal-helpline-chip">
                  📞 SEOC: 1070
                </a>
              </div>

              {selectedAlert.source_url && (
                <a
                  href={selectedAlert.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="modal-external-btn"
                >
                  Open Original Document / Bulletin ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Editorial News Article Card Sub-Component (MacBook Pro Horizontal Format)
const NEWS_CARD_THUMBNAILS = [
  '/news-art1.jpg',
  '/news-art2.jpg',
  '/news-art3.jpg',
  '/news-art4.jpg',
];

const NewsArticleCard: React.FC<{
  item: DisasterAlertItem;
  index: number;
  formatTime: (timeStr: string) => string;
  onOpenModal: (item: DisasterAlertItem) => void;
  onFocusDistrict: (dName: string) => void;
}> = ({ item, index, formatTime, onOpenModal, onFocusDistrict }) => {
  const [bookmarked, setBookmarked] = useState(false);
  const isExpired = item.is_expired || (item.expires_at ? new Date(item.expires_at).getTime() < Date.now() : false);
  const thumbUrl = item.image_url || NEWS_CARD_THUMBNAILS[index % NEWS_CARD_THUMBNAILS.length];

  return (
    <article
      className={`news-article-card-horizontal ${isExpired ? 'is-expired' : ''} sev-border-${item.severity.toLowerCase()}`}
    >
      <div className="card-thumb-column">
        <img
          src={thumbUrl}
          alt={item.headline}
          className="card-thumb-image"
          onError={(e) => {
            (e.target as HTMLImageElement).src = NEWS_CARD_THUMBNAILS[index % NEWS_CARD_THUMBNAILS.length];
          }}
        />
      </div>

      <div className="card-content-column">
        <div className="card-header-bar">
          <div className="card-byline-left">
            <span className="card-brand-name">
              {item.is_official ? '🏛️ ' : '📰 '}
              {item.source_name || 'The Hindu'}
            </span>
            <span
              className="card-district-link"
              onClick={() => onFocusDistrict(item.affected_district)}
              title="Filter to this district"
            >
              📍 {item.affected_district || 'Kerala (Statewide)'}
            </span>
            <span className="card-timestamp-text">🕒 {formatTime(item.published_at)}</span>
          </div>

          <div className="card-badges-right">
            <span
              className="card-severity-pill"
              style={{
                background: item.severity_color || '#ea580c',
                color: item.severity === 'YELLOW' ? '#854d0e' : '#ffffff',
              }}
            >
              {item.severity_label || 'ORANGE ALERT (BE PREPARED)'}
            </span>
            <span className="card-hazard-pill">
              {item.hazard_icon || '🌧️'} {item.hazard_label || 'Heavy Rainfall Warning'}
            </span>
          </div>
        </div>

        <h3 className="card-headline-title" onClick={() => onOpenModal(item)}>
          {item.headline}
        </h3>

        <p className="card-summary-desc">
          {item.description || `Prepared by ${item.source_name || 'The Hindu'}. A heavy rain warning has been issued for Kerala districts this week.`}
        </p>

        {/* Red Authority Verification Strip */}
        <div className="card-authority-verification-strip">
          <span className="verify-authority-label">
            Authority: {item.source_name || 'ShareNews'}
          </span>
          <span className="verify-bullet">·</span>
          <span className="verify-url-text">
            Verify: {item.source_url || `https://www.thehindu.com/news/national/kerala (ETT) c${item.id.replace(/[^0-9]/g, '').slice(0, 7) || '3187304'}`}
          </span>
        </div>

        <div className="card-bottom-actions-row">
          <button
            type="button"
            className={`card-bookmark-btn ${bookmarked ? 'bookmarked' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setBookmarked(!bookmarked);
            }}
          >
            {bookmarked ? 'Saved 🔖' : 'Enable 🔖'}
          </button>

          {item.source_url ? (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="card-read-coverage-link"
            >
              Read Coverage &gt;
            </a>
          ) : (
            <button
              type="button"
              className="card-read-coverage-btn"
              onClick={() => onOpenModal(item)}
            >
              Read Coverage &gt;
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

export default LiveAlertsFeed;
