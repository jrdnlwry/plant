import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDir, '..');
const extensionRoot = path.join(repositoryRoot, 'apps/extension');
const manifestPath = path.join(extensionRoot, 'manifest.json');

function normalizeExtensionPath(extensionPath) {
  return extensionPath.startsWith('/') ? extensionPath.slice(1) : extensionPath;
}

function assertFileExists(relativePath, label = relativePath) {
  const absolutePath = path.join(extensionRoot, normalizeExtensionPath(relativePath));

  if (!existsSync(absolutePath)) {
    throw new Error(`${label} is missing: ${path.relative(process.cwd(), absolutePath)}`);
  }
}

function collectHtmlResourceFiles(html, htmlPath) {
  const files = new Set();
  const htmlDirectory = path.posix.dirname(normalizeExtensionPath(htmlPath));
  const resourcePattern = /<(?:script|link)\b[^>]*(?:src|href)=['"]([^'"]+)['"][^>]*>/gi;

  for (const match of html.matchAll(resourcePattern)) {
    const resourcePath = match[1];
    if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(resourcePath)) continue;

    const normalizedResourcePath = resourcePath.startsWith('/')
      ? normalizeExtensionPath(resourcePath)
      : path.posix.normalize(path.posix.join(htmlDirectory, resourcePath));
    files.add(normalizedResourcePath);
  }

  return files;
}

function collectManifestFiles(manifest) {
  const files = new Set();

  if (manifest.action?.default_popup) {
    files.add(manifest.action.default_popup);
  }

  if (manifest.background?.service_worker) {
    files.add(manifest.background.service_worker);
  }

  for (const contentScript of manifest.content_scripts ?? []) {
    for (const script of contentScript.js ?? []) files.add(script);
    for (const stylesheet of contentScript.css ?? []) files.add(stylesheet);
  }

  return files;
}

async function validateExtension() {
  if (!existsSync(manifestPath)) {
    throw new Error(`Extension manifest is missing: ${path.relative(process.cwd(), manifestPath)}`);
  }

  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Extension manifest is not valid JSON: ${error.message}`);
  }

  for (const file of collectManifestFiles(manifest)) {
    assertFileExists(file, `Manifest referenced file "${file}"`);
  }

  assertFileExists('src/popup/popup.html', 'Popup HTML');

  const popupPath = manifest.action?.default_popup ?? 'src/popup/popup.html';
  const popupHtml = await readFile(path.join(extensionRoot, normalizeExtensionPath(popupPath)), 'utf8');
  for (const file of collectHtmlResourceFiles(popupHtml, popupPath)) {
    assertFileExists(file, `Popup referenced file "${file}"`);
  }

  assertFileExists('src/background/weatherService.js', 'Background service worker');
  assertFileExists('src/generated/plantRenderer.global.js', 'Generated renderer artifact');
  assertFileExists('src/sharedPlantState.js', 'Shared plant-state script');
  assertFileExists('src/content/injectPlant.js', 'Content script');
  assertFileExists('src/content/overlay.css', 'Content CSS');

  const expectedScripts = [
    'src/generated/plantRenderer.global.js',
    'src/sharedPlantState.js',
    'src/content/injectPlant.js',
  ];
  const popupScripts = [...popupHtml.matchAll(/<script\b[^>]*src=['"]([^'"]+)['"][^>]*>/gi)]
    .map((match) => normalizeExtensionPath(match[1]));
  const popupExpected = expectedScripts.slice(0, 2).concat('src/popup/popup.js');
  if (JSON.stringify(popupScripts) !== JSON.stringify(popupExpected)) {
    throw new Error(`Popup script order must be: ${popupExpected.join(', ')}`);
  }
  for (const contentScript of manifest.content_scripts ?? []) {
    if (JSON.stringify(contentScript.js ?? []) !== JSON.stringify(expectedScripts)) {
      throw new Error(`Content script order must be: ${expectedScripts.join(', ')}`);
    }
  }

  const background = await readFile(path.join(extensionRoot, manifest.background.service_worker), 'utf8');
  if (!/^importScripts\(\s*['"]\/src\/generated\/plantRenderer\.global\.js['"]\s*,\s*['"]\/src\/sharedPlantState\.js['"]\s*\);/.test(background)) {
    throw new Error('Service worker must import the generated renderer before sharedPlantState.js.');
  }
  const generated = await readFile(path.join(extensionRoot, 'src/generated/plantRenderer.global.js'), 'utf8');
  if (/^\s*(?:import|export)\s/m.test(generated)) {
    throw new Error('Generated renderer must not contain ESM imports or exports.');
  }
  if (!generated.startsWith('// Generated from packages/plant-renderer.')) {
    throw new Error('Generated renderer header is missing.');
  }

  console.log('Extension manifest and referenced files are valid.');
}

validateExtension().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
