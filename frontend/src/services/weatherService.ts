/**
 * Open-Meteo Live Weather & Flood Hydrology Service
 *
 * Provides real-time weather observations, 7-day rainfall forecasts,
 * IMD/KSDMA rainfall risk classification, and GloFAS river discharge rates.
 * No API key required (Open-Meteo open license).
 */

export interface DistrictCoords {
  lat: number;
  lon: number;
  name: string;
}

export const KERALA_DISTRICTS: Record<string, DistrictCoords> = {
  thiruvananthapuram: { lat: 8.5241, lon: 76.9366, name: 'Thiruvananthapuram' },
  kollam: { lat: 8.8932, lon: 76.6141, name: 'Kollam' },
  pathanamthitta: { lat: 9.2648, lon: 76.7870, name: 'Pathanamthitta' },
  alappuzha: { lat: 9.4981, lon: 76.3388, name: 'Alappuzha' },
  kottayam: { lat: 9.5916, lon: 76.5222, name: 'Kottayam' },
  idukki: { lat: 9.8500, lon: 76.9700, name: 'Idukki' },
  ernakulam: { lat: 9.9816, lon: 76.2999, name: 'Ernakulam' },
  thrissur: { lat: 10.5276, lon: 76.2144, name: 'Thrissur' },
  palakkad: { lat: 10.7867, lon: 76.6548, name: 'Palakkad' },
  malappuram: { lat: 11.0732, lon: 76.0740, name: 'Malappuram' },
  kozhikode: { lat: 11.2588, lon: 75.7804, name: 'Kozhikode' },
  wayanad: { lat: 11.6854, lon: 76.1320, name: 'Wayanad' },
  kannur: { lat: 11.8745, lon: 75.3704, name: 'Kannur' },
  kasaragod: { lat: 12.5102, lon: 74.9852, name: 'Kasaragod' },
};

export interface WeatherCodeInfo {
  description: string;
  icon: string;
  category: 'CLEAR' | 'CLOUDY' | 'RAIN' | 'STORM' | 'FOG';
}

/**
 * Standard WMO Weather interpretation codes
 */
export function getWeatherCodeInfo(code: number): WeatherCodeInfo {
  if (code === 0) return { description: 'Clear Sky', icon: '☀️', category: 'CLEAR' };
  if (code === 1) return { description: 'Mainly Clear', icon: '🌤️', category: 'CLEAR' };
  if (code === 2) return { description: 'Partly Cloudy', icon: '⛅', category: 'CLOUDY' };
  if (code === 3) return { description: 'Overcast', icon: '☁️', category: 'CLOUDY' };
  if ([45, 48].includes(code)) return { description: 'Fog / Mist', icon: '🌫️', category: 'FOG' };
  if ([51, 53, 55].includes(code)) return { description: 'Light Drizzle', icon: '🌦️', category: 'RAIN' };
  if ([56, 57].includes(code)) return { description: 'Freezing Drizzle', icon: '🌧️', category: 'RAIN' };
  if ([61, 63].includes(code)) return { description: 'Moderate Rain', icon: '🌧️', category: 'RAIN' };
  if (code === 65) return { description: 'Heavy Rain', icon: '⛈️', category: 'RAIN' };
  if ([80, 81].includes(code)) return { description: 'Rain Showers', icon: '🌦️', category: 'RAIN' };
  if (code === 82) return { description: 'Violent Rain Showers', icon: '⛈️', category: 'STORM' };
  if ([95, 96, 99].includes(code)) return { description: 'Thunderstorm', icon: '⚡', category: 'STORM' };
  return { description: 'Variable Weather', icon: '🌤️', category: 'CLOUDY' };
}

export interface RainfallAlert {
  level: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  label: string;
  badgeColor: string;
  textColor: string;
  advice: string;
}

/**
 * Official IMD / KSDMA 24h Rainfall Alert Thresholds
 */
