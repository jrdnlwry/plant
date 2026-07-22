importScripts('/src/generated/plantRenderer.global.js', '/src/sharedPlantState.js');
const US_STATE_ABBREVIATIONS = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  DC: 'District of Columbia',
};

function normalizeComparison(value) {
  return String(value || '').trim().toLowerCase();
}

function parseCityState(location) {
  const trimmedLocation = String(location || '').trim();
  const match = trimmedLocation.match(/^(.+?),\s*([A-Za-z]{2}|[A-Za-z][A-Za-z .'-]+)$/);

  if (!match) {
    throw new Error('Enter location as "City, State" so local weather can be matched accurately.');
  }

  const city = match[1].trim();
  const stateInput = match[2].trim();
  const abbreviation = stateInput.toUpperCase();
  const state = US_STATE_ABBREVIATIONS[abbreviation] || stateInput.replace(/\s+/g, ' ');

  if (!city || !state) {
    throw new Error('Enter both a city and a U.S. state, like "Raleigh, NC".');
  }

  return { city, state };
}

async function fetchJson(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`Unable to reach weather service. Check your connection and retry. (${error.message || 'Network request failed'})`);
  }

  if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
  return response.json();
}

function selectMatchingPlace(results, city, state) {
  const normalizedCity = normalizeComparison(city);
  const normalizedState = normalizeComparison(state);
  const places = Array.isArray(results) ? results : [];

  return places.find((place) =>
    normalizeComparison(place.country_code) === 'us' &&
    normalizeComparison(place.admin1) === normalizedState &&
    normalizeComparison(place.name) === normalizedCity
  ) || places.find((place) =>
    normalizeComparison(place.country_code) === 'us' &&
    normalizeComparison(place.admin1) === normalizedState
  );
}

async function fetchRemoteWeatherForLocation(location) {
  const { city, state } = parseCityState(location);
  const params = new URLSearchParams({
    name: city,
    count: '10',
    language: 'en',
    format: 'json',
    countryCode: 'US',
  });
  const geo = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);
  const place = selectMatchingPlace(geo.results, city, state);

  if (!place) {
    throw new Error(`No U.S. weather location matched "${city}, ${state}". Check the city and state spelling.`);
  }

  const forecastParams = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day',
    daily: 'precipitation_sum,sunshine_duration',
    past_days: '3',
    forecast_days: '1',
    timezone: 'auto',
  });
  const forecast = await fetchJson(`https://api.open-meteo.com/v1/forecast?${forecastParams.toString()}`);
  const recentRain = (forecast.daily?.precipitation_sum || []).slice(-4).reduce((sum, value) => sum + Number(value || 0), 0);
  const recentSunHours = (forecast.daily?.sunshine_duration || []).slice(-4).reduce((sum, value) => sum + Number(value || 0) / 3600, 0);

  return {
    placeName: [place.name, place.admin1].filter(Boolean).join(', '),
    temperatureC: Number(forecast.current?.temperature_2m ?? 20),
    humidity: Number(forecast.current?.relative_humidity_2m ?? 50),
    precipitation: Number(forecast.current?.precipitation ?? 0),
    weatherCode: Number(forecast.current?.weather_code ?? 0),
    windSpeed: Number(forecast.current?.wind_speed_10m ?? 0),
    isDay: forecast.current?.is_day !== 0,
    recentRain,
    recentSunHours,
    fetchedAt: new Date().toISOString(),
  };
}


const OVERLAY_SCRIPT_FILES = ['src/generated/plantRenderer.global.js', 'src/sharedPlantState.js', 'src/content/injectPlant.js'];
const OVERLAY_CSS_FILES = ['src/content/overlay.css'];

function canInjectIntoTab(tab) {
  return Boolean(tab?.id) && (!tab.url || /^(https?:|file:)/.test(tab.url));
}

async function injectPlantOverlayIntoTab(tab) {
  if (!canInjectIntoTab(tab)) return false;

  try {
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: OVERLAY_CSS_FILES,
    }).catch(() => {});

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: OVERLAY_SCRIPT_FILES,
    });
    return true;
  } catch (error) {
    console.warn('Plant overlay injection failed:', error);
    return false;
  }
}

async function injectPlantOverlayIntoOpenTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.map((tab) => injectPlantOverlayIntoTab(tab)));
}

const WEATHER_ALARM_NAME = 'ambient-plant-weather-refresh';
const WEATHER_ALARM_MINUTES = 30;

let lifecycleQueue = Promise.resolve();
const inFlightLifecycleRequests = new Map();

