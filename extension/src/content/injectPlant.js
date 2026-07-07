(() => {
  const ROOT_ID = 'ambient-plant-companion-root';
  const existingCompanion = window.__AmbientPlantCompanion;

  if (existingCompanion?.rendererVersion === window.PlantCompanionState.RENDERER_VERSION) {
    existingCompanion.renderStoredPlant?.();
    return;
  }

  existingCompanion?.cleanup?.();

  const cleanupCallbacks = [];

  function renderPlant(root, stateInput) {
    const state = stateInput ? window.PlantCompanionState.normalizePlantState(stateInput) : null;
    root.dataset.configured = String(Boolean(state));
    root.innerHTML = state
      ? window.PlantCompanionState.renderPlantSvg(state)
      : '<div class="ambient-plant-placeholder" title="Open Plant Companion to choose your plant">?</div>';
  }

  async function renderStoredPlant(root, options = {}) {
    let state = await window.PlantCompanionState.getStoredPlantState();
    if (state && !options.renderOnly) {
      state = await window.PlantCompanionState.refreshPlantStateForWeather().catch((error) => {
        console.warn('Plant weather refresh failed:', error);
        return window.PlantCompanionState.savePlantState(window.PlantCompanionState.advancePlantState(state));
      });
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

    root.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;

      const rect = root.getBoundingClientRect();
      dragState = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };

      root.dataset.dragging = 'true';
      root.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    root.addEventListener('pointermove', (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;

      setOverlayPosition(root, event.clientX - dragState.offsetX, event.clientY - dragState.offsetY);
      event.preventDefault();
    });

    function stopDragging(event) {
      if (!dragState || event.pointerId !== dragState.pointerId) return;

      if (root.hasPointerCapture(event.pointerId)) {
        root.releasePointerCapture(event.pointerId);
      }

      dragState = null;
      root.dataset.dragging = 'false';
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
    document.documentElement.appendChild(root);
    renderStoredPlant(root);
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
    renderStoredPlant: () => renderStoredPlant(ensureOverlay()),
    cleanup: () => {
      while (cleanupCallbacks.length) cleanupCallbacks.pop()();
    },
  };
})();
