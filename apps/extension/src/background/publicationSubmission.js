(() => {
  const INTENTS_KEY = 'ambientPlantPublicationIntents';
  const ARCHIVE_KEY = 'ambientPlantArchive';
  const CREDENTIAL_KEY = 'ambientPlantInstallationCredential';
  const API_BASE = 'http://localhost:3000';

  async function status() {
    const stored = await chrome.storage.local.get([INTENTS_KEY, ARCHIVE_KEY]);
    const intents = Array.isArray(stored[INTENTS_KEY]) ? stored[INTENTS_KEY] : [];
    const intent = [...intents].reverse().find((item) => ['pending', 'submitting', 'failed', 'submitted'].includes(item.state));
    if (!intent) return { status: 'none' };
    // A suspended MV3 worker cannot prove an in-flight request is alive.
    return { status: intent.state === 'submitting' ? 'failed' : intent.state, publicationIntentId: intent.publicationIntentId, receipt: intent.receipt, error: intent.error };
  }

  async function submit(publicationIntentId) {
    const stored = await chrome.storage.local.get([INTENTS_KEY, ARCHIVE_KEY, CREDENTIAL_KEY, 'ambientPlantAccountLink']);
    const intents = Array.isArray(stored[INTENTS_KEY]) ? stored[INTENTS_KEY] : [];
    const index = publicationIntentId ? intents.findIndex((item) => item.publicationIntentId === publicationIntentId) : intents.findIndex((item) => ['pending', 'failed', 'submitting'].includes(item.state));
    if (index < 0) throw new Error('No accepted publication intent is pending.');
    const intent = intents[index];
    const archive = Array.isArray(stored[ARCHIVE_KEY]) ? stored[ARCHIVE_KEY] : [];
    const completed = archive.find((item) => item.completedPlantId === intent.completedPlantId && item.publicationIntentId === intent.publicationIntentId);
    if (!completed || completed.gardenDecision !== 'accepted' || completed.plantId !== intent.localPlantId) throw new Error('Publication archive identity does not match the accepted intent.');
    const credential = stored[CREDENTIAL_KEY];
    const link = stored.ambientPlantAccountLink;
    if (!credential?.token || credential.installationId !== link?.installationId || link.status !== 'linked') throw new Error('Link the extension before publishing.');
    intents[index] = { ...intent, state: 'submitting', lastAttemptAt: new Date().toISOString(), error: undefined };
    await chrome.storage.local.set({ [INTENTS_KEY]: intents });
    try {
      const body = {
        publicationIntentId: intent.publicationIntentId, completedPlantId: intent.completedPlantId,
        sourceLocalPlantId: intent.localPlantId, installationId: link.installationId,
        contractVersion: 1, snapshotVersion: 1,
        completedPlant: { plantType: completed.plantType, visualSeed: completed.visualSeed, createdAt: completed.createdAt, maturedAt: completed.maturedAt, completedAt: completed.completedAt, finalState: completed.finalState },
      };
      const response = await fetch(`${API_BASE}/api/extension/publication/submit`, { method: 'POST', headers: { authorization: `Bearer ${credential.token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw Object.assign(new Error(result.error?.message || 'Garden publication failed.'), { publicationError: result.error });
      const required = ['receiptId', 'publicationIntentId', 'completedPlantId', 'gardenPlantId', 'biome', 'gardenNumber', 'plotId', 'row', 'column', 'publicGardenPath', 'createdAt'];
      if (required.some((key) => result[key] === undefined) || result.publicationIntentId !== intent.publicationIntentId || result.completedPlantId !== intent.completedPlantId) throw new Error('Garden returned an invalid publication receipt.');
      const receipt = { ...result, submittedAt: result.createdAt };
      intents[index] = { ...intent, state: 'submitted', receipt, submittedAt: new Date().toISOString(), error: undefined };
      await chrome.storage.local.set({ [INTENTS_KEY]: intents });
      return { status: 'submitted', publicationIntentId: intent.publicationIntentId, receipt };
    } catch (error) {
      intents[index] = { ...intent, state: 'failed', error: error.publicationError || { code: 'internal-error', message: error.message || 'Garden publication failed.', retryable: true } };
      await chrome.storage.local.set({ [INTENTS_KEY]: intents });
      throw error;
    }
  }
  globalThis.PlantPublicationSubmission = { status, submit };
})();
