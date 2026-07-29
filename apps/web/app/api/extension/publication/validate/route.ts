import { COMPLETED_PLANT_SNAPSHOT_VERSION, PUBLICATION_AUTHORIZATION_CONTRACT_VERSION, validatePublicationAuthorizationRequest } from '@plant/plant-core';
import { createAdminClient } from '../../../../../lib/supabase/admin';
import { hashSecret, linkError } from '../../../../../lib/account-link/server';

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return linkError('credential-invalid', 'Installation authentication is required.', 401);
  let input;
  try { input = validatePublicationAuthorizationRequest(await request.json()); }
  catch { return linkError('invalid-publication-intent', 'Publication intent metadata is malformed.'); }
  if (input.contractVersion !== PUBLICATION_AUTHORIZATION_CONTRACT_VERSION || input.snapshotVersion !== COMPLETED_PLANT_SNAPSHOT_VERSION) return linkError('unsupported-version', 'The publication contract or snapshot version is unsupported.', 422);
  const credentialHash = hashSecret(authorization.slice(7));
  const admin = createAdminClient();
  const { data: credential } = await admin.from('installation_credentials').select('installation_id,expires_at,revoked_at').eq('credential_hash', credentialHash).maybeSingle();
  if (!credential || credential.revoked_at) return linkError('credential-invalid', 'Installation credential is invalid.', 401);
  if (Date.parse(credential.expires_at) <= Date.now()) return linkError('credential-expired', 'Installation credential expired.', 401);
  if (credential.installation_id !== input.installationId) return linkError('credential-invalid', 'Credential does not match the installation.', 401);
  const { data: installation } = await admin.from('extension_installations').select('installation_id,revoked_at,account_profiles!extension_installations_account_id_fkey(first_name,state_code),public_contributors!extension_installations_public_contributor_id_fkey(public_id,display_first_name,state_code,visibility_status)').eq('installation_id', input.installationId).maybeSingle();
  if (!installation) return linkError('credential-invalid', 'Unknown installation.', 401);
  if (installation.revoked_at) return linkError('installation-revoked', 'Installation is revoked.', 403);
  const profile = Array.isArray(installation.account_profiles) ? installation.account_profiles[0] : installation.account_profiles;
  const contributor = Array.isArray(installation.public_contributors) ? installation.public_contributors[0] : installation.public_contributors;
  if (!profile?.first_name || !profile?.state_code) return linkError('profile-incomplete', 'Account profile is incomplete.', 409);
  if (!contributor?.public_id || contributor.visibility_status === 'hidden') return linkError('profile-incomplete', 'Public contributor is unavailable.', 409);
  return Response.json({ authorized: true, installationId: installation.installation_id, publicContributor: { id: contributor.public_id, firstName: profile.first_name, stateCode: profile.state_code }, acceptedContractVersion: PUBLICATION_AUTHORIZATION_CONTRACT_VERSION, acceptedSnapshotVersion: COMPLETED_PLANT_SNAPSHOT_VERSION });
}
