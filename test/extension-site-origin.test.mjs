import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { validateReleaseOrigin } from '../scripts/package-extension.mjs';

const sourcePath = new URL('../apps/extension/src/config/siteOrigin.js', import.meta.url);

async function loadSite(origin) {
  let source = await readFile(sourcePath, 'utf8');
  if (origin) source = source.replace("const SITE_ORIGIN = 'http://localhost:3000';", `const SITE_ORIGIN = ${JSON.stringify(origin)};`);
  const context = vm.createContext({ URL, globalThis: {} });
  context.globalThis = context;
  vm.runInContext(source, context);
  return context.PlantSite;
}

test('development configuration builds all web-app URLs from localhost', async () => {
  const site = await loadSite();
  assert.equal(site.origin, 'http://localhost:3000');
  assert.equal(site.accountLinkChallengeUrl(), 'http://localhost:3000/api/extension/link/challenges');
  assert.equal(site.accountLinkStatusUrl(), 'http://localhost:3000/api/extension/link/status');
  assert.equal(site.publicationSubmissionUrl(), 'http://localhost:3000/api/extension/publication/submit');
});

for (const origin of ['https://beta.example.com', 'https://beta.example.com/']) {
  test(`release URLs normalize ${origin}`, async () => {
    const site = await loadSite(origin);
    const urls = [
      site.accountLinkChallengeUrl(),
      site.accountLinkStatusUrl(),
      site.accountLinkApprovalUrl('token value'),
      site.publicationSubmissionUrl(),
      site.gardenUrl('/garden/south/42'),
    ];
    assert.ok(urls.every((url) => url.startsWith('https://beta.example.com/')));
    assert.ok(urls.every((url) => !url.includes('localhost') && !url.includes('.com//')));
    assert.equal(site.accountLinkApprovalUrl('token value'), 'https://beta.example.com/account/link-extension?challenge=token+value');
    assert.equal(site.gardenUrl('/garden/south/42'), 'https://beta.example.com/garden/south/42');
  });
}

test('release origin validation fails closed', () => {
  assert.throws(() => validateReleaseOrigin(), /Missing EXTENSION_SITE_ORIGIN/);
  assert.throws(() => validateReleaseOrigin('not a URL'), /valid absolute URL/);
  assert.throws(() => validateReleaseOrigin('http://example.com'), /use HTTPS/);
  assert.throws(() => validateReleaseOrigin('https://localhost:3000'), /must not target localhost/);
  assert.throws(() => validateReleaseOrigin('https://127.0.0.1'), /must not target localhost/);
  assert.equal(validateReleaseOrigin('https://beta.example.com/'), 'https://beta.example.com');
});
