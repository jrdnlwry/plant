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
const completionPanel = document.getElementById('completion-panel');
const completionPreview = document.getElementById('completion-preview');
const addToGarden = document.getElementById('add-to-garden');
const keepPrivate = document.getElementById('keep-private');
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
    files: ['src/generated/plantRenderer.global.js', 'src/sharedPlantState.js', 'src/content/injectPlant.js'],
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

async function renderCompletionDecision(state) {
  const pending = await window.PlantCompanionState.getPendingLifecycleCompletion();
  const shouldDecide = Boolean(state && pending?.plantId === state.plantId
    && window.PlantCompanionState.isPlantLifecycleComplete(state));
  completionPanel.hidden = !shouldDecide;
  plantPanel.hidden = shouldDecide || !state;
  if (shouldDecide) completionPreview.innerHTML = window.PlantCompanionState.renderPlantSvg(state);
  return shouldDecide;
}

async function requestLifecycleMutation(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || 'Lifecycle update failed.');
  return response;
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
  const response = await requestLifecycleMutation({
    type: 'PLANT_REQUEST_LIFECYCLE_UPDATE',
    force: Boolean(options.force),
  });
  const state = response.state || await window.PlantCompanionState.getStoredPlantState();
  renderSetup(state);
  const awaitingDecision = await renderCompletionDecision(state);
  await renderStoredPlantOnActiveTab();
  if (awaitingDecision) {
    setStatus('Choose what happens to your completed plant.');
  } else if (response.weatherError) {
    setStatus(`Weather unavailable: ${response.weatherError}. Using elapsed time until weather is available.`, { kind: 'weather' });
  } else if (state.weather) {
    setStatus(`Updated from ${state.weather.placeName} weather. Rain: ${formatRainDetails(state.weather)}.`, { kind: 'weather' });
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
  const response = await requestLifecycleMutation({
    type: 'PLANT_INITIALIZE',
    plantType: plantTypeInput.value,
    location: locationInput.value,
  });
  const refreshedState = response.state;
  renderSetup(refreshedState);
  await renderStoredPlantOnActiveTab();
  if (refreshedState.weather) {
    setStatus('Plant setup saved with local weather.');
  } else if (response.weatherError) {
    setStatus(`Plant setup saved. Weather unavailable: ${response.weatherError}`);
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

async function resolveCompletion(decision) {
  addToGarden.disabled = true;
  keepPrivate.disabled = true;
  try {
    const response = await requestLifecycleMutation({ type: 'PLANT_COMPLETE_LIFECYCLE', decision });
    const result = response.completion;
    if (!result) throw new Error('This plant lifecycle was already restarted.');
    completionPanel.hidden = true;
    renderSetup(result.nextPlant);
    await renderStoredPlantOnActiveTab();
    setStatus(decision === 'community-garden'
      ? 'Plant archived privately and garden intent saved. A new plant has started.'
      : 'Plant archived privately. A new plant has started.');
  } catch (error) {
    setStatus(error.message || 'Could not restart the plant lifecycle.');
  } finally {
    addToGarden.disabled = false;
    keepPrivate.disabled = false;
  }
}

addToGarden.addEventListener('click', () => resolveCompletion('community-garden'));
keepPrivate.addEventListener('click', () => resolveCompletion('private'));

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
