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
const waterPlant = document.getElementById('water-plant');
const wateringFeedback = document.getElementById('watering-feedback');
const completionPanel = document.getElementById('completion-panel');
const completionPreview = document.getElementById('completion-preview');
const addToGarden = document.getElementById('add-to-garden');
const keepPrivate = document.getElementById('keep-private');
const accountLinkState = document.getElementById('account-link-state');
const linkAccount = document.getElementById('link-account');
const refreshAccountLink = document.getElementById('refresh-account-link');
const clearAccountLink = document.getElementById('clear-account-link');
const publicationPanel = document.getElementById('publication-panel');
const publicationState = document.getElementById('publication-state');
const submitPublication = document.getElementById('submit-publication');
const publicationPath = document.getElementById('publication-path');
let weatherStatusMessage = '';
let pendingCompletionCommand = null;
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
  const wateredToday = state.lastManuallyWateredDate === window.PlantCompanionState.toLocalCalendarDate();
  waterPlant.disabled = wateredToday;
  waterPlant.textContent = wateredToday ? 'Watered today' : 'Water plant';
  if (wateredToday && !wateringFeedback.textContent) wateringFeedback.textContent = 'Available again tomorrow.';
}

waterPlant.addEventListener('click', async () => {
  waterPlant.disabled = true;
  const requestId = globalThis.crypto.randomUUID();
  try {
    const response = await requestLifecycleMutation({ type: 'PLANT_MANUALLY_WATER', requestId });
    const result = response.watering;
    renderSetup(result.state);
    wateringFeedback.textContent = result.status === 'watered' || result.status === 'already-applied'
      ? `You watered your plant. Hydration +${result.hydrationGain}%.`
      : 'Watered today. Available again tomorrow.';
    await renderStoredPlantOnActiveTab();
  } catch (error) {
    wateringFeedback.textContent = error.message || 'Could not water your plant.';
    waterPlant.disabled = false;
  }
});

async function renderCompletionDecision(state) {
  const response = await requestLifecycleMutation({ type: 'PLANT_REQUEST_COMPLETION_STATUS' });
  const status = response.completionStatus;
  const shouldDecide = Boolean(state && status?.completionRequired && status.plantId === state.plantId);
  pendingCompletionCommand = shouldDecide
    ? { plantId: status.plantId, expectedRevision: status.expectedRevision }
    : null;
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

async function renderPublicationStatus() {
  const response = await requestLifecycleMutation({ type: 'PLANT_GET_PUBLICATION_STATUS' });
  const publication = response.publication;
  publicationPanel.hidden = publication?.status === 'none';
  if (publicationPanel.hidden) return;
  const labels = { pending: 'Pending publication.', submitting: 'Submission in progress…', failed: publication.error?.message || 'Submission failed.', submitted: 'Published successfully.' };
  publicationState.textContent = labels[publication.status] || 'Pending publication.';
  submitPublication.hidden = publication.status === 'submitted';
  submitPublication.disabled = publication.status === 'submitting';
  submitPublication.textContent = publication.status === 'failed' ? 'Retry submission' : 'Submit to garden';
  submitPublication.dataset.publicationIntentId = publication.publicationIntentId || '';
  publicationPath.hidden = publication.status !== 'submitted';
  if (publication.receipt?.publicGardenPath) publicationPath.href = `http://localhost:3000${publication.receipt.publicGardenPath}`;
}
submitPublication.addEventListener('click', async () => {
  submitPublication.disabled = true;
  publicationState.textContent = 'Submission in progress…';
  try { await requestLifecycleMutation({ type: 'PLANT_RETRY_PUBLICATION_INTENT', publicationIntentId: submitPublication.dataset.publicationIntentId }); }
  catch (error) { publicationState.textContent = error.message || 'Submission failed.'; }
  await renderPublicationStatus();
});

function renderAccountLink(state) {
  const labels = { unlinked: 'Not linked. Private extension use remains available.', pending: 'Linking pending. Approve in the website, then check status.', linked: 'Linked. Future publication requests can be authenticated.', failed: 'Link failed. Retry when ready.', revoked: 'This installation link was revoked.' };
  accountLinkState.textContent = labels[state?.status] || labels.unlinked;
  linkAccount.textContent = state?.status === 'failed' ? 'Retry linking' : 'Link account';
  linkAccount.hidden = state?.status === 'linked' || state?.status === 'pending' || state?.status === 'revoked';
  refreshAccountLink.hidden = state?.status !== 'pending';
  // Remote revocation is intentionally deferred; never discard a working credential locally.
  clearAccountLink.hidden = true;
}
async function accountLinkCommand(type) {
  for (const button of [linkAccount, refreshAccountLink, clearAccountLink]) button.disabled = true;
  try { const response = await requestLifecycleMutation({ type }); renderAccountLink(response.accountLink); }
  catch (error) { accountLinkState.textContent = error.message || 'Account linking failed.'; }
  finally { for (const button of [linkAccount, refreshAccountLink, clearAccountLink]) button.disabled = false; }
}
linkAccount.addEventListener('click', () => accountLinkCommand('PLANT_BEGIN_ACCOUNT_LINK'));
refreshAccountLink.addEventListener('click', () => accountLinkCommand('PLANT_REFRESH_ACCOUNT_LINK'));
clearAccountLink.addEventListener('click', () => accountLinkCommand('PLANT_CLEAR_ACCOUNT_LINK'));

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
    if (!pendingCompletionCommand) throw new Error('This plant no longer needs a completion decision.');
    const response = await requestLifecycleMutation({
      type: 'PLANT_COMPLETE_LIFECYCLE',
      ...pendingCompletionCommand,
      decision,
    });
    const result = response.completion;
    if (!result) throw new Error('This plant lifecycle was already restarted.');
    completionPanel.hidden = true;
    renderSetup(result.nextPlant);
    await renderStoredPlantOnActiveTab();
    pendingCompletionCommand = null;
    setStatus(decision === 'accepted'
      ? 'Plant archived privately and garden intent saved. A new plant has started.'
      : 'Plant archived privately. A new plant has started.');
    await renderPublicationStatus();
  } catch (error) {
    setStatus(error.message || 'Could not restart the plant lifecycle.');
  } finally {
    addToGarden.disabled = false;
    keepPrivate.disabled = false;
  }
}

addToGarden.addEventListener('click', () => resolveCompletion('accepted'));
keepPrivate.addEventListener('click', () => resolveCompletion('declined'));

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
accountLinkCommand('PLANT_GET_ACCOUNT_LINK_STATUS');
renderPublicationStatus();