export function getRainfallAlert(rainfallMm: number): RainfallAlert {
  if (rainfallMm >= 115.5) {
    return {
      level: 'RED',
      label: 'Red Alert (Extremely Heavy Rain >115mm)',
      badgeColor: '#dc2626',
      textColor: '#ffffff',
      advice: 'High flood probability. Activate Emergency Operations Centre & pre-position rescue teams.',
    };
  }
  if (rainfallMm >= 64.5) {
    return {
      level: 'ORANGE',
      label: 'Orange Alert (Heavy Rain 64.5 - 115.5mm)',
      badgeColor: '#ea580c',
      textColor: '#ffffff',
      advice: 'Significant runoff expected. Alert taluk control rooms and monitor low-lying bunds.',
    };
  }
  if (rainfallMm >= 15.6) {
    return {
      level: 'YELLOW',
      label: 'Yellow Alert (Moderate Rain 15.6 - 64.4mm)',
      badgeColor: '#eab308',
      textColor: '#713f12',
      advice: 'Standard rainfall surveillance. Monitor river gauge telemetry at key bridges.',
    };
  }
  return {
    level: 'GREEN',
    label: 'Green / Normal (<15.5mm)',
    badgeColor: '#10b981',
    textColor: '#ffffff',
    advice: 'Normal seasonal weather conditions. Routine hydrological surveillance active.',
  };
}

export interface CurrentWeather {
  time: string;
  temperature: number;
  humidity: number;
  apparentTemp: number;
  precipitation: number;
  rain: number;
  weatherCode: number;
  windSpeed: number;
  windDirection: number;
}

export interface DailyForecast {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
  precipitationProb: number;
  windSpeedMax: number;
}

export interface HourlyForecast {
  time: string;
  temp: number;
  rain: number;
  prob: number;
  code: number;
}

export interface DistrictWeatherReport {
  district: string;
  current: CurrentWeather;
  daily: DailyForecast[];
  hourly: HourlyForecast[];
  alert: RainfallAlert;
  weatherInfo: WeatherCodeInfo;
}

export interface RiverDischargeReport {
  district: string;
  dates: string[];
  discharge: number[];
  dischargeMean: number[];
  dischargeMax: number[];
  peakDischarge: number;
  status: 'NORMAL' | 'ELEVATED' | 'HIGH_SURGE';
}

// In-memory cache for fast tab-switching (valid for 5 minutes)
const weatherCache = new Map<string, { timestamp: number; data: DistrictWeatherReport }>();
const dischargeCache = new Map<string, { timestamp: number; data: RiverDischargeReport }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function resolveCoords(districtNameOrId?: string | number): DistrictCoords {
  if (!districtNameOrId) return KERALA_DISTRICTS.thiruvananthapuram;

  const key = String(districtNameOrId).toLowerCase().replace(/ district| \[demo\]/g, '').trim();
  for (const [k, v] of Object.entries(KERALA_DISTRICTS)) {
    if (key.includes(k) || k.includes(key)) {
      return v;
    }
  }
  return KERALA_DISTRICTS.thiruvananthapuram;
}

/**
 * Fetch live weather + 7-day forecast from Open-Meteo
 */
