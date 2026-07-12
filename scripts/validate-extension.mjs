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
  assertFileExists('src/sharedPlantState.js', 'Shared plant-state script');
  assertFileExists('src/content/injectPlant.js', 'Content script');
  assertFileExists('src/content/overlay.css', 'Content CSS');

  console.log('Extension manifest and referenced files are valid.');
}

validateExtension().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