function enqueueLifecycleMutation(key, operation) {
  if (key && inFlightLifecycleRequests.has(key)) return inFlightLifecycleRequests.get(key);
  const queued = lifecycleQueue.catch(() => undefined).then(operation);
  lifecycleQueue = queued.catch(() => undefined);
  if (key) {
    inFlightLifecycleRequests.set(key, queued);
    queued.then(
      () => inFlightLifecycleRequests.delete(key),
      () => inFlightLifecycleRequests.delete(key),
    );
  }
  return queued;
}

async function refreshStoredPlant(options = {}) {
  let state = await globalThis.PlantCompanionState.getStoredPlantState();
  if (!state) return { state: null, updated: false };

  const now = Date.now();
  const needsWeather = Boolean(options.force) || globalThis.PlantCompanionState.shouldRefreshWeather(state, now);
  const needsElapsedUpdate = now - Date.parse(state.updatedAt || state.createdAt) > 30 * 60 * 1000;
  if (!needsWeather && !needsElapsedUpdate) return { state, updated: false };

  let weather = state.weather;
  let weatherError = null;
  if (needsWeather) {
    try {
      weather = await fetchRemoteWeatherForLocation(state.location);
    } catch (error) {
      weatherError = error.message || 'Unable to fetch weather.';
    }
  }

  // A weather request can outlive its original read. Re-read before computing and
  // require the revision at save time, so a restarted worker cannot commit stale data.
  state = await globalThis.PlantCompanionState.getStoredPlantState();
  if (!state) return { state: null, updated: false, weatherError };
  const nextState = globalThis.PlantCompanionState.advancePlantState(state, weather, now);
  if (nextState === state || (nextState.updatedAt === state.updatedAt && nextState.weather === state.weather)) {
    return { state, updated: false, weatherError };
  }
  const saved = await globalThis.PlantCompanionState.savePlantState(nextState, { expectedRevision: state.revision });
  return { state: saved, updated: saved.revision !== state.revision, weatherError };
}

async function initializePlant({ plantType, location }) {
  const state = globalThis.PlantCompanionState.createInitialPlantState({ plantType, location });
  await chrome.storage.local.set({ ambientPlantState: state, ambientPlantPendingCompletion: null });
  return refreshStoredPlant({ force: true });
}

function handleLifecycleMessage(message) {
  if (message.type === 'PLANT_REQUEST_LIFECYCLE_UPDATE') {
    const key = message.force ? 'refresh:force' : 'refresh:normal';
    return enqueueLifecycleMutation(key, () => refreshStoredPlant({ force: Boolean(message.force) }));
  }
  if (message.type === 'PLANT_INITIALIZE') {
    return enqueueLifecycleMutation(null, () => initializePlant(message));
  }
  if (message.type === 'PLANT_COMPLETE_LIFECYCLE') {
    return enqueueLifecycleMutation(null, async () => ({
      completion: await globalThis.PlantCompanionState.completePlantLifecycle(message.decision),
    }));
  }
  return null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'PLANT_FETCH_WEATHER') {
    fetchRemoteWeatherForLocation(message.location)
      .then((weather) => sendResponse({ ok: true, weather }))
      .catch((error) => sendResponse({ ok: false, error: error.message || 'Unable to fetch weather.' }));
    return true;
  }

  const operation = message && handleLifecycleMessage(message);
  if (!operation) return false;
  operation
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error.message || 'Lifecycle update failed.' }));
  return true;
});

async function refreshStoredPlantFromAlarm() {
  return enqueueLifecycleMutation('refresh:normal', () => refreshStoredPlant());
}

function ensureWeatherAlarm() {
  chrome.alarms.create(WEATHER_ALARM_NAME, { periodInMinutes: WEATHER_ALARM_MINUTES });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureWeatherAlarm();
  injectPlantOverlayIntoOpenTabs().catch((error) => console.warn('Plant overlay reinjection failed:', error));
});
chrome.runtime.onStartup.addListener(() => {
  ensureWeatherAlarm();
  injectPlantOverlayIntoOpenTabs().catch((error) => console.warn('Plant overlay reinjection failed:', error));
});
ensureWeatherAlarm();
injectPlantOverlayIntoOpenTabs().catch((error) => console.warn('Plant overlay reinjection failed:', error));

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== WEATHER_ALARM_NAME) return;
  refreshStoredPlantFromAlarm().catch((error) => console.warn('Plant background weather refresh failed:', error));
});