export async function fetchDistrictWeather(districtNameOrId?: string | number): Promise<DistrictWeatherReport> {
  const coords = resolveCoords(districtNameOrId);
  const cacheKey = coords.name.toLowerCase();

  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=Asia%2FKolkata&forecast_days=7`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo weather API returned status ${res.status}`);
  }

  const data = await res.json();
  const currentRaw = data.current || {};
  const dailyRaw = data.daily || {};
  const hourlyRaw = data.hourly || {};

  const current: CurrentWeather = {
    time: currentRaw.time || new Date().toISOString(),
    temperature: currentRaw.temperature_2m ?? 27.0,
    humidity: currentRaw.relative_humidity_2m ?? 80,
    apparentTemp: currentRaw.apparent_temperature ?? 30.0,
    precipitation: currentRaw.precipitation ?? 0.0,
    rain: currentRaw.rain ?? 0.0,
    weatherCode: currentRaw.weather_code ?? 0,
    windSpeed: currentRaw.wind_speed_10m ?? 0.0,
    windDirection: currentRaw.wind_direction_10m ?? 0,
  };

  const daily: DailyForecast[] = (dailyRaw.time || []).map((dateStr: string, idx: number) => ({
    date: dateStr,
    weatherCode: dailyRaw.weather_code?.[idx] ?? 0,
    tempMax: dailyRaw.temperature_2m_max?.[idx] ?? 30,
    tempMin: dailyRaw.temperature_2m_min?.[idx] ?? 24,
    precipitationSum: dailyRaw.precipitation_sum?.[idx] ?? 0,
    precipitationProb: dailyRaw.precipitation_probability_max?.[idx] ?? 0,
    windSpeedMax: dailyRaw.wind_speed_10m_max?.[idx] ?? 10,
  }));

  // Next 24 hours of hourly data
  const nowHour = new Date().getHours();
  const hourly: HourlyForecast[] = (hourlyRaw.time || []).slice(nowHour, nowHour + 24).map((timeStr: string, idx: number) => ({
    time: timeStr.split('T')[1]?.slice(0, 5) || `${idx}:00`,
    temp: hourlyRaw.temperature_2m?.[nowHour + idx] ?? 27,
    rain: hourlyRaw.precipitation?.[nowHour + idx] ?? 0,
    prob: hourlyRaw.precipitation_probability?.[nowHour + idx] ?? 0,
    code: hourlyRaw.weather_code?.[nowHour + idx] ?? 0,
  }));

  const maxExpectedRain = Math.max(current.precipitation * 24, daily[0]?.precipitationSum || 0);
  const alert = getRainfallAlert(maxExpectedRain);
  const weatherInfo = getWeatherCodeInfo(current.weatherCode);

  const report: DistrictWeatherReport = {
    district: coords.name,
    current,
    daily,
    hourly,
    alert,
    weatherInfo,
  };

  weatherCache.set(cacheKey, { timestamp: Date.now(), data: report });
  return report;
}

/**
 * Fetch river discharge forecast from Open-Meteo Global Flood API (GloFAS)
 */
export async function fetchRiverDischarge(districtNameOrId?: string | number): Promise<RiverDischargeReport> {
  const coords = resolveCoords(districtNameOrId);
  const cacheKey = coords.name.toLowerCase();

  const cached = dischargeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const url = `https://flood-api.open-meteo.com/v1/flood?latitude=${coords.lat}&longitude=${coords.lon}&daily=river_discharge,river_discharge_mean,river_discharge_max&forecast_days=7`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo Flood API returned status ${res.status}`);
  }

  const data = await res.json();
  const dailyRaw = data.daily || {};
  const dates: string[] = dailyRaw.time || [];
  const discharge: number[] = dailyRaw.river_discharge || [];
  const dischargeMean: number[] = dailyRaw.river_discharge_mean || [];
  const dischargeMax: number[] = dailyRaw.river_discharge_max || [];

  const peakDischarge = Math.max(...(dischargeMax.length > 0 ? dischargeMax : [0]));
  let status: 'NORMAL' | 'ELEVATED' | 'HIGH_SURGE' = 'NORMAL';
  if (peakDischarge > 30.0) status = 'HIGH_SURGE';
  else if (peakDischarge > 15.0) status = 'ELEVATED';

  const report: RiverDischargeReport = {
    district: coords.name,
    dates,
    discharge,
    dischargeMean,
    dischargeMax,
    peakDischarge,
    status,
  };

  dischargeCache.set(cacheKey, { timestamp: Date.now(), data: report });
  return report;
}

export interface RadarFrame {
  time: number;
  path: string;
}

export interface RadarData {
  host: string;
  radarFrames: RadarFrame[];
  satelliteFrames: RadarFrame[];
  generated: number;
}

/**
 * Fetch real-time RainViewer Doppler radar animation frames
 */
export async function fetchRadarFrames(): Promise<RadarData> {
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
  if (!res.ok) {
    throw new Error(`RainViewer API returned status ${res.status}`);
  }
  const data = await res.json();
  const host = data.host || 'https://tilecache.rainviewer.com';
  const radarFrames: RadarFrame[] = [
    ...(data.radar?.past || []),
    ...(data.radar?.nowcast || []),
  ];
  const satelliteFrames: RadarFrame[] = data.satellite?.infrared || [];

  return {
    host,
    radarFrames,
    satelliteFrames,
    generated: data.generated || Math.floor(Date.now() / 1000),
  };
}
