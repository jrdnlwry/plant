(() => {
  const ROOT_ID = 'ambient-plant-companion-root';

  async function renderStoredPlant(root) {
    let state = await window.PlantCompanionState.getStoredPlantState();
    if (state) {
      state = await window.PlantCompanionState.refreshPlantStateForWeather().catch((error) => {
        console.warn('Plant weather refresh failed:', error);
        return window.PlantCompanionState.advancePlantState(state);
      });
    }
    root.dataset.configured = String(Boolean(state));
    root.innerHTML = state
      ? window.PlantCompanionState.renderPlantSvg(state)
      : '<div class="ambient-plant-placeholder" title="Open Plant Companion to choose your plant">?</div>';
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

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes.ambientPlantState) return;
    renderStoredPlant(ensureOverlay());
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'PLANT_SET_VISIBILITY') {
      setVisibility(message.isVisible);
      sendResponse({ isVisible: isVisible() });
      return true;
    }

    if (message?.type === 'PLANT_REFRESH_STATE') {
      renderStoredPlant(ensureOverlay()).then(() => sendResponse({ ok: true }));
      return true;
    }

    if (message?.type === 'PLANT_GET_VISIBILITY') {
      sendResponse({ isVisible: isVisible() });
      return true;
    }

    return false;
  });
})();
