const DEFAULT_REDIRECT = '/account';
const ALLOWED_PREFIXES = ['/account', '/garden'];

export function safeRedirect(value: unknown, fallback = DEFAULT_REDIRECT): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback;
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return fallback; }
  if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\\u0000-\u001f]/u.test(decoded)) return fallback;
  try {
    const parsed = new URL(decoded, 'https://plant.invalid');
    if (parsed.origin !== 'https://plant.invalid') return fallback;
    if (!ALLOWED_PREFIXES.some((prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`))) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch { return fallback; }
}
