(() => {
  const ROOT_ID = 'ambient-plant-companion-root';
  const existingCompanion = window.__AmbientPlantCompanion;

  if (existingCompanion?.rendererVersion === window.PlantCompanionState.RENDERER_VERSION) {
    existingCompanion.renderStoredPlant?.();
    return;
  }

  existingCompanion?.cleanup?.();

  const cleanupCallbacks = [];

  function formatElapsedDays(createdAt) {
    const createdTime = Date.parse(createdAt);
    if (!Number.isFinite(createdTime)) return 'Unknown';

    const elapsedDays = Math.max(0, Math.floor((Date.now() - createdTime) / (24 * 60 * 60 * 1000)));
    return `${elapsedDays} ${elapsedDays === 1 ? 'day' : 'days'}`;
  }

  function formatRain(state) {
    const rainAmount = window.PlantCompanionState.getRainfallAmount(state.weather);
    const rainIntensity = window.PlantCompanionState.getRainIntensity(state.weather);
    if (rainIntensity === 'none') return `${rainAmount.toFixed(1)} mm recent rain`;
    return `${rainIntensity} (${rainAmount.toFixed(1)} mm recent rain)`;
  }

  function formatWeather(state) {
    const weather = state.weather;
    if (!weather) return state.weatherSummary || 'No weather yet';

    const details = [];
    if (Number.isFinite(Number(weather.temperatureC))) details.push(`${Math.round(Number(weather.temperatureC))}°C`);
    if (Number.isFinite(Number(weather.humidity))) details.push(`${Math.round(Number(weather.humidity))}% humidity`);
    if (Number.isFinite(Number(weather.windSpeed))) details.push(`${Math.round(Number(weather.windSpeed))} km/h wind`);

    return [state.weatherSummary, details.join(' · ')].filter(Boolean).join(' — ');
  }

  function statRow(label, value) {
    const row = document.createElement('div');
    row.className = 'ambient-plant-stats-row';

    const labelElement = document.createElement('span');
    labelElement.className = 'ambient-plant-stats-label';
    labelElement.textContent = label;

    const valueElement = document.createElement('span');
    valueElement.className = 'ambient-plant-stats-value';
    valueElement.textContent = value;

    row.append(labelElement, valueElement);
    return row;
  }

  function renderStatsPanel(root, state) {
    let panel = root.querySelector('.ambient-plant-stats-panel');
    const isOpen = root.dataset.statsOpen === 'true';

    if (!state || !isOpen) {
      panel?.remove();
      root.setAttribute('aria-expanded', 'false');
      return;
    }

    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'ambient-plant-stats-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Plant stats');
      panel.addEventListener('pointerdown', (event) => event.stopPropagation());
      panel.addEventListener('dblclick', (event) => event.stopPropagation());
    }

    const plantTypeLabel = window.PlantCompanionState.PLANT_TYPES[state.plantType]?.label || 'Unknown';

    panel.replaceChildren(
      statRow('Plant type', plantTypeLabel),
      statRow('Elapsed days alive', formatElapsedDays(state.createdAt)),
      statRow('Location', state.location || 'Not set'),
      statRow('Growth', `Stage ${Math.round(state.growthStage)} · ${Math.round(state.growthProgress)}%`),
      statRow('Health', `${Math.round(state.health)}%`),
      statRow('Hydration', `${Math.round(state.hydration)}%`),
      statRow('Weather', formatWeather(state)),
      statRow('Flowers', String(Math.round(state.flowerCount))),
      statRow('Rain', formatRain(state)),
    );

    root.appendChild(panel);
    root.setAttribute('aria-expanded', 'true');
  }

  function renderPlant(root, stateInput) {
    const state = stateInput ? window.PlantCompanionState.normalizePlantState(stateInput) : null;
    root.dataset.configured = String(Boolean(state));
    root.dataset.hasStats = String(Boolean(state));
    root.innerHTML = state
      ? window.PlantCompanionState.renderPlantSvg(state)
      : '<div class="ambient-plant-placeholder" title="Open Plant Companion to choose your plant">?</div>';
    root._ambientPlantState = state;
    renderStatsPanel(root, state);
  }

  async function renderStoredPlant(root, options = {}) {
    let state = await window.PlantCompanionState.getStoredPlantState();
    if (state && !options.renderOnly) {
      const response = await chrome.runtime.sendMessage({ type: 'PLANT_REQUEST_LIFECYCLE_UPDATE' });
      if (!response?.ok) console.warn('Plant lifecycle refresh failed:', response?.error);
      state = response?.state || await window.PlantCompanionState.getStoredPlantState();
    }
    renderPlant(root, state);
  }


  function setOverlayPosition(root, left, top) {
    const maxLeft = Math.max(0, window.innerWidth - root.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - root.offsetHeight);
    const nextLeft = Math.min(Math.max(0, left), maxLeft);
    const nextTop = Math.min(Math.max(0, top), maxTop);

    root.style.left = `${nextLeft}px`;
    root.style.top = `${nextTop}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
  }

  function enableDragging(root) {
    if (root.dataset.dragEnabled === 'true') return;
    root.dataset.dragEnabled = 'true';

    let dragState = null;
    let lastPlantActivation = 0;
    let ignoreNativeDoubleClickUntil = 0;
    const DOUBLE_CLICK_MS = 450;
    const DRAG_THRESHOLD_PX = 4;

    function toggleStatsPanel(event) {
      if (root.dataset.hasStats !== 'true') return;
      root.dataset.statsOpen = root.dataset.statsOpen === 'true' ? 'false' : 'true';
      renderStatsPanel(root, root._ambientPlantState);
      event?.preventDefault();
      event?.stopPropagation();
    }

    root.addEventListener('dblclick', (event) => {
      if (Date.now() < ignoreNativeDoubleClickUntil) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      toggleStatsPanel(event);
    });

    root.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') toggleStatsPanel(event);
    });

    root.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;

      const rect = root.getBoundingClientRect();
      dragState = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      };

      root.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    root.addEventListener('pointermove', (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;

      const movedX = Math.abs(event.clientX - dragState.startX);
      const movedY = Math.abs(event.clientY - dragState.startY);
      dragState.moved = dragState.moved || movedX > DRAG_THRESHOLD_PX || movedY > DRAG_THRESHOLD_PX;
      if (dragState.moved) {
        root.dataset.dragging = 'true';
        setOverlayPosition(root, event.clientX - dragState.offsetX, event.clientY - dragState.offsetY);
      }
      event.preventDefault();
    });

    function stopDragging(event) {
      if (!dragState || event.pointerId !== dragState.pointerId) return;

      if (root.hasPointerCapture(event.pointerId)) {
        root.releasePointerCapture(event.pointerId);
      }

      const wasClick = !dragState.moved;
      dragState = null;
      root.dataset.dragging = 'false';

      if (wasClick) {
        const now = Date.now();
        if (now - lastPlantActivation <= DOUBLE_CLICK_MS) {
          lastPlantActivation = 0;
          ignoreNativeDoubleClickUntil = now + 50;
          toggleStatsPanel(event);
          return;
        }
        lastPlantActivation = now;
      }

      event.preventDefault();
    }

    root.addEventListener('pointerup', stopDragging);
    root.addEventListener('pointercancel', stopDragging);

    window.addEventListener('resize', () => {
      const rect = root.getBoundingClientRect();
      setOverlayPosition(root, rect.left, rect.top);
    });
  }

  function ensureOverlay() {
    let root = document.getElementById(ROOT_ID);
    if (root) {
      enableDragging(root);
      return root;
    }

    root = document.createElement('div');
    root.id = ROOT_ID;
    root.dataset.visible = 'true';
    root.dataset.statsOpen = 'false';
    root.tabIndex = 0;
    root.setAttribute('role', 'button');
    root.setAttribute('aria-label', 'Plant companion overlay. Double click to show stats.');
    root.setAttribute('aria-expanded', 'false');
    document.documentElement.appendChild(root);
    renderStoredPlant(root, { renderOnly: true });
    enableDragging(root);
    return root;
  }

  function setVisibility(isVisible) {
    ensureOverlay().dataset.visible = String(Boolean(isVisible));
  }

  function isVisible() {
    return ensureOverlay().dataset.visible !== 'false';
  }

  ensureOverlay();

  const handleStorageChange = (changes, areaName) => {
    if (areaName !== 'local' || !changes.ambientPlantState) return;
    renderPlant(ensureOverlay(), changes.ambientPlantState.newValue);
  };
  chrome.storage.onChanged.addListener(handleStorageChange);
  cleanupCallbacks.push(() => chrome.storage.onChanged.removeListener(handleStorageChange));

  const handleMessage = (message, _sender, sendResponse) => {
    if (message?.type === 'PLANT_SET_VISIBILITY' || message?.type === 'PLANT_CURRENT_SET_VISIBILITY') {
      setVisibility(message.isVisible);
      sendResponse({ isVisible: isVisible(), rendererVersion: window.PlantCompanionState.RENDERER_VERSION });
      return true;
    }

    if (message?.type === 'PLANT_REFRESH_STATE' || message?.type === 'PLANT_CURRENT_REFRESH_STATE') {
      const root = ensureOverlay();
      renderStoredPlant(root, { renderOnly: message.renderOnly })
        .then(() => sendResponse({ ok: true, rendererVersion: window.PlantCompanionState.RENDERER_VERSION }));
      return true;
    }

    if (message?.type === 'PLANT_GET_VISIBILITY' || message?.type === 'PLANT_CURRENT_GET_VISIBILITY') {
      sendResponse({ isVisible: isVisible(), rendererVersion: window.PlantCompanionState.RENDERER_VERSION });
      return true;
    }

    return false;
  };
  chrome.runtime.onMessage.addListener(handleMessage);
  cleanupCallbacks.push(() => chrome.runtime.onMessage.removeListener(handleMessage));

  window.__AmbientPlantCompanion = {
    rendererVersion: window.PlantCompanionState.RENDERER_VERSION,
    renderStoredPlant: (options = {}) => renderStoredPlant(ensureOverlay(), { renderOnly: true, ...options }),
    cleanup: () => {
      while (cleanupCallbacks.length) cleanupCallbacks.pop()();
    },
  };
})();
