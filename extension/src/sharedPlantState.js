(() => {
  const STORAGE_KEY = 'ambientPlantState';
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

  function pixelKey(x, y) {
    return `${x},${y}`;
  }

  function addPixel(pixels, x, y, fill) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || px > 31 || py < 0 || py > 31) return;
    pixels.set(pixelKey(px, py), fill);
  }

  function addBlock(pixels, x, y, width, height, fill) {
    for (let iy = 0; iy < height; iy += 1) {
      for (let ix = 0; ix < width; ix += 1) addPixel(pixels, x + ix, y + iy, fill);
    }
  }

  function drawPixelLine(pixels, x1, y1, x2, y2, fill, thickness = 1) {
    const steps = Math.max(Math.abs(Math.round(x2 - x1)), Math.abs(Math.round(y2 - y1)), 1);
    for (let step = 0; step <= steps; step += 1) {
      const ratio = step / steps;
      const x = Math.round(x1 + (x2 - x1) * ratio);
      const y = Math.round(y1 + (y2 - y1) * ratio);
      addPixel(pixels, x, y, fill);
      if (thickness > 1) addPixel(pixels, x + 1, y, fill);
    }
  }

  function weightedPick(rng, rules) {
    const total = rules.reduce((sum, rule) => sum + rule.weight, 0);
    let cursor = rng() * total;
    for (const rule of rules) {
      cursor -= rule.weight;
      if (cursor <= 0) return rule.value;
    }
    return rules[rules.length - 1].value;
  }

  const L_SYSTEM_PRESETS = {
    fern: {
      axiom: 'X', angle: 34, step: 2, iterations: 2, startAngle: -90,
      rules: {
        X: [
          { weight: 3, value: 'F[+X]F[-X]+X' },
          { weight: 2, value: 'F[-X][+X]FX' },
          { weight: 1, value: 'F[+L]F[-X]X' },
        ],
        F: [{ weight: 2, value: 'FF' }, { weight: 1, value: 'F' }],
      },
    },
    vine: {
      axiom: 'X', angle: 28, step: 2, iterations: 3, startAngle: -96,
      rules: {
        X: [
          { weight: 3, value: 'F[+L]F[-X]FX' },
          { weight: 2, value: 'F[-L][+X]F' },
          { weight: 1, value: 'F[+X]F[-L]X' },
        ],
        F: [{ weight: 3, value: 'F' }, { weight: 1, value: 'FF' }],
      },
    },
    blossom: {
      axiom: 'X', angle: 31, step: 2, iterations: 3, startAngle: -90,
      rules: {
        X: [
          { weight: 3, value: 'F[+L]F[-L]B' },
          { weight: 2, value: 'F[+X][-X]B' },
          { weight: 1, value: 'F[+B]F[-L]X' },
        ],
        F: [{ weight: 2, value: 'FF' }, { weight: 1, value: 'F' }],
      },
    },
    sapling: {
      axiom: 'X', angle: 24, step: 2, iterations: 3, startAngle: -90,
      rules: {
        X: [
          { weight: 3, value: 'F[+X]F[-X]FC' },
          { weight: 2, value: 'F[+C][-X]FX' },
          { weight: 1, value: 'FF[+X][-C]C' },
        ],
        F: [{ weight: 3, value: 'F' }, { weight: 2, value: 'FF' }],
      },
    },
    succulent: {
      axiom: 'A', angle: 45, step: 2, iterations: 2, startAngle: -90,
      rules: { A: [{ weight: 1, value: 'L[+L][-L][++L][--L]A' }] },
    },
  };

  function deriveGrowthParameters(state, preset) {
    const stage = Math.round(state.growthStage);
    const healthRatio = state.health / 100;
    const hydrationRatio = state.hydration / 100;
    const weather = state.weather || {};
    return {
      stage,
      healthRatio,
      hydrationRatio,
      lean: weather.windSpeed >= 25 ? (weather.windSpeed >= 40 ? 2 : 1) : 0,
      droop: Math.round((1 - hydrationRatio) * 3) + (state.weatherMood === 'hot' ? 1 : 0) - (state.weatherMood === 'rainy' ? 1 : 0),
      stemFill: healthRatio < 0.35 ? '#777a45' : preset.stem,
      leafFill: state.weatherMood === 'hot' || hydrationRatio < 0.35 ? '#86a85a' : state.weatherMood === 'rainy' ? '#55c767' : preset.leaf,
      highlight: state.weatherMood === 'cloudy' ? '#7fae68' : state.weatherMood === 'sunny' ? '#b6e66b' : preset.highlight,
      outline: healthRatio < 0.35 ? '#4f5133' : '#1f3b24',
      opacity: (0.55 + healthRatio * 0.45).toFixed(2),
      stepScale: 0.75 + stage * 0.18,
      iterations: Math.max(1, Math.min((L_SYSTEM_PRESETS[state.plantType]?.iterations || 2), stage === 1 ? 1 : stage === 2 ? 2 : 3)),
    };
  }

  function generateLSystem(state, params) {
    const config = L_SYSTEM_PRESETS[state.plantType] || L_SYSTEM_PRESETS.fern;
    const rng = createRng(state.seed + params.stage * 1009 + Math.round(state.growthProgress) * 17);
    let sentence = config.axiom;
    for (let index = 0; index < params.iterations; index += 1) {
      sentence = sentence.split('').map((symbol) => {
        const rules = config.rules[symbol];
        return rules ? weightedPick(rng, rules) : symbol;
      }).join('');
    }
    return { sentence, config };
  }

  function stampLeaf(pixels, x, y, params, direction = 1) {
    const dy = Math.max(0, params.droop);
    addPixel(pixels, x, y + dy, params.outline);
    addPixel(pixels, x + direction, y + dy, params.leafFill);
    addPixel(pixels, x + direction * 2, y + dy, params.outline);
    addPixel(pixels, x + direction, y + dy - 1, params.highlight);
  }

  function stampFlower(pixels, x, y, petal, outline) {
    addPixel(pixels, x, y - 1, outline);
    addPixel(pixels, x - 1, y, outline);
    addPixel(pixels, x, y, petal);
    addPixel(pixels, x + 1, y, outline);
    addPixel(pixels, x, y + 1, '#f7d35b');
  }

  function turtlePixelsFromLSystem(state, params) {
    const { sentence, config } = generateLSystem(state, params);
    const rng = createRng(state.seed ^ 0xa53c9e7d ^ params.stage * 313);
    const pixels = new Map();
    const stack = [];
    let turtle = { x: 16 + params.lean, y: 22, angle: config.startAngle + params.lean * 7, width: state.plantType === 'sapling' ? 2 : 1 };
    const stepLength = config.step * params.stepScale;
    const angleJitter = 5 + params.stage;

    if (state.plantType === 'succulent') {
      const leaves = 7 + params.stage * 3;
      for (let index = 0; index < leaves; index += 1) {
        const angle = (Math.PI * 2 * index) / leaves + rng() * 0.28;
        const length = 3 + params.stage + Math.floor(rng() * 3);
        const x2 = 16 + Math.cos(angle) * length;
        const y2 = 18 + Math.sin(angle) * Math.max(1.2, length * 0.55) + params.droop;
        drawPixelLine(pixels, 16, 19, x2, y2, params.outline, 1);
        drawPixelLine(pixels, 16, 19, x2 - Math.cos(angle), y2, params.leafFill, 1);
        addPixel(pixels, Math.round((16 + x2) / 2), Math.round((19 + y2) / 2) - 1, params.highlight);
      }
      return pixels;
    }

    for (const symbol of sentence.slice(0, 420)) {
      if (symbol === 'F') {
        const rad = turtle.angle * Math.PI / 180;
        const wind = params.lean * (0.15 + rng() * 0.1);
        const next = {
          x: Math.round(turtle.x + Math.cos(rad) * stepLength + wind),
          y: Math.round(turtle.y + Math.sin(rad) * stepLength + Math.max(0, params.droop) * 0.12),
        };
        drawPixelLine(pixels, turtle.x, turtle.y, next.x, next.y, params.outline, turtle.width);
        if (turtle.width > 1) drawPixelLine(pixels, turtle.x + 1, turtle.y, next.x + 1, next.y, params.stemFill, 1);
        else addPixel(pixels, next.x, next.y, params.stemFill);
        turtle.x = next.x; turtle.y = next.y;
      } else if (symbol === '+') {
        turtle.angle += config.angle + (rng() - 0.5) * angleJitter;
      } else if (symbol === '-') {
        turtle.angle -= config.angle + (rng() - 0.5) * angleJitter;
      } else if (symbol === '[') {
        stack.push({ ...turtle, width: Math.max(1, turtle.width - 1) });
      } else if (symbol === ']') {
        const leafDirection = turtle.x < 16 ? -1 : 1;
        if (rng() > 0.25) stampLeaf(pixels, turtle.x, turtle.y, params, leafDirection);
        turtle = stack.pop() || turtle;
      } else if (symbol === 'L') {
        stampLeaf(pixels, turtle.x, turtle.y, params, turtle.x < 16 ? -1 : 1);
      } else if (symbol === 'B') {
        if (params.stage >= 3) stampFlower(pixels, turtle.x, turtle.y, state.plantType === 'blossom' ? params.highlight : '#f06ca7', params.outline);
      } else if (symbol === 'C') {
        addBlock(pixels, turtle.x - 1, turtle.y - 1, 3, 2, params.outline);
        addPixel(pixels, turtle.x, turtle.y - 1, params.leafFill);
        addPixel(pixels, turtle.x + 1, turtle.y - 1, params.highlight);
      }
    }

    for (let index = 0; index < state.flowerCount; index += 1) {
      stampFlower(pixels, 10 + index * 3 + params.lean, 14 - (index % 2), params.highlight, params.outline);
    }
    return pixels;
  }

  function renderPlantSvg(stateInput) {
    const state = normalizePlantState(stateInput);
    const preset = PLANT_TYPES[state.plantType];
    const params = deriveGrowthParameters(state, preset);
    const pixels = turtlePixelsFromLSystem(state, params);
    const plantPixels = Array.from(pixels.entries()).map(([key, fill]) => {
      const [x, y] = key.split(',');
      return rect(x, y, 1, 1, fill);
    }).join('');
    const ariaLabel = escapeAttribute(`${preset.label} pixel L-system plant companion for ${state.location || 'your location'}: ${state.weatherSummary}`);
    return `<svg viewBox="0 0 32 32" role="img" aria-label="${ariaLabel}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" style="opacity:${params.opacity}">${plantPixels}${rect(8, 21, 16, 2, params.outline)}${rect(9, 23, 14, 1, params.outline)}${rect(10, 24, 12, 5, params.outline)}${rect(11, 29, 10, 1, params.outline)}${rect(9, 21, 14, 1, '#e0a14a')}${rect(10, 22, 12, 1, '#b86f35')}${rect(11, 24, 10, 4, '#b86f35')}${rect(11, 24, 3, 4, '#e0a14a')}${rect(18, 25, 3, 3, '#6b3f24')}${rect(12, 29, 8, 1, '#6b3f24')}</svg>`;
  }

  const api = {
    DEFAULT_PLANT_STATE,
    PLANT_TYPES,
    FLOWER_MIN_STAGE_BY_TYPE,
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
    renderPlantSvg,
  };

  globalThis.PlantCompanionState = api;
  if (typeof window !== 'undefined') window.PlantCompanionState = api;
})();
