import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeSupabaseUrl, readPublicEnvironment } from '../lib/env/public.ts';
import { safeRedirect } from '../lib/auth/redirect.ts';
import { validateProfileInput, toPublicContributor } from '../lib/auth/profile.ts';

test('public environment accepts complete values and reports missing configuration', () => {
  assert.equal(readPublicEnvironment({ NEXT_PUBLIC_SITE_URL: 'http://localhost:3000', NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public' }).supabaseAnonKey, 'public');
  assert.throws(() => readPublicEnvironment({}), /NEXT_PUBLIC_SITE_URL/);
});

test('public environment converts a copied Supabase REST endpoint to the project URL', () => {
  const environment = readPublicEnvironment({
    NEXT_PUBLIC_SITE_URL: 'https://plant-community-garden.netlify.app',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co/rest/v1/',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public',
  });

  assert.equal(environment.supabaseUrl, 'https://example.supabase.co');
  assert.equal(normalizeSupabaseUrl('https://example.supabase.co/rest/v1/'), 'https://example.supabase.co');
});

test('authentication proxy normalizes the Supabase URL before creating its client', () => {
  const proxySource = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8');
  assert.match(proxySource, /createServerClient\(normalizeSupabaseUrl\(url\), key/);
});

test('client environment boundary never references service-role configuration', () => {
  const publicSource = readFileSync(new URL('../lib/env/public.ts', import.meta.url), 'utf8');
  const clientSource = readFileSync(new URL('../lib/supabase/client.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(publicSource + clientSource, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(publicSource, /process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
});

test('redirects are restricted to intended internal paths', () => {
  assert.equal(safeRedirect('/account?tab=profile'), '/account?tab=profile');
  for (const value of [undefined, 'https://evil.test', '//evil.test', 'javascript:alert(1)', '%2f%2fevil.test', '/%2F%2Fevil.test', 123]) assert.equal(safeRedirect(value), '/account');
  assert.equal(safeRedirect('/admin'), '/account');
});

test('profile validation allowlists fields and supported states', () => {
  assert.deepEqual(validateProfileInput({ firstName: '  Ana  María ', stateCode: 'ca' }), { firstName: 'Ana María', stateCode: 'CA' });
  assert.throws(() => validateProfileInput({ firstName: 'x'.repeat(51), stateCode: 'CA' }), /first name/);
  assert.throws(() => validateProfileInput({ firstName: 'Ana', stateCode: 'ZZ' }), /state/);
  assert.throws(() => validateProfileInput({ firstName: 'Ana', stateCode: 'CA', latitude: 1 }), /Unexpected/);
});

test('public contributor mapping is an explicit privacy allowlist', () => {
  const mapped = toPublicContributor({ id: 'public-id', account_id: 'private-id', email: 'a@example.test', access_token: 'secret', latitude: 1, display_first_name: 'Ana', state_code: 'CA', visibility_status: 'private' });
  assert.deepEqual(mapped, { publicContributorId: 'public-id', displayFirstName: 'Ana', stateCode: 'CA', visibilityStatus: 'private' });
});

test('migration protects ownership and derives account identity from auth.uid()', () => {
  const sql = readFileSync(new URL('../../../supabase/migrations/20260719000000_website_auth_foundation.sql', import.meta.url), 'utf8');
  assert.match(sql, /enable row level security/g);
  assert.match(sql, /auth\.uid\(\)\) = account_id/g);
  assert.match(sql, /grant update\(first_name, state_code\)/);
  assert.ok(sql.includes("account_profiles_first_name_characters check (first_name is null or first_name ~ '^[[:alpha:] .''-]+$')"));
  assert.doesNotMatch(sql, /latitude|longitude|garden_plant|extension_link/i);
});

test('extension linking migration hashes secrets and closes direct table access', () => {
  const sql = readFileSync(new URL('../../../supabase/migrations/20260729000000_extension_account_linking.sql', import.meta.url), 'utf8');
  for (const table of ['extension_installations', 'account_link_challenges', 'installation_credentials']) assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(sql, /token_hash text unique not null/);
  assert.match(sql, /credential_hash text unique not null/);
  assert.match(sql, /for update/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.doesNotMatch(sql, /garden_plants|garden_plots|biome/i);
});
