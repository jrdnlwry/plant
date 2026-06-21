(() => {
  const STORAGE_KEY = 'ambientPlantState';

  const DEFAULT_PLANT_STATE = {
    plantType: 'fern',
    location: '',
    growthStage: 1,
    health: 85,
    hydration: 70,
    seed: null,
    createdAt: null,
    updatedAt: null,
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
      seed,
      createdAt,
      updatedAt: state.updatedAt || now,
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
    return normalizePlantState({ plantType, location, growthStage: 1, health: 85, hydration: 70, seed: hashString(`${plantType}|${location}|${now}`), createdAt: now, updatedAt: now });
  }

  function rect(x, y, width, height, fill, extra = '') {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" ${extra}/>`;
  }

  function pixelLine(x1, y1, x2, y2, width, fill) {
    const blocks = [];
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
    for (let index = 0; index <= steps; index += 1) {
      const x = Math.round(x1 + ((x2 - x1) * index) / steps);
      const y = Math.round(y1 + ((y2 - y1) * index) / steps);
      blocks.push(rect(x, y, width, width, fill));
    }
    return blocks.join('');
  }

  function leafCluster(x, y, size, fill, highlight, outline, direction, droop) {
    const width = Math.max(3, size);
    const height = Math.max(2, Math.ceil(size / 2));
    const tipX = direction === 'left' ? x - width + 1 : x;
    const shineX = direction === 'left' ? tipX + width - 2 : tipX + 1;
    return [
      rect(tipX, y + droop, width, height, outline),
      rect(tipX + 1, y + droop + 1, width - 1, height, fill),
      rect(shineX, y + droop + 1, 2, 1, highlight),
    ].join('');
  }

  function flower(x, y, fill, outline, rng) {
    const accent = pick(rng, ['#ffd166', '#fff0a6', '#f7a8c8']);
    return [rect(x - 1, y, 3, 1, outline), rect(x, y - 1, 1, 3, outline), rect(x - 1, y, 3, 1, fill), rect(x, y - 1, 1, 3, fill), rect(x, y, 1, 1, accent)].join('');
  }

  function bud(x, y, fill, outline) {
    return `${rect(x - 1, y, 3, 2, outline)}${rect(x, y, 1, 1, fill)}`;
  }

  function pot() {
    return `${rect(8, 21, 16, 2, '#24313a')}${rect(9, 23, 14, 1, '#24313a')}${rect(10, 24, 12, 5, '#24313a')}${rect(11, 29, 10, 1, '#24313a')}${rect(9, 21, 14, 1, '#e0a14a')}${rect(10, 22, 12, 1, '#b86f35')}${rect(11, 24, 10, 4, '#b86f35')}${rect(11, 24, 3, 4, '#e0a14a')}${rect(18, 25, 3, 3, '#6b3f24')}${rect(12, 29, 8, 1, '#6b3f24')}`;
  }

  function renderRosette(stage, colors, rng, droop) {
    const parts = [];
    const count = 5 + stage * 2;
    for (let index = 0; index < count; index += 1) {
      const direction = index % 2 === 0 ? 'left' : 'right';
      const x = 16 + (direction === 'left' ? -1 : 1) * Math.floor(index / 2);
      const y = 18 - Math.floor(index / 2) - Math.round(rng() * stage);
      parts.push(leafCluster(x, y, 5 + stage - Math.floor(index / 3), colors.leafFill, colors.highlight, colors.outline, direction, droop));
    }
    return parts.join('');
  }

  function renderProceduralPlant(state) {
    const preset = PLANT_TYPES[state.plantType];
    const rng = createRng(state.seed + Math.round(state.growthStage) * 997);
    const stage = Math.round(state.growthStage);
    const healthRatio = state.health / 100;
    const hydrationRatio = state.hydration / 100;
    const droop = Math.round((1 - hydrationRatio) * 4);
    const outline = '#24313a';
    const colors = { outline, leafFill: hydrationRatio < 0.35 ? '#86a85a' : preset.leaf, stemFill: healthRatio < 0.35 ? '#777a45' : preset.stem, highlight: preset.highlight };
    const parts = [];
    const baseX = 16 + Math.round((rng() - 0.5) * 2);
    const topY = 19 - stage * 4 + Math.round((1 - healthRatio) * 2);

    if (preset.silhouette === 'rosette') {
      parts.push(renderRosette(stage, colors, rng, droop));
    } else {
      const trunkWidth = preset.modules.trunk ? 3 : 2;
      parts.push(pixelLine(baseX, 22, baseX + Math.round((rng() - 0.5) * 3), topY, trunkWidth, outline));
      parts.push(pixelLine(baseX + (trunkWidth > 2 ? 1 : 0), 22, baseX + Math.round((rng() - 0.5) * 2), topY + 1, 1, colors.stemFill));

      const branchCount = Math.min(preset.modules.branches + stage - 1, 8);
      for (let index = 0; index < branchCount; index += 1) {
        const direction = index % 2 === 0 ? -1 : 1;
        const startY = topY + 2 + index * Math.max(1, Math.floor((22 - topY) / Math.max(branchCount, 1)));
        const length = 4 + stage + Math.floor(rng() * 4);
        const endX = baseX + direction * length;
        const endY = startY - 1 + Math.round(rng() * 3) + droop;
        parts.push(pixelLine(baseX, startY, endX, endY, 1, outline));
        parts.push(leafCluster(endX, endY - 1, 4 + stage + Math.floor(rng() * 2), colors.leafFill, colors.highlight, outline, direction < 0 ? 'left' : 'right', droop));
        if (preset.modules.tendrils && index < stage + 1) parts.push(pixelLine(endX, endY + 1, endX + direction * 2, endY + 4, 1, colors.stemFill));
        if (preset.modules.flowers && index < stage) parts.push(stage >= 3 ? flower(endX, endY - 3, preset.flower || preset.highlight, outline, rng) : bud(endX, endY - 2, preset.highlight, outline));
      }

      for (let index = 0; index < Math.min(preset.modules.canopy + stage, 9); index += 1) {
        const x = baseX - 5 + Math.floor(rng() * 11);
        const y = topY - 3 + Math.floor(rng() * 7);
        parts.push(leafCluster(x, y, 4 + Math.floor(rng() * 3), colors.leafFill, colors.highlight, outline, rng() < 0.5 ? 'left' : 'right', droop));
      }
    }

    return parts.join('');
  }

  function renderPlantSvg(stateInput) {
    const state = normalizePlantState(stateInput);
    const preset = PLANT_TYPES[state.plantType];
    const opacity = (0.55 + (state.health / 100) * 0.45).toFixed(2);
    return `<svg viewBox="0 0 32 32" role="img" aria-label="${preset.label} plant companion for ${state.location || 'your location'}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" style="opacity:${opacity}">${renderProceduralPlant(state)}${pot()}</svg>`;
  }

  window.PlantCompanionState = { DEFAULT_PLANT_STATE, PLANT_TYPES, getStoredPlantState, savePlantState, createInitialPlantState, normalizePlantState, renderPlantSvg };
})();
