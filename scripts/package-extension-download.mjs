import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionRoot = path.join(repositoryRoot, 'dist/extension');
const downloadRoot = path.join(repositoryRoot, 'apps/web/public/downloads');
const manifest = JSON.parse(await readFile(path.join(extensionRoot, 'manifest.json'), 'utf8'));
const release = JSON.parse(await readFile(path.join(repositoryRoot, 'apps/extension/release-metadata.json'), 'utf8'));
const releaseVersion = `${manifest.version}-${release.channel}.${release.iteration}`;
const filename = `plant-extension-v${releaseVersion}.zip`;
const archive = path.join(downloadRoot, filename);

async function runtimeFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await runtimeFiles(absolute));
    else files.push(absolute);
  }
  return files;
}

const configuredOrigin = process.env.EXTENSION_SITE_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL;
if (!configuredOrigin) throw new Error('EXTENSION_SITE_ORIGIN or NEXT_PUBLIC_SITE_URL is required.');
const normalizedOrigin = new URL(configuredOrigin).origin;
const config = await readFile(path.join(extensionRoot, 'src/config/siteOrigin.js'), 'utf8');
if (!config.includes(JSON.stringify(normalizedOrigin))) throw new Error('Packaged extension origin does not match the configured deployment origin.');

for (const file of await runtimeFiles(extensionRoot)) {
  if (!/\.(?:js|json|html|css)$/.test(file)) continue;
  if (/\b(?:localhost|127\.0\.0\.1)\b/i.test(await readFile(file, 'utf8'))) {
    throw new Error(`Release extension contains a development host: ${path.relative(extensionRoot, file)}`);
  }
}

await rm(downloadRoot, { recursive: true, force: true });
await mkdir(downloadRoot, { recursive: true });
const zipped = spawnSync('zip', ['-q', '-r', archive, '.'], { cwd: extensionRoot, encoding: 'utf8' });
if (zipped.status !== 0) throw new Error(`Unable to create extension ZIP: ${zipped.stderr || 'zip failed'}`);
const inspected = spawnSync('unzip', ['-Z1', archive], { encoding: 'utf8' });
if (inspected.status !== 0 || !inspected.stdout.split(/\r?\n/).includes('manifest.json')) {
  throw new Error('Extension ZIP validation failed: manifest.json is not at the archive root.');
}

console.log(`Created and validated ${path.relative(repositoryRoot, archive)} for ${normalizedOrigin}`);
