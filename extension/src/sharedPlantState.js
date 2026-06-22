(() => {
  const STORAGE_KEY = 'ambientPlantState';
  const WEATHER_REFRESH_MS = 60 * 60 * 1000;
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

  function normalizePlantState(state = {}) {
    const now = new Date().toISOString();
    const plantType = PLANT_TYPES[state.plantType] ? state.plantType : DEFAULT_PLANT_STATE.plantType;
    const createdAt = state.createdAt || now;
    const location = typeof state.location === 'string' ? state.location.trim() : '';
    const seed = Number.isFinite(Number(state.seed))
      ? Number(state.seed) >>> 0
      : hashString(`${plantType}|${location}|${createdAt}`);

    return {
      ...DEFAULT_PLANT_STATE,
      ...state,
      plantType,
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
      return state ? normalizePlantState(state) : null;
    });
  }

  function savePlantState(nextState) {
    const state = normalizePlantState({ ...nextState, updatedAt: new Date().toISOString() });
    return chrome.storage.local.set({ [STORAGE_KEY]: state }).then(() => state);
  }

  function createInitialPlantState({ plantType, location }) {
    const now = new Date().toISOString();
    return normalizePlantState({
      plantType,
      location,
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

  function shouldRefreshWeather(state, now = Date.now()) {
    if (!state.location) return false;
    if (!state.weather || !state.weatherUpdatedAt) return true;
    return now - Date.parse(state.weatherUpdatedAt) > WEATHER_REFRESH_MS;
  }

  function fetchWeatherForLocation(location) {
    return chrome.runtime.sendMessage({ type: 'PLANT_FETCH_WEATHER', location }).then((response) => {
      if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError.message);
      if (!response?.ok) throw new Error(response?.error || 'Unable to fetch weather.');
      return response.weather;
    });
  }

  function describeWeather(weather) {
    if (!weather) return 'No weather yet';
    if (weather.recentRain >= 8 || weather.precipitation > 0) return 'Recent rain perked it up';
    if (weather.temperatureC >= 31) return 'Heat stress is drying the leaves';
    if (weather.windSpeed >= 25) return 'Wind is nudging the branches';
    if (weather.recentSunHours >= 18 && weather.temperatureC >= 16 && weather.temperatureC <= 29) return 'Ideal sun is helping new growth';
    if ([45, 48, 51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weather.weatherCode) || weather.recentSunHours < 8) return 'Cloudy weather is slowing expansion';
    return 'Steady weather keeps it growing';
  }

  function advancePlantState(stateInput, weather = stateInput.weather, now = Date.now()) {
    const state = normalizePlantState(stateInput);
    const elapsedDays = clamp((now - Date.parse(state.updatedAt || state.createdAt)) / DAY_MS, 0, 7);
    if (elapsedDays <= 0 && weather === state.weather) return state;

    let hydrationDelta = -8 * elapsedDays;
    let healthDelta = -1.5 * elapsedDays;
    let growthDelta = 5 * elapsedDays;
    let mood = 'steady';

    if (weather) {
      if (weather.recentRain >= 8 || weather.precipitation > 0) {
        hydrationDelta += 28;
        healthDelta += 6;
        growthDelta += 6;
        mood = 'rainy';
      }
      if (weather.temperatureC >= 31) {
        hydrationDelta -= 16;
        healthDelta -= 8;
        growthDelta -= 3;
        mood = 'hot';
      }
      if (weather.recentSunHours >= 18 && weather.temperatureC >= 16 && weather.temperatureC <= 29) {
        healthDelta += 4;
        growthDelta += 12;
        mood = 'sunny';
      }
      if (weather.windSpeed >= 25) mood = mood === 'steady' ? 'windy' : mood;
      if (weather.recentSunHours < 8 && weather.recentRain < 3) {
        growthDelta -= 4;
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
    const flowerCount = clamp(state.flowerCount + (mood === 'sunny' && health > 70 ? 1 : 0) - (health < 35 ? 1 : 0), 0, 5);

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
      weatherUpdatedAt: weather?.fetchedAt || state.weatherUpdatedAt,
      updatedAt: new Date(now).toISOString(),
    });
  }

  async function refreshPlantStateForWeather() {
    const state = await getStoredPlantState();
    if (!state) return null;
    let weather = state.weather;
    const needsWeather = shouldRefreshWeather(state);
    const needsElapsedUpdate = Date.now() - Date.parse(state.updatedAt || state.createdAt) > 30 * 60 * 1000;
    if (!needsWeather && !needsElapsedUpdate) return state;
    if (needsWeather) weather = await fetchWeatherForLocation(state.location);
    return savePlantState(advancePlantState(state, weather));
  }

  function escapeAttribute(value) {
    return String(value).replace(/[&"<>]/g, (char) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[char]);
  }

  function rect(x, y, width, height, fill, extra = '') {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" ${extra}/>`;
  }

  function leaf(x, y, width, height, fill, highlight, outline, direction, droop, lean = 0) {
    const endY = y + droop;
    const lx = x + lean;
    const bodyX = direction === 'left' ? lx : lx + 1;
    const tipX = direction === 'left' ? lx - 1 : lx + width - 1;
    return [
      rect(Math.min(tipX, lx), endY, width + 1, 1, outline),
      rect(lx, endY + 1, width, height, outline),
      rect(bodyX, endY + 1, width - 1, height - 1, fill),
      rect(direction === 'left' ? lx : lx + width - 2, endY + 1, 2, 1, highlight),
    ].join('');
  }

  function flower(x, y, petal, outline) {
    return `${rect(x + 1, y, 2, 1, outline)}${rect(x, y + 1, 4, 2, outline)}${rect(x + 1, y + 1, 2, 2, petal)}${rect(x + 1, y + 2, 1, 1, '#f7d35b')}`;
  }

  function renderPlantSvg(stateInput) {
    const state = normalizePlantState(stateInput);
    const preset = PLANT_TYPES[state.plantType];
    const rng = createRng(state.seed + Math.round(state.growthStage) * 997);
    const stage = Math.round(state.growthStage);
    const healthRatio = state.health / 100;
    const hydrationRatio = state.hydration / 100;
    const weather = state.weather || {};
    const isHot = state.weatherMood === 'hot';
    const isRainy = state.weatherMood === 'rainy';
    const isSunny = state.weatherMood === 'sunny';
    const isCloudy = state.weatherMood === 'cloudy';
    const lean = weather.windSpeed >= 25 ? (weather.windSpeed >= 40 ? 2 : 1) : 0;
    const droop = Math.round((1 - hydrationRatio) * 4) + (isHot ? 1 : 0) - (isRainy ? 1 : 0);
    const stemTop = 22 - stage * 4 + Math.round((1 - healthRatio) * 2) + (isCloudy ? 1 : 0);
    const stemHeight = 22 - stemTop;
    const leafFill = isHot || hydrationRatio < 0.35 ? '#86a85a' : isRainy ? '#55c767' : preset.leaf;
    const highlight = isCloudy ? '#7fae68' : isSunny ? '#b6e66b' : preset.highlight;
    const stemFill = healthRatio < 0.35 ? '#777a45' : preset.stem;
    const outline = healthRatio < 0.35 ? '#4f5133' : '#1f3b24';
    const opacity = (0.55 + healthRatio * 0.45).toFixed(2);
    const leaves = [];
    const extraClusters = (isRainy || isSunny) && stage >= 2 ? 1 : 0;

    if (preset.silhouette === 'rosette') {
      leaves.push(leaf(10, 15, 6 + stage + extraClusters, 3, leafFill, highlight, outline, 'left', droop, -lean));
      leaves.push(leaf(16, 14, 6 + stage + extraClusters, 3, leafFill, highlight, outline, 'right', droop, lean));
      leaves.push(leaf(12, 11, 5 + stage, 3, leafFill, highlight, outline, 'left', droop, -lean));
      leaves.push(leaf(15, 10, 5 + stage, 3, leafFill, highlight, outline, 'right', droop, lean));
      if (stage >= 3) leaves.push(leaf(13, 8, 4 + stage, 3, leafFill, highlight, outline, 'right', droop, lean));
    } else {
      leaves.push(leaf(7 - stage, stemTop + 3, 6 + stage + extraClusters, 3, leafFill, highlight, outline, 'left', droop, -lean));
      leaves.push(leaf(18, stemTop + 2, 6 + stage + extraClusters, 3, leafFill, highlight, outline, 'right', droop, lean));
      if (stage >= 2) leaves.push(leaf(8, stemTop + 8, 5 + stage, 3, leafFill, highlight, outline, 'left', droop, -lean));
      if (stage >= 3) leaves.push(leaf(18, stemTop + 9, 5 + stage, 3, leafFill, highlight, outline, 'right', droop, lean));
      if (stage >= 4 || isRainy) leaves.push(leaf(11, stemTop + 5, 4 + stage, 2, leafFill, highlight, outline, 'left', Math.max(0, droop - 1), -lean));
      if (preset.silhouette === 'flower' && stage >= 2) leaves.push(flower(13 + lean, stemTop - 2, preset.highlight, outline));
    }

    for (let index = 0; index < state.flowerCount; index += 1) {
      leaves.push(flower(7 + index * 4 + lean, 15 - (index % 2), preset.highlight, outline));
    }

    const ariaLabel = escapeAttribute(`${preset.label} plant companion for ${state.location || 'your location'}: ${state.weatherSummary}`);
    return `<svg viewBox="0 0 32 32" role="img" aria-label="${ariaLabel}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" style="opacity:${opacity}">${rect(15 + lean, stemTop, 2, stemHeight, outline)}${rect(16 + lean, stemTop, 1, stemHeight, stemFill)}${leaves.join('')}${rect(8, 21, 16, 2, outline)}${rect(9, 23, 14, 1, outline)}${rect(10, 24, 12, 5, outline)}${rect(11, 29, 10, 1, outline)}${rect(9, 21, 14, 1, '#e0a14a')}${rect(10, 22, 12, 1, '#b86f35')}${rect(11, 24, 10, 4, '#b86f35')}${rect(11, 24, 3, 4, '#e0a14a')}${rect(18, 25, 3, 3, '#6b3f24')}${rect(12, 29, 8, 1, '#6b3f24')}</svg>`;
  }

  window.PlantCompanionState = {
    DEFAULT_PLANT_STATE,
    PLANT_TYPES,
    getStoredPlantState,
    savePlantState,
    createInitialPlantState,
    normalizePlantState,
    shouldRefreshWeather,
    fetchWeatherForLocation,
    advancePlantState,
    refreshPlantStateForWeather,
    renderPlantSvg,
  };
})();
