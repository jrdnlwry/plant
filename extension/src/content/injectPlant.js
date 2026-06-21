(() => {
  const ROOT_ID = 'ambient-plant-companion-root';

  function createStaticPlantSvg() {
    return `
      <svg viewBox="0 0 120 150" role="img" aria-label="Ambient plant companion" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ambient-plant-pot" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#f59e0b" />
            <stop offset="100%" stop-color="#b45309" />
          </linearGradient>
          <linearGradient id="ambient-plant-leaf" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#86efac" />
            <stop offset="100%" stop-color="#16a34a" />
          </linearGradient>
        </defs>
        <ellipse cx="60" cy="136" rx="33" ry="7" fill="rgba(15, 23, 42, 0.18)" />
        <path d="M34 106h52l-7 32H41z" fill="url(#ambient-plant-pot)" />
        <path d="M31 101h58a4 4 0 0 1 4 4v5H27v-5a4 4 0 0 1 4-4z" fill="#d97706" />
        <path d="M60 104 C58 82 58 61 61 39" fill="none" stroke="#15803d" stroke-width="5" stroke-linecap="round" />
        <path d="M61 75 C47 63 37 56 25 55" fill="none" stroke="#16a34a" stroke-width="4" stroke-linecap="round" />
        <path d="M60 68 C76 55 86 47 98 42" fill="none" stroke="#16a34a" stroke-width="4" stroke-linecap="round" />
        <path d="M60 91 C72 83 83 79 96 78" fill="none" stroke="#16a34a" stroke-width="3.5" stroke-linecap="round" />
        <ellipse cx="24" cy="55" rx="14" ry="7" fill="url(#ambient-plant-leaf)" transform="rotate(-12 24 55)" />
        <ellipse cx="38" cy="66" rx="12" ry="6" fill="#22c55e" transform="rotate(34 38 66)" />
        <ellipse cx="99" cy="42" rx="15" ry="7" fill="url(#ambient-plant-leaf)" transform="rotate(-30 99 42)" />
        <ellipse cx="82" cy="52" rx="12" ry="6" fill="#4ade80" transform="rotate(44 82 52)" />
        <ellipse cx="97" cy="78" rx="12" ry="6" fill="#22c55e" transform="rotate(-8 97 78)" />
        <ellipse cx="73" cy="86" rx="10" ry="5" fill="#86efac" transform="rotate(28 73 86)" />
        <circle cx="62" cy="34" r="7" fill="#f472b6" />
        <circle cx="57" cy="38" r="4" fill="#f9a8d4" />
      </svg>
    `;
  }

  function ensureOverlay() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;

    root = document.createElement('div');
    root.id = ROOT_ID;
    root.dataset.visible = 'true';
    root.innerHTML = createStaticPlantSvg();
    document.documentElement.appendChild(root);
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
