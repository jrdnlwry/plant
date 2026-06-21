(() => {
  const STORAGE_KEY = 'ambientPlantState';

  const DEFAULT_PLANT_STATE = {
    plantType: 'fern',
    location: '',
    growthStage: 1,
    health: 85,
    hydration: 70,
    createdAt: null,
    updatedAt: null,
  };

  const PLANT_TYPES = {
    fern: { label: 'Fern', stem: '#2f7d32', leaf: '#4caf50', highlight: '#8bcf5a', silhouette: 'wide' },
    succulent: { label: 'Succulent', stem: '#3f7f5f', leaf: '#66b889', highlight: '#a6d9a8', silhouette: 'rosette' },
    blossom: { label: 'Blossom', stem: '#2f7d32', leaf: '#5fbf5a', highlight: '#f06ca7', silhouette: 'flower' },
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(Number(value) || 0, min), max);
  }

  function normalizePlantState(state = {}) {
    const now = new Date().toISOString();
    const plantType = PLANT_TYPES[state.plantType] ? state.plantType : DEFAULT_PLANT_STATE.plantType;

    return {
      ...DEFAULT_PLANT_STATE,
      ...state,
      plantType,
      location: typeof state.location === 'string' ? state.location.trim() : '',
      growthStage: clamp(state.growthStage ?? DEFAULT_PLANT_STATE.growthStage, 1, 4),
      health: clamp(state.health ?? DEFAULT_PLANT_STATE.health, 0, 100),
      hydration: clamp(state.hydration ?? DEFAULT_PLANT_STATE.hydration, 0, 100),
      createdAt: state.createdAt || now,
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
    return normalizePlantState({
      plantType,
      location,
      growthStage: 1,
      health: 85,
      hydration: 70,
      createdAt: now,
      updatedAt: now,
    });
  }

  function rect(x, y, width, height, fill, extra = '') {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" ${extra}/>`;
  }

  function leaf(x, y, width, height, fill, highlight, outline, direction, droop) {
    const endY = y + droop;
    const bodyX = direction === 'left' ? x : x + 1;
    const tipX = direction === 'left' ? x - 1 : x + width - 1;
    return [
      rect(Math.min(tipX, x), endY, width + 1, 1, outline),
      rect(x, endY + 1, width, height, outline),
      rect(bodyX, endY + 1, width - 1, height - 1, fill),
      rect(direction === 'left' ? x : x + width - 2, endY + 1, 2, 1, highlight),
    ].join('');
  }

  function renderPlantSvg(stateInput) {
    const state = normalizePlantState(stateInput);
    const preset = PLANT_TYPES[state.plantType];
    const outline = '#24313a';
    const healthRatio = state.health / 100;
    const hydrationRatio = state.hydration / 100;
    const stage = Math.round(state.growthStage);
    const droop = Math.round((1 - hydrationRatio) * 4);
    const stemTop = 22 - stage * 4 + Math.round((1 - healthRatio) * 2);
    const stemHeight = 22 - stemTop;
    const leafFill = hydrationRatio < 0.35 ? '#86a85a' : preset.leaf;
    const stemFill = healthRatio < 0.35 ? '#777a45' : preset.stem;
    const opacity = (0.55 + healthRatio * 0.45).toFixed(2);
    const leaves = [];

    if (preset.silhouette === 'rosette') {
      leaves.push(leaf(10, 15, 6 + stage, 3, leafFill, preset.highlight, outline, 'left', droop));
      leaves.push(leaf(16, 14, 6 + stage, 3, leafFill, preset.highlight, outline, 'right', droop));
      leaves.push(leaf(12, 11, 5 + stage, 3, leafFill, preset.highlight, outline, 'left', droop));
      leaves.push(leaf(15, 10, 5 + stage, 3, leafFill, preset.highlight, outline, 'right', droop));
    } else {
      leaves.push(leaf(7 - stage, stemTop + 3, 6 + stage, 3, leafFill, preset.highlight, outline, 'left', droop));
      leaves.push(leaf(18, stemTop + 2, 6 + stage, 3, leafFill, preset.highlight, outline, 'right', droop));
      if (stage >= 2) leaves.push(leaf(8, stemTop + 8, 5 + stage, 3, leafFill, preset.highlight, outline, 'left', droop));
      if (stage >= 3) leaves.push(leaf(18, stemTop + 9, 5 + stage, 3, leafFill, preset.highlight, outline, 'right', droop));
      if (preset.silhouette === 'flower' && stage >= 2) {
        leaves.push(rect(13, stemTop - 2, 6, 4, outline));
        leaves.push(rect(14, stemTop - 1, 4, 2, preset.highlight));
      }
    }

    return `<svg viewBox="0 0 32 32" role="img" aria-label="${preset.label} plant companion for ${state.location || 'your location'}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" style="opacity:${opacity}">${rect(15, stemTop, 2, stemHeight, outline)}${rect(16, stemTop, 1, stemHeight, stemFill)}${leaves.join('')}${rect(8, 21, 16, 2, outline)}${rect(9, 23, 14, 1, outline)}${rect(10, 24, 12, 5, outline)}${rect(11, 29, 10, 1, outline)}${rect(9, 21, 14, 1, '#e0a14a')}${rect(10, 22, 12, 1, '#b86f35')}${rect(11, 24, 10, 4, '#b86f35')}${rect(11, 24, 3, 4, '#e0a14a')}${rect(18, 25, 3, 3, '#6b3f24')}${rect(12, 29, 8, 1, '#6b3f24')}</svg>`;
  }

  window.PlantCompanionState = {
    DEFAULT_PLANT_STATE,
    PLANT_TYPES,
    getStoredPlantState,
    savePlantState,
    createInitialPlantState,
    normalizePlantState,
    renderPlantSvg,
  };
})();
