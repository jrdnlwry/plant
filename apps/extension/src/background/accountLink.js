(() => {
  const STORAGE_KEY = 'ambientPlantAccountLink';
  const CREDENTIAL_KEY = 'ambientPlantInstallationCredential';

  function randomHex(bytes) {
    const values = new Uint8Array(bytes);
    crypto.getRandomValues(values);
    return [...values].map((value) => value.toString(16).padStart(2, '0')).join('');
  }
  async function getState() {
    const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
    if (stored?.installationId) return stored;
    const state = { installationId: `inst_${randomHex(24)}`, status: 'unlinked' };
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
    return state;
  }
  async function begin() {
    const current = await getState();
    const response = await fetch(globalThis.PlantSite.accountLinkChallengeUrl(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ installationId: current.installationId }) });
    const result = await response.json();
    if (!response.ok) {
      const failed = { ...current, status: result.error?.code === 'installation-revoked' ? 'revoked' : 'failed', lastCheckedAt: new Date().toISOString() };
      await chrome.storage.local.set({ [STORAGE_KEY]: failed }); throw new Error(result.error?.message || 'Account linking failed.');
    }
    const state = { installationId: current.installationId, status: 'pending', challengeId: result.challengeId, challengeExpiresAt: result.expiresAt, challengeToken: result.challengeToken };
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
    await chrome.tabs.create({ url: globalThis.PlantSite.accountLinkApprovalUrl(result.challengeToken) });
    return publicState(state);
  }
  async function refresh() {
    const current = await getState();
    if (!current.challengeToken) return publicState(current);
    const response = await fetch(globalThis.PlantSite.accountLinkStatusUrl(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challengeToken: current.challengeToken }) });
    const result = await response.json();
    if (!response.ok) {
      const failed = { ...current, status: result.error?.code === 'installation-revoked' ? 'revoked' : 'failed', lastCheckedAt: new Date().toISOString() };
      await chrome.storage.local.set({ [STORAGE_KEY]: failed }); return publicState(failed);
    }
    const now = new Date().toISOString();
    if (result.status !== 'linked') return publicState({ ...current, status: 'pending', lastCheckedAt: now });
    const linked = { installationId: current.installationId, status: 'linked', challengeId: current.challengeId, publicContributorId: result.publicContributorId, linkedAt: result.linkedAt, lastCheckedAt: now };
    await chrome.storage.local.set({ [STORAGE_KEY]: linked, [CREDENTIAL_KEY]: { token: result.credential, expiresAt: result.credentialExpiresAt, installationId: current.installationId } });
    return publicState(linked);
  }
  async function clear() {
    const current = await getState();
    const state = { installationId: current.installationId, status: 'unlinked' };
    await chrome.storage.local.remove(CREDENTIAL_KEY); await chrome.storage.local.set({ [STORAGE_KEY]: state }); return state;
  }
  function publicState(state) { const { challengeToken: _secret, ...safe } = state; return safe; }
  globalThis.PlantAccountLink = { get: async () => publicState(await getState()), begin, refresh, clear };
})();
