import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(repositoryRoot, 'apps/extension');
const outputRoot = path.resolve(repositoryRoot, process.env.EXTENSION_OUTPUT_DIR || 'dist/extension');

export function validateReleaseOrigin(value) {
  if (!value?.trim()) throw new Error('Missing EXTENSION_SITE_ORIGIN for release packaging. Supply the deployed HTTPS site origin.');
  let url;
  try { url = new URL(value); } catch { throw new Error('EXTENSION_SITE_ORIGIN must be a valid absolute URL.'); }
  if (url.protocol !== 'https:') throw new Error('EXTENSION_SITE_ORIGIN must use HTTPS for release packaging.');
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1') throw new Error('EXTENSION_SITE_ORIGIN must not target localhost for release packaging.');
  if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/')) throw new Error('EXTENSION_SITE_ORIGIN must be an origin without credentials, path, query, or fragment.');
  return url.origin;
}

export async function packageExtension(origin = process.env.EXTENSION_SITE_ORIGIN) {
  const normalizedOrigin = validateReleaseOrigin(origin);
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(path.dirname(outputRoot), { recursive: true });
  await cp(sourceRoot, outputRoot, { recursive: true });
  const configPath = path.join(outputRoot, 'src/config/siteOrigin.js');
  const config = await readFile(configPath, 'utf8');
  const configured = config.replace("const SITE_ORIGIN = 'http://localhost:3000';", `const SITE_ORIGIN = ${JSON.stringify(normalizedOrigin)};`);
  if (configured === config) throw new Error('Extension site-origin configuration marker was not found.');
  await writeFile(configPath, configured);
  console.log(`Packaged release extension for ${normalizedOrigin} at ${path.relative(repositoryRoot, outputRoot)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  packageExtension().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
