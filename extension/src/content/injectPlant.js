(() => {
  const ROOT_ID = 'ambient-plant-companion-root';

  function createStaticPlantSvg() {
    return `
      <svg viewBox="0 0 32 32" role="img" aria-label="Retro pixel plant companion" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
        <rect x="10" y="4" width="2" height="2" fill="#24313A" />
        <rect x="12" y="3" width="4" height="1" fill="#24313A" />
        <rect x="16" y="4" width="2" height="2" fill="#24313A" />
        <rect x="11" y="6" width="6" height="1" fill="#24313A" />
        <rect x="12" y="4" width="4" height="2" fill="#F06CA7" />
        <rect x="13" y="4" width="2" height="1" fill="#F06CA7" />

        <rect x="15" y="7" width="2" height="15" fill="#24313A" />
        <rect x="16" y="7" width="1" height="15" fill="#2F7D32" />

        <rect x="7" y="9" width="6" height="1" fill="#24313A" />
        <rect x="5" y="10" width="8" height="1" fill="#24313A" />
        <rect x="4" y="11" width="8" height="2" fill="#24313A" />
        <rect x="5" y="13" width="6" height="1" fill="#24313A" />
        <rect x="7" y="10" width="5" height="3" fill="#4CAF50" />
        <rect x="5" y="11" width="3" height="1" fill="#8BCF5A" />
        <rect x="9" y="12" width="2" height="1" fill="#2F7D32" />

        <rect x="20" y="8" width="5" height="1" fill="#24313A" />
        <rect x="20" y="9" width="7" height="1" fill="#24313A" />
        <rect x="21" y="10" width="7" height="2" fill="#24313A" />
        <rect x="22" y="12" width="4" height="1" fill="#24313A" />
        <rect x="21" y="9" width="5" height="3" fill="#4CAF50" />
        <rect x="24" y="10" width="3" height="1" fill="#8BCF5A" />
        <rect x="21" y="11" width="2" height="1" fill="#2F7D32" />

        <rect x="9" y="15" width="5" height="1" fill="#24313A" />
        <rect x="8" y="16" width="7" height="2" fill="#24313A" />
        <rect x="10" y="18" width="4" height="1" fill="#24313A" />
        <rect x="10" y="16" width="4" height="2" fill="#4CAF50" />
        <rect x="8" y="16" width="2" height="1" fill="#8BCF5A" />

        <rect x="18" y="16" width="5" height="1" fill="#24313A" />
        <rect x="18" y="17" width="7" height="2" fill="#24313A" />
        <rect x="19" y="19" width="4" height="1" fill="#24313A" />
        <rect x="19" y="17" width="5" height="2" fill="#4CAF50" />
        <rect x="22" y="17" width="2" height="1" fill="#8BCF5A" />

        <rect x="8" y="21" width="16" height="2" fill="#24313A" />
        <rect x="9" y="23" width="14" height="1" fill="#24313A" />
        <rect x="10" y="24" width="12" height="5" fill="#24313A" />
        <rect x="11" y="29" width="10" height="1" fill="#24313A" />
        <rect x="9" y="21" width="14" height="1" fill="#E0A14A" />
        <rect x="10" y="22" width="12" height="1" fill="#B86F35" />
        <rect x="11" y="24" width="10" height="4" fill="#B86F35" />
        <rect x="11" y="24" width="3" height="4" fill="#E0A14A" />
        <rect x="18" y="25" width="3" height="3" fill="#6B3F24" />
        <rect x="12" y="29" width="8" height="1" fill="#6B3F24" />
      </svg>
    `;
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
    root.innerHTML = createStaticPlantSvg();
    document.documentElement.appendChild(root);
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

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'PLANT_SET_VISIBILITY') {
      setVisibility(message.isVisible);
      sendResponse({ isVisible: isVisible() });
      return true;
    }

    if (message?.type === 'PLANT_GET_VISIBILITY') {
      sendResponse({ isVisible: isVisible() });
      return true;
    }

    return false;
  });
})();
