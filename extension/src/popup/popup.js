const toggle = document.getElementById('plant-toggle');
const statusText = document.getElementById('status');
const setupPanel = document.getElementById('setup-panel');
const plantPanel = document.getElementById('plant-panel');
const setupForm = document.getElementById('setup-form');
const plantTypeInput = document.getElementById('plant-type');
const locationInput = document.getElementById('location');
const plantPreview = document.getElementById('plant-preview');
const resetSetup = document.getElementById('reset-setup');
const refreshWeather = document.getElementById('refresh-weather');
let weatherStatusMessage = '';
const DAY_MS = 24 * 60 * 60 * 1000;

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function sendPlantMessage(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

function isCurrentRenderer(response) {
  return response?.rendererVersion === window.PlantCompanionState.RENDERER_VERSION;
}

function toCurrentRendererMessage(message) {
  if (message?.type === 'PLANT_GET_VISIBILITY') {
    return { ...message, type: 'PLANT_CURRENT_GET_VISIBILITY' };
  }

  if (message?.type === 'PLANT_SET_VISIBILITY') {
    return { ...message, type: 'PLANT_CURRENT_SET_VISIBILITY' };
  }

  if (message?.type === 'PLANT_REFRESH_STATE') {
    return { ...message, type: 'PLANT_CURRENT_REFRESH_STATE' };
  }

  return message;
}

async function injectCurrentCompanion(tabId) {
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ['src/content/overlay.css'],
  }).catch(() => {});

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['src/sharedPlantState.js', 'src/content/injectPlant.js'],
  });
}

async function sendPlantMessageWithCurrentRenderer(tabId, message) {
  const currentMessage = toCurrentRendererMessage(message);
  const response = await sendPlantMessage(tabId, currentMessage).catch(() => null);
  if (isCurrentRenderer(response)) return response;

  await injectCurrentCompanion(tabId);
  const refreshedResponse = await sendPlantMessage(tabId, currentMessage);
  if (isCurrentRenderer(refreshedResponse)) return refreshedResponse;

  throw new Error('Current plant companion renderer did not respond.');
}

function setStatus(message, options = {}) {
  if (options.kind === 'weather') weatherStatusMessage = message;
  statusText.textContent = message;
}

function formatElapsedDays(createdAt) {
  const createdTime = Date.parse(createdAt);
  if (!Number.isFinite(createdTime)) return 'Unknown';

  const elapsedDays = Math.round(Math.max(0, (Date.now() - createdTime) / DAY_MS) * 10) / 10;
  const formattedDays = Number.isInteger(elapsedDays) ? String(elapsedDays) : elapsedDays.toFixed(1);
  return `${formattedDays} ${elapsedDays === 1 ? 'day' : 'days'}`;
}

function formatWeatherTime(value) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function formatRainDetails(weather) {
  if (!weather) return 'No data';
  const rainfall = window.PlantCompanionState.getRainfallAmount(weather);
  const intensity = window.PlantCompanionState.getRainIntensity(weather);
  return `${rainfall.toFixed(1)} mm (${intensity})`;
}

async function renderStoredPlantOnActiveTab() {
  const tab = await getActiveTab();
  if (tab?.id) {
    await sendPlantMessageWithCurrentRenderer(tab.id, { type: 'PLANT_REFRESH_STATE', renderOnly: true }).catch(() => {});
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
  document.getElementById('fact-elapsed-days').textContent = formatElapsedDays(state.createdAt);
  document.getElementById('fact-growth').textContent = `Stage ${state.growthStage} · ${Math.round(state.growthProgress)}%`;
  document.getElementById('fact-health').textContent = `${Math.round(state.health)}%`;
  document.getElementById('fact-hydration').textContent = `${Math.round(state.hydration)}%`;
  document.getElementById('fact-weather').textContent = state.weatherSummary;
  document.getElementById('fact-rain').textContent = formatRainDetails(state.weather);
  document.getElementById('fact-weather-updated').textContent = formatWeatherTime(state.weatherUpdatedAt);
  document.getElementById('fact-flowers').textContent = String(Math.round(state.flowerCount));
}

async function syncPlantState(options = {}) {
  const storedState = await window.PlantCompanionState.getStoredPlantState();
  if (!storedState) {
    renderSetup(null);
    setStatus('Choose a plant type and location to start.');
    await renderStoredPlantOnActiveTab();
    return null;
  }

  setStatus('Checking local weather…');
  let weatherError = null;
  const state = await window.PlantCompanionState.refreshPlantStateForWeather(options).catch((error) => {
    weatherError = error;
    return window.PlantCompanionState.savePlantState(window.PlantCompanionState.advancePlantState(storedState));
  });
  renderSetup(state);
  await renderStoredPlantOnActiveTab();
  if (state.weather) {
    setStatus(`Updated from ${state.weather.placeName} weather. Rain: ${formatRainDetails(state.weather)}.`, { kind: 'weather' });
  } else if (weatherError) {
    setStatus(`Weather unavailable: ${weatherError.message}. Using elapsed time until weather is available.`, { kind: 'weather' });
  } else {
    setStatus('Using elapsed time until weather is available.', { kind: 'weather' });
  }
  return state;
}

async function syncToggleFromCurrentTab() {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error('No active tab found.');

    const response = await sendPlantMessageWithCurrentRenderer(tab.id, { type: 'PLANT_GET_VISIBILITY' });
    toggle.checked = response?.isVisible !== false;
    setStatus(`${weatherStatusMessage ? `${weatherStatusMessage} ` : ''}${toggle.checked ? 'Plant is visible on this tab.' : 'Plant is hidden on this tab.'}`);
  } catch (_error) {
    toggle.disabled = true;
    setStatus(`${weatherStatusMessage ? `${weatherStatusMessage} ` : ''}Open an ordinary webpage to use the plant overlay.`);
  }
}

setupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const state = window.PlantCompanionState.createInitialPlantState({
    plantType: plantTypeInput.value,
    location: locationInput.value,
  });

  const savedState = await window.PlantCompanionState.savePlantState(state);
  let weatherError = null;
  const refreshedState = await window.PlantCompanionState.refreshPlantStateForWeather().catch((error) => {
    weatherError = error;
    return savedState;
  });
  renderSetup(refreshedState);
  await renderStoredPlantOnActiveTab();
  if (refreshedState.weather) {
    setStatus('Plant setup saved with local weather.');
  } else if (weatherError) {
    setStatus(`Plant setup saved. Weather unavailable: ${weatherError.message}`);
  } else {
    setStatus('Plant setup saved. Weather will retry later.');
  }
});

refreshWeather.addEventListener('click', async () => {
  refreshWeather.disabled = true;
  setStatus('Refreshing weather now…');
  try {
    await syncPlantState({ force: true });
  } finally {
    refreshWeather.disabled = false;
  }
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

    const response = await sendPlantMessageWithCurrentRenderer(tab.id, {
      type: 'PLANT_SET_VISIBILITY',
      isVisible: toggle.checked,
    });

    toggle.checked = response?.isVisible !== false;
    setStatus(`${weatherStatusMessage ? `${weatherStatusMessage} ` : ''}${toggle.checked ? 'Plant is visible on this tab.' : 'Plant is hidden on this tab.'}`);
  } catch (_error) {
    toggle.checked = !toggle.checked;
    setStatus('Could not update this page. Try an ordinary webpage.');
  }
});

syncPlantState();
syncToggleFromCurrentTab();
