(() => {
  const STORAGE_KEY = 'ambientPlantState';
  const ARCHIVE_STORAGE_KEY = 'ambientPlantArchive';
  const COMPLETION_STORAGE_KEY = 'ambientPlantPendingCompletion';
  const RENDERER_VERSION = 'l-system-pixel-v2';
  const WEATHER_REFRESH_MS = 60 * 60 * 1000;
  const WEATHER_EFFECT_MIN_ELAPSED_MS = 60 * 1000;
  const WEATHER_FLOWER_MIN_RATIO = 0.5;
  const FLOWER_MIN_STAGE_BY_TYPE = { blossom: 4, vine: 4, succulent: 4, sapling: 4, fern: Infinity };
  const FLOWER_WEATHER_CHANCE_BY_TYPE = { blossom: 1, vine: 0.35, succulent: 0.2, sapling: 0.15, fern: 0 };
  const LIGHT_RAIN_MM = 0.25;
  const MODERATE_RAIN_MM = 4;
  const HEAVY_RAIN_MM = 12;
  const DAY_MS = 24 * 60 * 60 * 1000;

  const DEFAULT_PLANT_STATE = {
    plantType: 'fern',
    location: '',
    growthStage: 1,
    health: 85,
    hydration: 70,
    growthProgress: 0,
    flowerCount: 0,
    weatherMood: 'starting',
    weatherSummary: 'Waiting for local weather',
    weather: null,
    createdAt: null,
    updatedAt: null,
    weatherUpdatedAt: null,
    revision: 0,
  };

  const PLANT_TYPES = {
    fern: {
      label: 'Fern',
      stem: '#2f7d32',
      leaf: '#4caf50',
      highlight: '#8bcf5a',
      silhouette: 'frond',
      modules: { branches: 5, leavesPerBranch: 3, tendrils: 1, flowers: 0, canopy: 0, trunk: 0 },
    },
    succulent: {
      label: 'Succulent',
      stem: '#3f7f5f',
      leaf: '#66b889',
      highlight: '#a6d9a8',
      silhouette: 'rosette',
      modules: { branches: 0, leavesPerBranch: 8, tendrils: 0, flowers: 0, canopy: 0, trunk: 0 },
    },
    blossom: {
      label: 'Blossom',
      stem: '#2f7d32',
      leaf: '#5fbf5a',
      highlight: '#f06ca7',
      flower: '#f06ca7',
      silhouette: 'flower',
      modules: { branches: 3, leavesPerBranch: 2, tendrils: 0, flowers: 3, canopy: 0, trunk: 0 },
    },
    vine: {
      label: 'Vine',
      stem: '#2f7d32',
      leaf: '#59a846',
      highlight: '#a8d65f',
      silhouette: 'tendril',
      modules: { branches: 4, leavesPerBranch: 2, tendrils: 4, flowers: 1, canopy: 0, trunk: 0 },
    },
    sapling: {
      label: 'Sapling',
      stem: '#6b3f24',
      leaf: '#4caf50',
      highlight: '#8bcf5a',
      silhouette: 'canopy',
      modules: { branches: 3, leavesPerBranch: 1, tendrils: 0, flowers: 0, canopy: 5, trunk: 1 },
    },
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(Number(value) || 0, min), max);
  }

  function hashString(value) {
    return String(value || '').split('').reduce((hash, char) => {
      const nextHash = (hash << 5) - hash + char.charCodeAt(0);
      return nextHash >>> 0;
    }, 2166136261);
  }

  function createRng(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, options) {
    return options[Math.floor(rng() * options.length)];
  }

  function createPlantId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `plant-${Date.now().toString(36)}-${Math.floor(Math.random() * 0x100000000).toString(36)}`;
  }

  function createVisualSeed(plantId) {
    if (globalThis.crypto?.getRandomValues) {
      const values = new Uint32Array(1);
      globalThis.crypto.getRandomValues(values);
      return values[0];
    }
    return hashString(`${plantId}|${Date.now()}|${Math.random()}`);
  }

  function cloneStoredValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizePlantState(state = {}) {
    const now = new Date().toISOString();
    const plantType = PLANT_TYPES[state.plantType] ? state.plantType : DEFAULT_PLANT_STATE.plantType;
    const createdAt = state.createdAt || now;
    const plantId = typeof state.plantId === 'string' && state.plantId ? state.plantId : createPlantId();
    const location = typeof state.location === 'string' ? state.location.trim() : '';
    const seed = Number.isFinite(Number(state.seed))
      ? Number(state.seed) >>> 0
      : 0;

    return {
      ...DEFAULT_PLANT_STATE,
      ...state,
      plantType,
      plantId,
      seed,
      revision: Math.max(0, Math.floor(Number(state.revision) || 0)),
      location,
      growthStage: clamp(state.growthStage ?? DEFAULT_PLANT_STATE.growthStage, 1, 4),
      health: clamp(state.health ?? DEFAULT_PLANT_STATE.health, 0, 100),
      hydration: clamp(state.hydration ?? DEFAULT_PLANT_STATE.hydration, 0, 100),
      growthProgress: clamp(state.growthProgress ?? DEFAULT_PLANT_STATE.growthProgress, 0, 100),
      flowerCount: clamp(state.flowerCount ?? DEFAULT_PLANT_STATE.flowerCount, 0, 5),
      weatherMood: typeof state.weatherMood === 'string' ? state.weatherMood : DEFAULT_PLANT_STATE.weatherMood,
      weatherSummary: typeof state.weatherSummary === 'string' ? state.weatherSummary : DEFAULT_PLANT_STATE.weatherSummary,
      weather: state.weather && typeof state.weather === 'object' ? state.weather : null,
      createdAt: state.createdAt || now,
      updatedAt: state.updatedAt || now,
      weatherUpdatedAt: state.weatherUpdatedAt || null,
    };
  }

  function getStoredPlantState() {
    return chrome.storage.local.get(STORAGE_KEY).then((result) => {
      const state = result[STORAGE_KEY];
      if (!state) return null;
      const normalized = normalizePlantState(state);
      if (!state.plantId || !Number.isFinite(Number(state.seed)) || !Number.isFinite(Number(state.revision))) {
        return chrome.storage.local.set({ [STORAGE_KEY]: normalized }).then(() => normalized);
      }
      return normalized;
    });
  }

  function isPlantLifecycleComplete(plant) {
    const state = normalizePlantState(plant);
    return state.growthStage === 4 && state.growthProgress >= 100;
  }

  async function getPendingLifecycleCompletion() {
    const result = await chrome.storage.local.get(COMPLETION_STORAGE_KEY);
    return result[COMPLETION_STORAGE_KEY] || null;
  }

  async function getPlantArchive() {
    const result = await chrome.storage.local.get(ARCHIVE_STORAGE_KEY);
    return Array.isArray(result[ARCHIVE_STORAGE_KEY])
      ? cloneStoredValue(result[ARCHIVE_STORAGE_KEY])
      : [];
  }

  async function savePlantState(nextState, options = {}) {
    const candidate = normalizePlantState(nextState);
    const storedState = await getStoredPlantState();
    if (storedState && storedState.plantId !== candidate.plantId) return storedState;

    const expectedRevision = options.expectedRevision ?? candidate.revision;
    if (storedState && storedState.revision !== expectedRevision) return storedState;

    const state = normalizePlantState({
      ...candidate,
      revision: (storedState?.revision ?? expectedRevision) + 1,
      updatedAt: options.updatedAt || candidate.updatedAt || new Date().toISOString(),
    });
    if (!isPlantLifecycleComplete(state)) {
      await chrome.storage.local.set({ [STORAGE_KEY]: state });
      return state;
    }
    const pending = await getPendingLifecycleCompletion();
    const completion = pending?.plantId === state.plantId
      ? pending
      : {
          plantId: state.plantId,
          completedAt: state.updatedAt,
          snapshot: toRenderablePlantSnapshot(state),
        };
    await chrome.storage.local.set({
      [STORAGE_KEY]: state,
      [COMPLETION_STORAGE_KEY]: completion,
    });
    return state;
  }

  function createInitialPlantState({ plantType, location }) {
    const now = new Date().toISOString();
    const plantId = createPlantId();
    return normalizePlantState({
      plantId,
      plantType,
      location,
      seed: createVisualSeed(plantId),
      revision: 0,
      growthStage: 1,
      health: 85,
      hydration: 70,
      growthProgress: 0,
      flowerCount: 0,
      weatherMood: 'starting',
      weatherSummary: 'Weather will update after setup.',
      createdAt: now,
      updatedAt: now,
    });
  }

  async function completePlantLifecycle(decision) {
    if (decision !== 'community-garden' && decision !== 'private') {
      throw new TypeError('Invalid lifecycle completion decision.');
    }
    const [plant, pending, archive] = await Promise.all([
      getStoredPlantState(),
      getPendingLifecycleCompletion(),
      getPlantArchive(),
    ]);
    if (!plant || !pending || pending.plantId !== plant.plantId || !isPlantLifecycleComplete(plant)) return null;

    const archivedAt = new Date().toISOString();
    const archivedPlant = {
      plantId: plant.plantId,
      completedAt: pending.completedAt,
      archivedAt,
      decision,
      snapshot: pending.snapshot || toRenderablePlantSnapshot(plant),
    };
    const nextPlant = createInitialPlantState({ plantType: plant.plantType, location: plant.location });
    await chrome.storage.local.set({
      [STORAGE_KEY]: nextPlant,
      [ARCHIVE_STORAGE_KEY]: [...archive, archivedPlant],
      [COMPLETION_STORAGE_KEY]: null,
    });
    return { archivedPlant: cloneStoredValue(archivedPlant), nextPlant };
  }

  function shouldRefreshWeather(state, now = Date.now()) {
    if (!state.location) return false;
    if (!state.weather) return true;
    const weatherFetchedAt = state.weather.fetchedAt || state.weatherUpdatedAt;
    if (!weatherFetchedAt) return true;
    return now - Date.parse(weatherFetchedAt) > WEATHER_REFRESH_MS;
  }

  function fetchWeatherForLocation(location) {
    return chrome.runtime.sendMessage({ type: 'PLANT_FETCH_WEATHER', location }).then((response) => {
      if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError.message);
      if (!response?.ok) throw new Error(response?.error || 'Unable to fetch weather.');
      return response.weather;
    });
  }

  function getRainfallAmount(weather) {
    if (!weather) return 0;
    return Math.max(Number(weather.recentRain || 0), Number(weather.precipitation || 0));
  }

  function getRainIntensity(weather) {
    const rainfall = getRainfallAmount(weather);
    if (rainfall >= HEAVY_RAIN_MM) return 'heavy';
    if (rainfall >= MODERATE_RAIN_MM) return 'moderate';
    if (rainfall >= LIGHT_RAIN_MM) return 'light';
    return 'none';
  }

  function describeWeather(weather) {
    if (!weather) return 'No weather yet';
    const rainIntensity = getRainIntensity(weather);
    if (rainIntensity === 'heavy') return 'Heavy rain gave it a strong drink';
    if (rainIntensity === 'moderate') return 'Rain is steadily rehydrating it';
    if (rainIntensity === 'light') return 'Light rain helped a little';
    if (weather.temperatureC >= 31) return 'Heat stress is drying the leaves';
    if (weather.windSpeed >= 25) return 'Wind is nudging the branches';
    if (weather.recentSunHours >= 18 && weather.temperatureC >= 16 && weather.temperatureC <= 29) return 'Ideal sun is helping new growth';
    if ([45, 48, 51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weather.weatherCode) || weather.recentSunHours < 8) return 'Cloudy weather is slowing expansion';
    return 'Steady weather keeps it growing';
  }

  function advancePlantState(stateInput, weather = stateInput.weather, now = Date.now()) {
    const state = normalizePlantState(stateInput);
    if (isPlantLifecycleComplete(state)) return state;
    const elapsedDays = clamp((now - Date.parse(state.updatedAt || state.createdAt)) / DAY_MS, 0, 7);
    if (elapsedDays <= 0 && weather === state.weather) return state;

    let hydrationDelta = -8 * elapsedDays;
    let healthDelta = -1.5 * elapsedDays;
    let growthDelta = 5 * elapsedDays;
    let mood = 'steady';
    let weatherEffectRatio = 0;

    if (weather) {
      const previousWeatherTime = Date.parse(state.weatherUpdatedAt || state.updatedAt || state.createdAt);
      const elapsedWeatherMs = now - previousWeatherTime;
      const elapsedWeatherRatio = state.weatherUpdatedAt
        ? (elapsedWeatherMs >= WEATHER_EFFECT_MIN_ELAPSED_MS ? clamp(elapsedWeatherMs / WEATHER_REFRESH_MS, 0, 1) : 0)
        : 1;
      weatherEffectRatio = elapsedWeatherRatio;
      const rainIntensity = getRainIntensity(weather);
      if (rainIntensity !== 'none') {
        const rainfall = getRainfallAmount(weather);
        const rainRatio = clamp((rainfall - LIGHT_RAIN_MM) / (HEAVY_RAIN_MM - LIGHT_RAIN_MM), 0, 1);
        const drynessRatio = clamp((50 - state.hydration) / 50, 0, 1);
        hydrationDelta += (8 + rainRatio * 28 + drynessRatio * rainRatio * 14) * elapsedWeatherRatio;
        healthDelta += (2 + rainRatio * 7) * elapsedWeatherRatio;
        growthDelta += (2 + rainRatio * 8) * elapsedWeatherRatio;
        mood = 'rainy';
      }
      if (weather.temperatureC >= 31) {
        hydrationDelta -= 16 * elapsedWeatherRatio;
        healthDelta -= 8 * elapsedWeatherRatio;
        growthDelta -= 3 * elapsedWeatherRatio;
        mood = 'hot';
      }
      if (weather.recentSunHours >= 18 && weather.temperatureC >= 16 && weather.temperatureC <= 29) {
        healthDelta += 4 * elapsedWeatherRatio;
        growthDelta += 12 * elapsedWeatherRatio;
        mood = 'sunny';
      }
      if (weather.windSpeed >= 25) mood = mood === 'steady' ? 'windy' : mood;
      if (weather.recentSunHours < 8 && weather.recentRain < 3) {
        growthDelta -= 4 * elapsedWeatherRatio;
        mood = mood === 'steady' ? 'cloudy' : mood;
      }
    }

    const hydration = clamp(state.hydration + hydrationDelta, 0, 100);
    const health = clamp(state.health + healthDelta + (hydration < 25 ? -6 * elapsedDays : 0), 0, 100);
    let growthProgress = clamp(state.growthProgress + Math.max(0, growthDelta) * (health / 100), 0, 100);
    let growthStage = state.growthStage;
    if (growthProgress >= 100 && growthStage < 4) {
      growthStage += 1;
      growthProgress -= 100;
    }
    const flowerMinStage = FLOWER_MIN_STAGE_BY_TYPE[state.plantType] ?? 4;
    const flowerChance = FLOWER_WEATHER_CHANCE_BY_TYPE[state.plantType] ?? 0;
    const flowerRng = createRng(state.seed + growthStage * 4099 + Math.floor(now / DAY_MS));
    const canAddFlower = growthStage >= flowerMinStage
      && mood === 'sunny'
      && health > 70
      && weatherEffectRatio >= WEATHER_FLOWER_MIN_RATIO
      && flowerRng() < flowerChance;
    const flowerCount = clamp(state.flowerCount + (canAddFlower ? 1 : 0) - (health < 35 ? 1 : 0), 0, 5);

    return normalizePlantState({
      ...state,
      hydration,
      health,
      growthProgress,
      growthStage,
      flowerCount,
      weather,
      weatherMood: mood,
      weatherSummary: describeWeather(weather),
      weatherUpdatedAt: weatherEffectRatio > 0 || weather?.fetchedAt !== state.weather?.fetchedAt
        ? new Date(now).toISOString()
        : state.weatherUpdatedAt,
      updatedAt: new Date(now).toISOString(),
    });
  }

  async function refreshPlantStateForWeather(options = {}) {
    const state = await getStoredPlantState();
    if (!state) return null;
    let weather = state.weather;
    const needsWeather = Boolean(options.force) || shouldRefreshWeather(state);
    const needsElapsedUpdate = Date.now() - Date.parse(state.updatedAt || state.createdAt) > 30 * 60 * 1000;
    if (!needsWeather && !needsElapsedUpdate) return state;
    if (needsWeather) weather = await fetchWeatherForLocation(state.location);
    return savePlantState(advancePlantState(state, weather));
  }

  function toRenderablePlantSnapshot(extensionState) {
    const renderer = globalThis.PlantCompanionRenderer;
    if (!renderer) throw new Error('Plant renderer adapter is not loaded.');
    if (!extensionState || typeof extensionState !== 'object' || Array.isArray(extensionState)) {
      throw new TypeError('Invalid legacy plant state.');
    }

    const hasSchemaVersion = Object.prototype.hasOwnProperty.call(extensionState, 'schemaVersion');
    const hasRendererVersion = Object.prototype.hasOwnProperty.call(extensionState, 'rendererVersion');
    if (hasSchemaVersion && extensionState.schemaVersion !== renderer.plantStateVersion) {
      throw new Error(`Unsupported plant state schema version: ${String(extensionState.schemaVersion)}`);
    }
    if (hasRendererVersion && extensionState.rendererVersion !== renderer.rendererVersion) {
      throw new Error(`Unsupported plant renderer version: ${String(extensionState.rendererVersion)}`);
    }
    if (!PLANT_TYPES[extensionState.plantType] || typeof extensionState.location !== 'string') {
      throw new TypeError('Invalid legacy plant state.');
    }

    // Seedless extension data historically rendered with RNG seed zero. Preserve
    // that appearance rather than applying the package's general hash fallback.
    const migrationInput = {
      ...extensionState,
      seed: Number.isFinite(Number(extensionState.seed)) ? Number(extensionState.seed) >>> 0 : 0,
    };
    const snapshot = renderer.normalizePlantStateSnapshot(migrationInput);
    if (!renderer.isPlantStateSnapshot(snapshot)) throw new TypeError('Invalid plant state snapshot.');
    return snapshot;
  }

  function renderPlantSvgFromExtensionState(extensionState) {
    const renderer = globalThis.PlantCompanionRenderer;
    if (!renderer) throw new Error('Plant renderer adapter is not loaded.');
    const snapshot = toRenderablePlantSnapshot(extensionState);
    const compatibility = renderer.checkRenderCompatibility(snapshot);
    if (!compatibility.supported) throw new Error(`Cannot render plant: ${compatibility.reason}`);
    return renderer.renderPlantSvg(snapshot);
  }

  const api = {
    RENDERER_VERSION,
    DEFAULT_PLANT_STATE,
    PLANT_TYPES,
    FLOWER_MIN_STAGE_BY_TYPE,
    isPlantLifecycleComplete,
    getPendingLifecycleCompletion,
    getPlantArchive,
    completePlantLifecycle,
    getStoredPlantState,
    savePlantState,
    createInitialPlantState,
    normalizePlantState,
    shouldRefreshWeather,
    fetchWeatherForLocation,
    getRainfallAmount,
    getRainIntensity,
    advancePlantState,
    refreshPlantStateForWeather,
    toRenderablePlantSnapshot,
    renderPlantSvg: renderPlantSvgFromExtensionState,
  };

  globalThis.PlantCompanionState = api;
  if (typeof window !== 'undefined') window.PlantCompanionState = api;
})();
