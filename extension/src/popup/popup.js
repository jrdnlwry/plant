const toggle = document.getElementById('plant-toggle');
const statusText = document.getElementById('status');

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

syncToggleFromCurrentTab();
