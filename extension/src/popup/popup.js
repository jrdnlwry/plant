const toggle = document.getElementById('plant-toggle');
const statusText = document.getElementById('status');
const setupPanel = document.getElementById('setup-panel');
const plantPanel = document.getElementById('plant-panel');
const setupForm = document.getElementById('setup-form');
const plantTypeInput = document.getElementById('plant-type');
const locationInput = document.getElementById('location');
const plantPreview = document.getElementById('plant-preview');
const resetSetup = document.getElementById('reset-setup');

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function sendPlantMessage(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

function setStatus(message) {
  statusText.textContent = message;
}

async function refreshActiveTabPlant() {
  const tab = await getActiveTab();
  if (tab?.id) {
    await sendPlantMessage(tab.id, { type: 'PLANT_REFRESH_STATE' }).catch(() => {});
  }
}

function renderSetup(state) {
  setupPanel.hidden = Boolean(state);
  plantPanel.hidden = !state;

  if (!state) return;

  const preset = window.PlantCompanionState.PLANT_TYPES[state.plantType];
  plantPreview.innerHTML = window.PlantCompanionState.renderPlantSvg(state);
  document.getElementById('fact-type').textContent = preset.label;
  document.getElementById('fact-location').textContent = state.location;
  document.getElementById('fact-growth').textContent = `Stage ${state.growthStage}`;
  document.getElementById('fact-health').textContent = `${state.health}%`;
  document.getElementById('fact-hydration').textContent = `${state.hydration}%`;
}

async function syncPlantState() {
  const state = await window.PlantCompanionState.getStoredPlantState();
  renderSetup(state);
  if (!state) setStatus('Choose a plant type and location to start.');
}

async function syncToggleFromCurrentTab() {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error('No active tab found.');

    const response = await sendPlantMessage(tab.id, { type: 'PLANT_GET_VISIBILITY' });
    toggle.checked = response?.isVisible !== false;
    setStatus(toggle.checked ? 'Plant is visible on this tab.' : 'Plant is hidden on this tab.');
  } catch (_error) {
    toggle.disabled = true;
    setStatus('Open an ordinary webpage to use the plant overlay.');
  }
}

setupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const state = window.PlantCompanionState.createInitialPlantState({
    plantType: plantTypeInput.value,
    location: locationInput.value,
  });

  const savedState = await window.PlantCompanionState.savePlantState(state);
  renderSetup(savedState);
  await refreshActiveTabPlant();
  setStatus('Plant setup saved. Refreshing pages will preserve this plant.');
});

resetSetup.addEventListener('click', async () => {
  const currentState = await window.PlantCompanionState.getStoredPlantState();
  if (currentState) {
    plantTypeInput.value = currentState.plantType;
    locationInput.value = currentState.location;
  }
  setupPanel.hidden = false;
  plantPanel.hidden = true;
  setStatus('Update your setup and save again.');
});

toggle.addEventListener('change', async () => {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error('No active tab found.');

    const response = await sendPlantMessage(tab.id, {
      type: 'PLANT_SET_VISIBILITY',
      isVisible: toggle.checked,
    });

    toggle.checked = response?.isVisible !== false;
    setStatus(toggle.checked ? 'Plant is visible on this tab.' : 'Plant is hidden on this tab.');
  } catch (_error) {
    toggle.checked = !toggle.checked;
    setStatus('Could not update this page. Try an ordinary webpage.');
  }
});

syncPlantState();
syncToggleFromCurrentTab();
