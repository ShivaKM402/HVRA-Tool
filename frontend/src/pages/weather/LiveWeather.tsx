import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDistrict } from '@/context/DistrictContext';
import {
  fetchDistrictWeather,
  fetchRiverDischarge,
  fetchAirQuality,
  KERALA_DISTRICTS,
  getWeatherCodeInfo,
  type DistrictWeatherReport,
  type RiverDischargeReport,
  type AirQualityReport,
} from '@/services/weatherService';
import { WeatherRadarMap } from '@/components/Weather/WeatherRadarMap';
import { LiveAlertsFeed } from '@/components/Weather/LiveAlertsFeed';
import './LiveWeather.css';

type WeatherTab = 'live-alerts' | 'radar' | 'overview' | 'discharge' | 'criteria';

export const LiveWeather: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeDistrictId, districts } = useDistrict();

  // Find active district name
  const currentDistrictObj = districts.find((d) => d.id === activeDistrictId);
  const defaultDistrictName = currentDistrictObj ? currentDistrictObj.name.replace(/ District/i, '') : 'Thiruvananthapuram';

  const [selectedDistrict, setSelectedDistrict] = useState<string>(
    searchParams.get('district') || defaultDistrictName
  );
  const [activeTab, setActiveTab] = useState<WeatherTab>(
    (searchParams.get('tab') as WeatherTab) || 'live-alerts'
  );

  const [weatherData, setWeatherData] = useState<DistrictWeatherReport | null>(null);
  const [dischargeData, setDischargeData] = useState<RiverDischargeReport | null>(null);
  const [aqiData, setAqiData] = useState<AirQualityReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadWeatherFeeds = useCallback(async (district: string) => {
    setLoading(true);
    setError(null);
    try {
      const [wReport, dReport, aReport] = await Promise.all([
        fetchDistrictWeather(district),
        fetchRiverDischarge(district).catch((err) => {
          console.warn('Discharge fetch error, falling back:', err);
          return null;
        }),
        fetchAirQuality(district).catch((err) => {
          console.warn('AQI fetch error, falling back:', err);
          return null;
        }),
      ]);
      setWeatherData(wReport);
      setDischargeData(dReport);
      setAqiData(aReport);
    } catch (err: any) {
      console.error('Failed to load Open-Meteo telemetry:', err);
      setError(err?.message || 'Failed to connect to Open-Meteo telemetry servers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeatherFeeds(selectedDistrict);
  }, [selectedDistrict, loadWeatherFeeds]);

  useEffect(() => {
    const tabParam = searchParams.get('tab') as WeatherTab;
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
    const distParam = searchParams.get('district');
    if (distParam && distParam !== selectedDistrict) {
      setSelectedDistrict(distParam);
    }
  }, [searchParams]);

  const handleDistrictChange = (dName: string) => {
    setSelectedDistrict(dName);
    setSearchParams((prev) => {
      prev.set('district', dName);
      return prev;
    });
  };

  const handleTabChange = (tab: WeatherTab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      prev.set('tab', tab);
      return prev;
    });
  };

  return (
    <div className="weather-page-root">
      {/* 100% EDGE-TO-EDGE FULL-WIDTH HERO BANNER */}
      <section className="weather-editorial-hero-fullwidth">
        <div className="hero-inner-container">
          <div className="hero-content-left">
            <div className="hero-top-badge">
              <span className="hero-badge-pill">Live Disaster Operations &amp; Weather</span>
            </div>
            <h1 className="hero-main-title">
              Kerala Live Disaster Operations &amp; Weather Dashboard
            </h1>
            <p className="hero-main-subtitle">
              Real-time multi-hazard surveillance · NDMA SACHET CAP alerts · GloFAS streamflow &amp; Open-Meteo telemetry
            </p>

            <div className="hero-controls-row">
              <div className="hero-control-group">
                <span className="hero-control-label">District:</span>
                <select
                  className="hero-district-select"
                  value={selectedDistrict}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                >
                  <option value="All">📍 All Kerala (14 Districts)</option>
                  {Object.values(KERALA_DISTRICTS).map((d) => (
                    <option key={d.name} value={d.name}>
                      📍 {d.name} District
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="hero-refresh-btn"
                onClick={() => loadWeatherFeeds(selectedDistrict)}
                title="Refresh Open-Meteo feeds"
              >
                🔄 Refresh Feed
              </button>
            </div>
          </div>

          {/* Right Telemetry Frosted Glass Card */}
          <div className="hero-telemetry-glass-card">
            <div className="glass-card-header">
              <div className="weather-cloud-icon">
                <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
                  <path d="M8 19v2" />
                  <path d="M8 13v2" />
                  <path d="M12 21v2" />
                  <path d="M12 15v2" />
                  <path d="M16 19v2" />
                  <path d="M16 13v2" />
                </svg>
              </div>
              <div className="weather-primary-info">
                <div className="weather-location-label">
                  {selectedDistrict === 'All' ? 'Thiruvananthapuram' : selectedDistrict}
                </div>
                <div className="weather-temp-display">
                  {weatherData?.current ? `${Math.round(weatherData.current.temperature)}°C` : '28°C'}
                </div>
                <div className="weather-condition-label">
                  {weatherData?.current ? getWeatherCodeInfo(weatherData.current.weatherCode).description : 'Moderate Rain'}
                </div>
              </div>
            </div>

            <div className="glass-card-metrics-row">
              <div className="glass-metric-col">
                <div className="metric-label">Humidity</div>
                <div className="metric-val">
                  {weatherData?.current?.humidity !== undefined ? `${weatherData.current.humidity}%` : '86%'}
                </div>
              </div>
              <div className="glass-metric-col">
                <div className="metric-label">Wind</div>
                <div className="metric-val">
                  {weatherData?.current?.windSpeed !== undefined ? `${Math.round(weatherData.current.windSpeed)} km/h` : '12 km/h'}
                </div>
              </div>
              <div className="glass-metric-col">
                <div className="metric-label">Rainfall(24h)</div>
                <div className="metric-val">
                  {weatherData?.daily?.[0]?.precipitationSum !== undefined
                    ? `${Math.round(weatherData.daily[0].precipitationSum)}mm`
                    : '78mm'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CENTERED BODY CONTAINER FOR SUBTABS, TICKER & FEED */}
      <div className="weather-body-container">
        {/* 5 Prominent Sub-Tab Navigation Cards */}
        <div className="weather-subtabs-row">
          <button
            className={`weather-subtab-card ${activeTab === 'live-alerts' ? 'active' : ''}`}
          onClick={() => handleTabChange('live-alerts')}
        >
          <div className="subtab-icon-wrap">
            <span className="subtab-beacon-dot" />
            <span className="subtab-icon">📢</span>
          </div>
          <div className="subtab-text">
            <strong>Live Disaster News</strong>
            <span>&amp; Official Alerts</span>
          </div>
        </button>

        <button
          className={`weather-subtab-card ${activeTab === 'radar' ? 'active' : ''}`}
          onClick={() => handleTabChange('radar')}
        >
          <div className="subtab-icon-wrap">
            <span className="subtab-icon">📡</span>
          </div>
          <div className="subtab-text">
            <strong>Live Doppler Radar</strong>
            <span className="subtab-sub">(TV Movement)</span>
          </div>
        </button>

        <button
          className={`weather-subtab-card ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => handleTabChange('overview')}
        >
          <div className="subtab-icon-wrap">
            <span className="subtab-icon">🌦️</span>
          </div>
          <div className="subtab-text">
            <strong>District Weather</strong>
            <span className="subtab-sub">&amp; 7-Day Forecast</span>
          </div>
        </button>

        <button
          className={`weather-subtab-card ${activeTab === 'discharge' ? 'active' : ''}`}
          onClick={() => handleTabChange('discharge')}
        >
          <div className="subtab-icon-wrap">
            <span className="subtab-icon">🌊</span>
          </div>
          <div className="subtab-text">
            <strong>GloFAS River</strong>
            <span className="subtab-sub">Discharge ({dischargeData ? `${dischargeData.peakDischarge.toFixed(1)} m³/s` : '71.8 m³/s'})</span>
          </div>
        </button>

        <button
          className={`weather-subtab-card ${activeTab === 'criteria' ? 'active' : ''}`}
          onClick={() => handleTabChange('criteria')}
        >
          <div className="subtab-icon-wrap">
            <span className="subtab-icon">📊</span>
          </div>
          <div className="subtab-text">
            <strong>IMD/KSDMA</strong>
            <span className="subtab-sub">Severity Criteria</span>
          </div>
        </button>
      </div>

      {/* TAB 0: FLAGSHIP REAL-TIME DISASTER NEWS & OFFICIAL ALERTS FEED */}
      {activeTab === 'live-alerts' && (
        <LiveAlertsFeed
          initialDistrict={selectedDistrict}
          onDistrictChange={handleDistrictChange}
        />
      )}

      {/* OTHER TABS: OPEN-METEO WEATHER, RADAR, DISCHARGE & MATRIX */}
      {activeTab !== 'live-alerts' && (
        <>
          {loading && !weatherData ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem' }}>
              <div className="spinner" style={{ width: '40px', height: '40px', borderColor: '#0284c7', borderTopColor: 'transparent' }} />
              <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>
                Querying Open-Meteo Atmospheric &amp; Hydrological Nodes for {selectedDistrict}…
              </span>
            </div>
          ) : error ? (
            <div style={{ padding: '2rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#991b1b', textAlign: 'center' }}>
              <h3>⚠️ Telemetry Feed Unavailable</h3>
              <p>{error}</p>
              <button className="btn btn-primary btn-sm" onClick={() => loadWeatherFeeds(selectedDistrict)} style={{ marginTop: '0.5rem' }}>
                Try Again
              </button>
            </div>
          ) : weatherData ? (
            <>
              {/* Prominent KSDMA / IMD Alert Banner */}
              <div
                className="weather-alert-banner"
                style={{
                  background: `${weatherData.alert.badgeColor}15`,
                  borderColor: weatherData.alert.badgeColor,
                }}
              >
                <div className="alert-icon-box">
                  {weatherData.alert.level === 'RED'
                    ? '🚨'
                    : weatherData.alert.level === 'ORANGE'
                    ? '⚠️'
                    : weatherData.alert.level === 'YELLOW'
                    ? '⚡'
                    : '✅'}
                </div>
                <div className="alert-content-box">
                  <h4 style={{ color: weatherData.alert.level === 'YELLOW' ? '#854d0e' : weatherData.alert.badgeColor }}>
                    {weatherData.alert.label} — {weatherData.district} District
                  </h4>
                  <p style={{ color: '#334155' }}>
                    {weatherData.alert.advice} Expected 24h precipitation: <strong>{weatherData.daily[0]?.precipitationSum.toFixed(1)} mm</strong>.
                  </p>
                </div>
              </div>

              {/* TAB: TV DOPPLER RADAR MAP (LIVE MOVEMENT) */}
              {activeTab === 'radar' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                  <WeatherRadarMap
                    selectedDistrict={selectedDistrict}
                    onDistrictSelect={handleDistrictChange}
                    windSpeed={weatherData.current.windSpeed}
                    windDirection={weatherData.current.windDirection}
                    temperature={weatherData.current.temperature}
                    precipitation={weatherData.current.precipitation}
                    humidity={weatherData.current.humidity}
                    aqi={aqiData?.usAqi ?? null}
                    aqiCategory={aqiData?.category ?? null}
                    aqiColor={aqiData?.color ?? null}
                    pm25={aqiData?.pm25 ?? null}
                    pm10={aqiData?.pm10 ?? null}
                  />

              {/* Quick District Telemetry Strip */}
              <div className="telemetry-cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div className="telemetry-card">
                  <div className="telemetry-card-header">
                    <span className="telemetry-card-title">{weatherData.district} Temperature</span>
                    <span className="telemetry-card-icon">{weatherData.weatherInfo.icon}</span>
                  </div>
                  <div className="telemetry-card-value">
                    {Math.round(weatherData.current.temperature)}°C
                  </div>
                  <span className="telemetry-card-hint">
                    Feels like {Math.round(weatherData.current.apparentTemp)}°C · {weatherData.weatherInfo.description}
                  </span>
                </div>

                <div className="telemetry-card">
                  <div className="telemetry-card-header">
                    <span className="telemetry-card-title">Precipitation Rate</span>
                    <span className="telemetry-card-icon">🌧️</span>
                  </div>
                  <div className="telemetry-card-value">
                    {weatherData.current.precipitation.toFixed(1)} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>mm/h</span>
                  </div>
                  <span className="telemetry-card-hint">
                    Relative Humidity: {weatherData.current.humidity}%
                  </span>
                </div>

                <div className="telemetry-card">
                  <div className="telemetry-card-header">
                    <span className="telemetry-card-title">Wind Velocity</span>
                    <span className="telemetry-card-icon">💨</span>
                  </div>
                  <div className="telemetry-card-value">
                    {weatherData.current.windSpeed.toFixed(1)} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>km/h</span>
                  </div>
                  <span className="telemetry-card-hint">
                    Wind Bearing: {weatherData.current.windDirection}°
                  </span>
                </div>

                <div className="telemetry-card">
                  <div className="telemetry-card-header">
                    <span className="telemetry-card-title">24h Rain Accumulation</span>
                    <span className="telemetry-card-icon">🌊</span>
                  </div>
                  <div className="telemetry-card-value">
                    {weatherData.daily[0]?.precipitationSum.toFixed(1)} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>mm</span>
                  </div>
                  <span className="telemetry-card-hint">
                    Forecast Range: {weatherData.daily[0]?.tempMin}°C - {weatherData.daily[0]?.tempMax}°C
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              {/* Top Hero Grid */}
              <div className="weather-overview-grid">
                <div className="current-hero-card">
                  <div className="hero-card-top">
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                        Live Observation · {weatherData.district}
                      </div>
                      <div className="hero-temp-large">
                        {Math.round(weatherData.current.temperature)}°C
                      </div>
                      <div className="hero-condition-desc">
                        {weatherData.weatherInfo.description} (Feels like {Math.round(weatherData.current.apparentTemp)}°C)
                      </div>
                    </div>
                    <div className="hero-weather-icon">
                      {weatherData.weatherInfo.icon}
                    </div>
                  </div>

                  <div className="hero-metrics-row">
                    <div className="hero-mini-stat">
                      <span className="hero-stat-label">Rain Rate</span>
                      <span className="hero-stat-val">
                        {weatherData.current.precipitation.toFixed(1)} mm/h
                      </span>
                    </div>
                    <div className="hero-mini-stat">
                      <span className="hero-stat-label">Humidity</span>
                      <span className="hero-stat-val">
                        {weatherData.current.humidity}%
                      </span>
                    </div>
                    <div className="hero-mini-stat">
                      <span className="hero-stat-label">Wind Speed</span>
                      <span className="hero-stat-val">
                        {weatherData.current.windSpeed.toFixed(1)} km/h
                      </span>
                    </div>
                  </div>
                </div>

                {/* Telemetry Stat Cards */}
                <div className="telemetry-cards-grid">
                  <div className="telemetry-card">
                    <div className="telemetry-card-header">
                      <span className="telemetry-card-title">24h Rain Accumulation</span>
                      <span className="telemetry-card-icon">🌧️</span>
                    </div>
                    <div className="telemetry-card-val" style={{ color: '#0284c7' }}>
                      {weatherData.daily[0]?.precipitationSum.toFixed(1)} <span style={{ fontSize: '1rem', fontWeight: 600 }}>mm</span>
                    </div>
                    <div className="telemetry-card-sub">
                      Rain Prob: {weatherData.daily[0]?.precipitationProb}% max
                    </div>
                  </div>

                  <div className="telemetry-card">
                    <div className="telemetry-card-header">
                      <span className="telemetry-card-title">GloFAS River Discharge</span>
                      <span className="telemetry-card-icon">🌊</span>
                    </div>
                    <div className="telemetry-card-val" style={{ color: '#2563eb' }}>
                      {dischargeData ? dischargeData.discharge[0]?.toFixed(1) : '--'} <span style={{ fontSize: '1rem', fontWeight: 600 }}>m³/s</span>
                    </div>
                    <div className="telemetry-card-sub">
                      Peak 7-day flow: {dischargeData ? `${dischargeData.peakDischarge.toFixed(1)} m³/s` : 'Calculating…'}
                    </div>
                  </div>

                  <div className="telemetry-card">
                    <div className="telemetry-card-header">
                      <span className="telemetry-card-title">Peak Wind Gusts</span>
                      <span className="telemetry-card-icon">💨</span>
                    </div>
                    <div className="telemetry-card-val" style={{ color: '#475569' }}>
                      {weatherData.daily[0]?.windSpeedMax.toFixed(1)} <span style={{ fontSize: '1rem', fontWeight: 600 }}>km/h</span>
                    </div>
                    <div className="telemetry-card-sub">
                      Direction: {weatherData.current.windDirection}°
                    </div>
                  </div>

                  <div className="telemetry-card">
                    <div className="telemetry-card-header">
                      <span className="telemetry-card-title">Thermal Range</span>
                      <span className="telemetry-card-icon">🌡️</span>
                    </div>
                    <div className="telemetry-card-val" style={{ color: '#d97706' }}>
                      {Math.round(weatherData.daily[0]?.tempMin)}° - {Math.round(weatherData.daily[0]?.tempMax)}°
                    </div>
                    <div className="telemetry-card-sub">
                      High / Low for today
                    </div>
                  </div>
                </div>
              </div>

              {/* Hourly Rain Timeline */}
              <div className="timeline-section-card">
                <div className="timeline-header">
                  <h3>
                    <span>⏱️</span> Next 24-Hour Precipitation Timeline
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Hourly probability and rainfall accumulation
                  </span>
                </div>
                <div className="hourly-timeline-scroll">
                  {weatherData.hourly.map((h, i) => (
                    <div key={i} className="hourly-cell">
                      <span className="hourly-time">{h.time}</span>
                      <span className="hourly-icon">{h.rain > 2 ? '🌧️' : h.rain > 0 ? '🌦️' : '🌤️'}</span>
                      <span className="hourly-temp">{Math.round(h.temp)}°</span>
                      <span className="hourly-rain">{h.rain.toFixed(1)} mm</span>
                      <span style={{ fontSize: '0.62rem', color: '#64748b' }}>{h.prob}% prob</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 7-Day Extended Forecast */}
              <div className="forecast-section-card">
                <div className="timeline-header">
                  <h3>
                    <span>📅</span> 7-Day Hydrological &amp; Rain Outlook
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Open-Meteo Numerical Weather Prediction Model
                  </span>
                </div>
                <div className="daily-forecast-cards">
                  {weatherData.daily.map((day, idx) => {
                    const dateObj = new Date(day.date);
                    const dayLabel = idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    const isHeavy = day.precipitationSum >= 64.5;
                    const isModerate = day.precipitationSum >= 15.6;

                    return (
                      <div key={day.date} className="daily-forecast-item">
                        <span className="daily-date-label">{dayLabel}</span>
                        <span className="daily-icon-large">
                          {day.precipitationSum > 10 ? '⛈️' : day.precipitationSum > 1 ? '🌧️' : '⛅'}
                        </span>
                        <span className="daily-temp-range">
                          {Math.round(day.tempMax)}° <span className="daily-temp-min">/ {Math.round(day.tempMin)}°</span>
                        </span>
                        <div
                          className="daily-rain-pill"
                          style={{
                            background: isHeavy ? '#fee2e2' : isModerate ? '#fef3c7' : '#e0f2fe',
                            color: isHeavy ? '#991b1b' : isModerate ? '#854d0e' : '#0369a1',
                          }}
                        >
                          💧 {day.precipitationSum.toFixed(1)} mm
                        </div>
                        <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                          Prob: {day.precipitationProb}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: RIVER DISCHARGE & GLOFAS */}
          {activeTab === 'discharge' && (
            <div className="discharge-section-card">
              <div className="discharge-header-strip">
                <div>
                  <h3>
                    <span>🌊</span> Global Flood Awareness System (GloFAS) River Flow
                  </h3>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Modeled river discharge (m³/s) from European Centre for Medium-Range Weather Forecasts (ECMWF)
                  </p>
                </div>
                {dischargeData && (
                  <div
                    className="discharge-status-pill"
                    style={{
                      background: dischargeData.status === 'HIGH_SURGE' ? '#fee2e2' : dischargeData.status === 'ELEVATED' ? '#fef3c7' : '#dcfce7',
                      color: dischargeData.status === 'HIGH_SURGE' ? '#991b1b' : dischargeData.status === 'ELEVATED' ? '#854d0e' : '#166534',
                    }}
                  >
                    Status: {dischargeData.status.replace('_', ' ')}
                  </div>
                )}
              </div>

              {dischargeData ? (
                <div>
                  <table className="discharge-table">
                    <thead>
                      <tr>
                        <th>Forecast Date</th>
                        <th>Mean Discharge (m³/s)</th>
                        <th>Current Forecast (m³/s)</th>
                        <th>Peak Surge Potential (m³/s)</th>
                        <th>Hydrological Alert</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dischargeData.dates.map((dateStr, idx) => {
                        const maxVal = dischargeData.dischargeMax[idx] || 0;
                        const isSurge = maxVal > 30.0;
                        const isElevated = maxVal > 15.0;

                        return (
                          <tr key={dateStr}>
                            <td style={{ fontWeight: 700 }}>{dateStr}</td>
                            <td>{dischargeData.dischargeMean[idx]?.toFixed(2) || '--'}</td>
                            <td style={{ fontWeight: 700, color: '#0284c7' }}>
                              {dischargeData.discharge[idx]?.toFixed(2) || '--'}
                            </td>
                            <td style={{ fontWeight: 800, color: isSurge ? '#dc2626' : isElevated ? '#ea580c' : '#1e293b' }}>
                              {dischargeData.dischargeMax[idx]?.toFixed(2) || '--'}
                            </td>
                            <td>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  background: isSurge ? '#fee2e2' : isElevated ? '#fef3c7' : '#f1f5f9',
                                  color: isSurge ? '#991b1b' : isElevated ? '#854d0e' : '#475569',
                                }}
                              >
                                {isSurge ? '🚨 High Discharge' : isElevated ? '⚠️ Elevated Flow' : 'Normal Streamflow'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  No river discharge stations located within immediate coordinate grid.
                </div>
              )}
            </div>
          )}

          {/* TAB: IMD/KSDMA WARNING MATRIX */}
          {(activeTab === 'criteria' || (activeTab as string) === 'alerts') && (
            <div className="forecast-section-card">
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                🏛️ Kerala State Disaster Management Authority (KSDMA) Rainfall Matrix
              </h3>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                Color-coded rainfall warning definitions calibrated to Kerala's terrain and drainage baselines:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '1.25rem', borderRadius: '12px', background: '#f0fdf4', border: '1.5px solid #86efac' }}>
                  <div style={{ fontWeight: 800, color: '#166534', fontSize: '1rem' }}>🟢 Green Alert (Normal)</div>
                  <div style={{ fontSize: '0.78rem', color: '#14532d', margin: '0.5rem 0' }}>Precipitation: &lt; 15.5 mm / 24 hours</div>
                  <div style={{ fontSize: '0.75rem', color: '#4b5563', lineHeight: 1.4 }}>
                    No warning. General surveillance by field staff and panchayats. Routine water discharge checks.
                  </div>
                </div>

                <div style={{ padding: '1.25rem', borderRadius: '12px', background: '#fefce8', border: '1.5px solid #fde047' }}>
                  <div style={{ fontWeight: 800, color: '#854d0e', fontSize: '1rem' }}>🟡 Yellow Alert (Watch)</div>
                  <div style={{ fontSize: '0.78rem', color: '#713f12', margin: '0.5rem 0' }}>Precipitation: 15.6 – 64.4 mm / 24 hours</div>
                  <div style={{ fontSize: '0.75rem', color: '#4b5563', lineHeight: 1.4 }}>
                    Heavy isolated rainfall. Line departments on watch. Monitor flash-flood prone stream confluences.
                  </div>
                </div>

                <div style={{ padding: '1.25rem', borderRadius: '12px', background: '#fff7ed', border: '1.5px solid #fdba74' }}>
                  <div style={{ fontWeight: 800, color: '#9a3412', fontSize: '1rem' }}>🟠 Orange Alert (Be Prepared)</div>
                  <div style={{ fontSize: '0.78rem', color: '#7c2d12', margin: '0.5rem 0' }}>Precipitation: 64.5 – 115.5 mm / 24 hours</div>
                  <div style={{ fontSize: '0.75rem', color: '#4b5563', lineHeight: 1.4 }}>
                    Very heavy rainfall. Pre-position disaster relief teams. Keep relief camps ready in taluks.
                  </div>
                </div>

                <div style={{ padding: '1.25rem', borderRadius: '12px', background: '#fef2f2', border: '1.5px solid #fca5a5' }}>
                  <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '1rem' }}>🔴 Red Alert (Take Action)</div>
                  <div style={{ fontSize: '0.78rem', color: '#7f1d1d', margin: '0.5rem 0' }}>Precipitation: &gt; 115.5 mm / 24 hours</div>
                  <div style={{ fontSize: '0.75rem', color: '#4b5563', lineHeight: 1.4 }}>
                    Extremely heavy rainfall. High flood and landslide threat. Immediate evacuation in vulnerable zones.
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
        </>
      )}
      </div>
    </div>
  );
};

export default LiveWeather;
