import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const extensionRoot = path.resolve('apps/extension');
const manifestPath = path.join(extensionRoot, 'manifest.json');

function assertFileExists(relativePath, label = relativePath) {
  const absolutePath = path.join(extensionRoot, relativePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`${label} is missing: ${path.relative(process.cwd(), absolutePath)}`);
  }
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
