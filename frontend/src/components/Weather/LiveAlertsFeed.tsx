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
  const [sourceCategory, setSourceCategory] = useState<'ALL' | 'OFFICIAL' | 'NEWS' | 'SEISMIC'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'feed' | 'map' | 'split'>('feed');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ALL'>('ACTIVE');

  // Auto-refresh timer state (default: 180s / 3 minutes)
  const [autoRefreshSecs, setAutoRefreshSecs] = useState<number>(180);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState<number>(180);
  const timerRef = useRef<any>(null);

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
        const now = Date.now();
        const twelveHoursAgo = now - 12 * 3600 * 1000;
        const freshEmergencies = res.alerts?.filter((a) => {
          if ((a.severity !== 'RED' && a.severity !== 'ORANGE') || !a.is_official) return false;
          if (a.is_expired || a.is_active === false) return false;
          if (a.expires_at && new Date(a.expires_at).getTime() < now) return false;
          if (a.issued_at && new Date(a.issued_at).getTime() < twelveHoursAgo) return false;
          return true;
        }) || [];

        if (freshEmergencies.length > 0) {
          setRefreshNotification({
            message: `⚠️ Live feeds refreshed: ${freshEmergencies.length} active emergency alert in effect.`,
            type: 'info',
          });
        } else {
          setRefreshNotification({
            message: `✅ Feeds checked live: No other emergency updates from NDMA SACHET or KSDMA at this time.`,
            type: 'success',
          });
        }
        setTimeout(() => setRefreshNotification(null), 6000);
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

    return data.alerts.filter((alert) => {
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
  }, [data, selectedDistrict, hazardFilter, severityFilter, sourceCategory, searchQuery]);

  // Find priority emergency alerts (ACTIVE RED or ORANGE from official sources, issued within last 12h)
  const priorityEmergencyAlerts = useMemo(() => {
    if (!data?.alerts) return [];
    const now = Date.now();
    const twelveHoursAgo = now - 12 * 3600 * 1000;

    return data.alerts.filter((a) => {
      if ((a.severity !== 'RED' && a.severity !== 'ORANGE') || !a.is_official) {
        return false;
      }
      if (a.is_expired || a.is_active === false) {
        return false;
      }
      if (a.expires_at) {
        const exp = new Date(a.expires_at).getTime();
        if (!isNaN(exp) && exp < now) {
          return false;
        }
      }
      // Must be recent (issued today / within 12h), not day-old bulletins
      if (a.issued_at) {
        const iss = new Date(a.issued_at).getTime();
        if (!isNaN(iss) && iss < twelveHoursAgo) {
          return false;
        }
      }
      return true;
    });
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

  return (
    <div className="disaster-feed-wrapper">
      {/* Real-time Refresh Feedback Banner */}
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

      {/* 1. OPERATIONS COMMAND BAR */}
      <div className="feed-command-bar">
        <div className="feed-status-cluster">
          <div className="feed-live-indicator">
            <span className="live-beacon" />
            <span>LIVE INCIDENT STREAM</span>
          </div>
          <span className="feed-sync-time">
            Last synced: <strong>{lastSyncFormatted}</strong>
            {data?.is_cached && ` (Cached ${data.cache_age_seconds}s ago)`}
          </span>
          {autoRefreshSecs > 0 && (
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              ⏱️ Refresh in <strong>{secondsUntilRefresh}s</strong>
            </span>
          )}
        </div>

        <div className="feed-action-cluster">
          <div className="auto-refresh-selector">
            <label htmlFor="auto-refresh-select">Auto-sync:</label>
            <select
              id="auto-refresh-select"
              className="auto-refresh-select"
              value={autoRefreshSecs}
              onChange={(e) => {
                const val = Number(e.target.value);
                setAutoRefreshSecs(val);
                setSecondsUntilRefresh(val > 0 ? val : 180);
              }}
            >
              <option value={120}>Every 2 min</option>
              <option value={180}>Every 3 min</option>
              <option value={300}>Every 5 min</option>
              <option value={0}>Manual Only</option>
            </select>
          </div>

          <button
            className="feed-refresh-btn"
            onClick={() => loadFeed(true)}
            disabled={refreshing || loading}
            title="Bypass cache and poll live disaster feeds"
          >
            <span className={refreshing ? 'spin-icon' : ''}>🔄</span>
            {refreshing ? 'Polling Feeds…' : 'Refresh Feeds'}
          </button>
        </div>
      </div>

      {/* 2. SOURCE CONNECTIVITY & TELEMETRY ROW */}
      <div className="source-telemetry-row">
        <span className="source-telemetry-label">Authoritative Feeds:</span>

        {/* NDMA SACHET */}
        <div
          className={`source-chip ${
            data?.sources_status?.ndma_sachet?.status === 'ONLINE' ? 'is-online' : 'is-degraded'
          }`}
          title={data?.sources_status?.ndma_sachet?.attribution || 'NDMA SACHET CAP 1.2 Feed'}
        >
          <span
            className={`source-chip-dot ${
              data?.sources_status?.ndma_sachet?.status === 'ONLINE' ? '' : 'degraded'
            }`}
          />
          <span>NDMA SACHET ({data?.official_count ?? 0} Alerts)</span>
        </div>

        {/* USGS Seismology */}
        <div
          className={`source-chip ${
            data?.sources_status?.usgs_seismic?.status === 'ONLINE' ? 'is-online' : 'is-degraded'
          }`}
          title="USGS Real-time Seismic Observation Feed"
        >
          <span
            className={`source-chip-dot ${
              data?.sources_status?.usgs_seismic?.status === 'ONLINE' ? '' : 'degraded'
            }`}
          />
          <span>USGS Seismic ({data?.seismic_count ?? 0} Recorded)</span>
        </div>

        {/* Kerala Disaster Media */}
        <div
          className={`source-chip ${
            data?.sources_status?.disaster_news?.status === 'ONLINE' ? 'is-online' : 'is-degraded'
          }`}
          title="Curated verified media monitoring (The Hindu, Mathrubhumi, CNBC, NDTV)"
        >
          <span
            className={`source-chip-dot ${
              data?.sources_status?.disaster_news?.status === 'ONLINE' ? '' : 'degraded'
            }`}
          />
          <span>Kerala News Surveillance ({data?.news_count ?? 0} Reports)</span>
        </div>

        {/* Open-Meteo */}
        <div className="source-chip is-online" title="Open-Meteo Atmospheric & Hydrological Telemetry Node">
          <span className="source-chip-dot" />
          <span>Open-Meteo Live API</span>
        </div>
      </div>

      {/* 3. KSDMA SEOC TOLL-FREE HELPLINE STRIP */}
      <div className="helpline-quick-strip">
        <div className="helpline-left">
          <span className="helpline-icon">🏛️</span>
          <div>
            <div className="helpline-title">Kerala State Disaster Management Authority (KSDMA) Operations</div>
            <div className="helpline-sub">24/7 State Emergency Operations Centre (SEOC) Direct Dispatch</div>
          </div>
        </div>

        <div className="helpline-tags">
          <a href="tel:1070" className="helpline-pill" title="State Emergency Operations Centre">
            📞 SEOC State: <strong>1070</strong>
          </a>
          <a href="tel:1077" className="helpline-pill" title="District Collectorate Emergency Cell">
            📞 District EOC: <strong>1077</strong>
          </a>
          <a href="tel:112" className="helpline-pill" title="Unified Emergency Line">
            🚨 Emergency: <strong>112</strong>
          </a>
          <a
            href="https://sdma.kerala.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="helpline-pill"
            style={{ background: '#f8fafc', color: '#475569' }}
          >
            sdma.kerala.gov.in ↗
          </a>
        </div>
      </div>

      {/* 4. EMERGENCY MARQUEE: DISPLAY TOP ACTIVE FRESH RED/ORANGE ALERTS OR ALL-CLEAR STATUS */}
      {priorityEmergencyAlerts.length > 0 ? (
        <div className="emergency-top-marquee">
          <span className="emergency-marquee-icon">🚨</span>
          <div className="emergency-marquee-body">
            <div className="emergency-marquee-header">
              <span className="emergency-marquee-badge">
                {priorityEmergencyAlerts[0].severity_label}
              </span>
              <span className="emergency-marquee-district">
                📍 {priorityEmergencyAlerts[0].affected_district}
              </span>
              <span className="emergency-marquee-active-badge">
                🟢 ACTIVE NOW
              </span>
              {priorityEmergencyAlerts[0].expires_at && (
                <span className="emergency-marquee-validity">
                  Valid until {new Date(priorityEmergencyAlerts[0].expires_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  {priorityEmergencyAlerts[0].issued_at && (
                    <span style={{ color: '#64748b', fontWeight: 600, marginLeft: '6px' }}>
                      · Issued {new Date(priorityEmergencyAlerts[0].issued_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) === new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) ? 'today' : 'yesterday'} at {new Date(priorityEmergencyAlerts[0].issued_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </span>
              )}
              <span style={{ fontSize: '0.74rem', color: '#7f1d1d' }}>
                Issued by {priorityEmergencyAlerts[0].source_name}
              </span>
            </div>
            <div className="emergency-marquee-text">
              {priorityEmergencyAlerts[0].headline}
            </div>
            {priorityEmergencyAlerts[0].instruction && (
              <div className="emergency-marquee-instruction">
                <strong>Directive:</strong> {priorityEmergencyAlerts[0].instruction}
              </div>
            )}
          </div>
          {priorityEmergencyAlerts[0].source_url && (
            <a
              href={priorityEmergencyAlerts[0].source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="action-link-btn"
              style={{ background: '#dc2626', color: '#ffffff', borderColor: '#b91c1c', alignSelf: 'center' }}
            >
              Official CAP XML ↗
            </a>
          )}
        </div>
      ) : (
        <div className="all-clear-status-banner">
          <div className="all-clear-left">
            <span className="all-clear-icon">✅</span>
            <div>
              <div className="all-clear-title">No Active Emergency Warnings (Red / Orange) Currently in Effect</div>
              <div className="all-clear-desc">
                Authoritative feeds (NDMA SACHET, KSDMA &amp; IMD) have issued no active emergency alerts for Kerala at this time.
              </div>
            </div>
          </div>
          <div className="all-clear-right">
            <span className="all-clear-chip">🟢 Feeds Verified Live</span>
            <span className="all-clear-sub">Last sync: {lastSyncFormatted}</span>
          </div>
        </div>
      )}

      {/* 5. FILTER & SEARCH TOOLBAR */}
      <div className="feed-filter-panel">
        <div className="filter-inputs-grid">
          {/* District Picker */}
          <div className="filter-group">
            <label htmlFor="feed-district-select">District</label>
            <select
              id="feed-district-select"
              className="filter-select"
              value={selectedDistrict}
              onChange={(e) => handleDistrictSelect(e.target.value)}
            >
              <option value="All">All 14 Districts + Statewide</option>
              {Object.values(KERALA_DISTRICTS).map((d) => (
                <option key={d.name} value={d.name}>
                  📍 {d.name} District
                </option>
              ))}
            </select>
          </div>

          {/* Hazard Type Picker */}
          <div className="filter-group">
            <label htmlFor="feed-hazard-select">Hazard Type</label>
            <select
              id="feed-hazard-select"
              className="filter-select"
              value={hazardFilter}
              onChange={(e) => setHazardFilter(e.target.value)}
            >
              <option value="ALL">All Hazards</option>
              <option value="FLOOD">🌊 Flood &amp; River Inundation</option>
              <option value="HEAVY_RAIN">🌧️ Heavy Rain &amp; Downpour</option>
              <option value="LANDSLIDE">⛰️ Landslide &amp; Slope Failure</option>
              <option value="CYCLONE">🌀 Cyclone &amp; Low Pressure</option>
              <option value="LIGHTNING">⚡ Lightning &amp; Thunderstorm</option>
              <option value="WIND">💨 High Wind &amp; Squall</option>
              <option value="EARTHQUAKE">🌋 Seismic Activity (Observed)</option>
            </select>
          </div>

          {/* Severity Picker */}
          <div className="filter-group">
            <label htmlFor="feed-severity-select">Severity Level</label>
            <select
              id="feed-severity-select"
              className="filter-select"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="ALL">All Warning Levels</option>
              <option value="RED">🔴 Red Alert (Take Action)</option>
              <option value="ORANGE">🟠 Orange Alert (Be Prepared)</option>
              <option value="YELLOW">🟡 Yellow Alert (Be Updated)</option>
              <option value="GREEN">🟢 Green Alert (Normal / Minor)</option>
              <option value="INFO">ℹ️ General Notice / Advisory</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="filter-group">
            <label htmlFor="feed-search-input">Search Feed</label>
            <input
              id="feed-search-input"
              type="text"
              className="filter-search-input"
              placeholder="Filter by keyword, dam, river, taluk…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Active vs Expired Status Toggle */}
          <div className="filter-group">
            <label>Feed Lifecycle</label>
            <div className="status-toggle-group">
              <button
                type="button"
                className={`status-toggle-btn ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
                onClick={() => setStatusFilter('ACTIVE')}
                title="Show only currently active alerts"
              >
                🟢 Active Only ({data?.active_count ?? 0})
              </button>
              <button
                type="button"
                className={`status-toggle-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setStatusFilter('ALL')}
                title="Include expired and past alerts"
              >
                ⏱️ All Feeds ({data?.total_count ?? 0})
              </button>
            </div>
          </div>
        </div>

        {/* View Mode & Count Toggles */}
        <div className="feed-view-toggles">
          <div className="feed-counter-summary">
            Showing <strong>{filteredAlerts.length}</strong> of {data?.total_count ?? 0} updates
            {selectedDistrict !== 'All' && <span> in <strong>{selectedDistrict}</strong></span>}
          </div>

          <div className="view-mode-buttons">
            <button
              className={`view-mode-btn ${viewMode === 'feed' ? 'active' : ''}`}
              onClick={() => setViewMode('feed')}
            >
              📋 Feed Cards
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'map' ? 'active' : ''}`}
              onClick={() => setViewMode('map')}
            >
              🗺️ Map View
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'split' ? 'active' : ''}`}
              onClick={() => setViewMode('split')}
            >
              🔀 Split View
            </button>
          </div>
        </div>
      </div>

      {/* 6. CATEGORY SUB-TABS (All / Official Warnings / Verified News / Seismic) */}
      <div className="feed-category-tabs">
        <button
          className={`feed-category-tab ${sourceCategory === 'ALL' ? 'active' : ''}`}
          onClick={() => setSourceCategory('ALL')}
        >
          <span>All Live Updates</span>
          <span className="category-tab-count">{data?.total_count ?? 0}</span>
        </button>

        <button
          className={`feed-category-tab ${sourceCategory === 'OFFICIAL' ? 'active' : ''}`}
          onClick={() => setSourceCategory('OFFICIAL')}
        >
          <span>🏛️ Official Warnings (NDMA/KSDMA/IMD)</span>
          <span className="category-tab-count">{data?.official_count ?? 0}</span>
        </button>

        <button
          className={`feed-category-tab ${sourceCategory === 'NEWS' ? 'active' : ''}`}
          onClick={() => setSourceCategory('NEWS')}
        >
          <span>📰 Verified News Reports</span>
          <span className="category-tab-count">{data?.news_count ?? 0}</span>
        </button>

        <button
          className={`feed-category-tab ${sourceCategory === 'SEISMIC' ? 'active' : ''}`}
          onClick={() => setSourceCategory('SEISMIC')}
        >
          <span>🌋 Seismic Observations (USGS)</span>
          <span className="category-tab-count">{data?.seismic_count ?? 0}</span>
        </button>
      </div>

      {/* 7. MAIN VIEW CONTENT */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderColor: '#0284c7', borderTopColor: 'transparent' }} />
          <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>
            Querying NDMA SACHET, USGS Seismology &amp; Media Nodes…
          </span>
        </div>
      ) : error ? (
        <div style={{ padding: '2rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#991b1b', textAlign: 'center' }}>
          <h3>⚠️ Feed Connection Degraded</h3>
          <p>{error}</p>
          <button className="feed-refresh-btn" onClick={() => loadFeed(true)} style={{ marginTop: '0.75rem' }}>
            Retry Connection
          </button>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div style={{ padding: '3.5rem 1rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
          <h4 style={{ margin: 0, color: '#334155' }}>No alerts match your current filter criteria</h4>
          <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.35rem' }}>
            Try resetting your district, hazard type, or search keywords.
          </p>
          <button
            className="feed-refresh-btn"
            style={{ marginTop: '0.75rem', background: '#475569' }}
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
            <DisasterAlertsMap
              alerts={filteredAlerts}
              selectedDistrict={selectedDistrict}
              onDistrictSelect={handleDistrictSelect}
            />
          )}

          {/* SPLIT VIEW */}
          {viewMode === 'split' && (
            <div className="feed-split-layout">
              <div>
                <DisasterAlertsMap
                  alerts={filteredAlerts}
                  selectedDistrict={selectedDistrict}
                  onDistrictSelect={handleDistrictSelect}
                />
              </div>
              <div className="feed-cards-grid" style={{ maxHeight: '520px', overflowY: 'auto', paddingRight: '0.35rem' }}>
                {filteredAlerts.map((item) => (
                  <AlertCardItem
                    key={item.id}
                    item={item}
                    formatTime={formatItemTime}
                    onOpenModal={setSelectedAlert}
                    onFocusDistrict={handleDistrictSelect}
                  />
                ))}
              </div>
            </div>
          )}

          {/* FEED CARDS ONLY VIEW */}
          {viewMode === 'feed' && (
            <div className="feed-cards-grid">
              {filteredAlerts.map((item) => (
                <AlertCardItem
                  key={item.id}
                  item={item}
                  formatTime={formatItemTime}
                  onOpenModal={setSelectedAlert}
                  onFocusDistrict={handleDistrictSelect}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* 8. DETAIL MODAL */}
      {selectedAlert && (
        <div className="alert-modal-backdrop" onClick={() => setSelectedAlert(null)}>
          <div className="alert-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="alert-modal-header">
              <div>
                <span
                  className="severity-pill"
                  style={{
                    background: selectedAlert.severity_color,
                    color: selectedAlert.severity === 'YELLOW' ? '#854d0e' : '#ffffff',
                    marginRight: '0.5rem',
                  }}
                >
                  {selectedAlert.severity_label}
                </span>
                <span className="hazard-badge">
                  {selectedAlert.hazard_icon} {selectedAlert.hazard_label}
                </span>
              </div>
              <button className="alert-modal-close" onClick={() => setSelectedAlert(null)}>
                &times;
              </button>
            </div>

            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.15rem', color: '#0f172a', lineHeight: 1.4 }}>
              {selectedAlert.headline}
            </h3>

            {selectedAlert.instruction && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  margin: '0.75rem 0',
                  color: '#991b1b',
                  fontSize: '0.86rem',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: '0.2rem' }}>
                  🛡️ Official Authority Safety Directive:
                </div>
                {selectedAlert.instruction}
              </div>
            )}

            <p style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.6, margin: '0.75rem 0' }}>
              {selectedAlert.description}
            </p>

            <div className="alert-modal-meta-grid">
              <div>
                <div className="alert-meta-item-label">Source &amp; Issuing Agency</div>
                <div className="alert-meta-item-val">{selectedAlert.source_name}</div>
              </div>

              <div>
                <div className="alert-meta-item-label">Affected Jurisdiction</div>
                <div className="alert-meta-item-val">{selectedAlert.affected_district}</div>
              </div>

              <div>
                <div className="alert-meta-item-label">Published / Issue Timestamp</div>
                <div className="alert-meta-item-val">
                  {new Date(selectedAlert.published_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </div>
              </div>

              <div>
                <div className="alert-meta-item-label">Feed Protocol Classification</div>
                <div className="alert-meta-item-val">
                  {selectedAlert.is_official ? 'Authoritative Government Warning' : 'Verified Media Surveillance'}
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a href="tel:1077" className="helpline-pill">
                  📞 Call DDMA: 1077
                </a>
                <a href="tel:1070" className="helpline-pill">
                  📞 Call SEOC: 1070
                </a>
              </div>

              {selectedAlert.source_url && (
                <a
                  href={selectedAlert.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="feed-refresh-btn"
                  style={{ textDecoration: 'none' }}
                >
                  Open Original Document ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component for individual alert cards
const AlertCardItem: React.FC<{
  item: DisasterAlertItem;
  formatTime: (timeStr: string) => string;
  onOpenModal: (item: DisasterAlertItem) => void;
  onFocusDistrict: (dName: string) => void;
}> = ({ item, formatTime, onOpenModal, onFocusDistrict }) => {
  const isHighSev = item.severity === 'RED' || item.severity === 'ORANGE';
  const isExpired = item.is_expired || (item.expires_at ? new Date(item.expires_at).getTime() < Date.now() : false);

  return (
    <div
      className={`alert-card ${isExpired ? 'is-expired-card' : ''} ${
        item.is_official
          ? `is-official sev-${item.severity.toLowerCase()}`
          : item.source_type === 'SEISMIC_OBSERVATION'
          ? 'is-seismic'
          : 'is-news'
      }`}
    >
      <div className="alert-card-header">
        <div className="alert-card-tags">
          {item.is_official ? (
            <span className="source-type-badge badge-official">🏛️ Official Warning</span>
          ) : item.source_type === 'SEISMIC_OBSERVATION' ? (
            <span className="source-type-badge badge-seismic">🌋 Seismic Telemetry</span>
          ) : (
            <span className="source-type-badge badge-news">📰 Media Report</span>
          )}

          <span className="hazard-badge">
            {item.hazard_icon} {item.hazard_label}
          </span>

          <span
            className="district-badge"
            style={{ cursor: 'pointer' }}
            onClick={() => onFocusDistrict(item.affected_district)}
            title="Filter feed to this district"
          >
            📍 {item.affected_district}
          </span>

          <span
            className="severity-pill"
            style={{
              background: item.severity_color,
              color: item.severity === 'YELLOW' ? '#854d0e' : '#ffffff',
            }}
          >
            {item.severity_label}
          </span>

          {isExpired ? (
            <span className="validity-badge is-expired" title="This alert time window has concluded">
              ⏱️ Expired {item.expires_at ? `(${new Date(item.expires_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })})` : ''}
            </span>
          ) : item.expires_at ? (
            <span className="validity-badge is-active" title="Currently within active warning window">
              🟢 Active until {new Date(item.expires_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}
        </div>

        <span className="alert-timestamp">{formatTime(item.published_at)}</span>
      </div>

      <div className="alert-card-headline" onClick={() => onOpenModal(item)} style={{ cursor: 'pointer' }}>
        {item.headline}
      </div>

      {item.instruction && isHighSev && (
        <div className="alert-card-instruction">
          <span className="instruction-official-label">🛡️ Authority Directive:</span>
          <span>{item.instruction}</span>
        </div>
      )}

      <div className="alert-card-footer">
        <span className="alert-source-attribution">
          Source: <strong>{item.source_name}</strong>
          {item.is_forecast && ' · Forecast Model'}
        </span>

        <div className="alert-card-actions">
          <button
            className="action-link-btn"
            onClick={() => onOpenModal(item)}
            title="Inspect full alert dossier and CAP parameters"
          >
            Details ℹ️
          </button>

          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="action-link-btn"
              title="Open authoritative source or XML notice in new tab"
            >
              Source Notice ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveAlertsFeed;
