import { GARDEN_PUBLICATION_CONTRACT_VERSION, GARDEN_RENDERER_SNAPSHOT_VERSION } from '@plant/plant-core';
import { hashSecret, linkError } from '../../../../../lib/account-link/server';
import { biomeForState, PublicationValidationError, snapshotDigest, validateGardenPublicationRequest } from '../../../../../lib/garden/publication';
import { createAdminClient } from '../../../../../lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ') || authorization.length <= 7) return linkError('authentication-required', 'Installation authentication is required.', 401);
  let input;
  try {
    const length = Number(request.headers.get('content-length') || 0);
    input = validateGardenPublicationRequest(await request.json(), length);
  } catch (error) {
    const validation = error instanceof PublicationValidationError ? error : new PublicationValidationError('invalid-publication-intent', 'Publication request is malformed.');
    return linkError(validation.code, validation.message, validation.code === 'snapshot-too-large' ? 413 : 422);
  }
  if (input.contractVersion !== GARDEN_PUBLICATION_CONTRACT_VERSION) return linkError('unsupported-contract-version', 'The publication contract version is unsupported.', 422);
  if (input.snapshotVersion !== GARDEN_RENDERER_SNAPSHOT_VERSION) return linkError('unsupported-snapshot-version', 'The renderer snapshot version is unsupported.', 422);

  const admin = createAdminClient();
  const credentialHash = hashSecret(authorization.slice(7));
  const { data: credential } = await admin.from('installation_credentials').select('installation_id,expires_at,revoked_at').eq('credential_hash', credentialHash).maybeSingle();
  if (!credential || credential.revoked_at) return linkError('credential-invalid', 'Installation credential is invalid.', 401);
  if (Date.parse(credential.expires_at) <= Date.now()) return linkError('credential-expired', 'Installation credential expired.', 401);
  if (credential.installation_id !== input.installationId) return linkError('credential-invalid', 'Credential does not match the installation.', 401);

  const { data: installation } = await admin.from('extension_installations')
    .select('installation_id,account_id,linked_at,revoked_at,account_profiles!extension_installations_account_id_fkey(first_name,state_code),public_contributors!extension_installations_public_contributor_id_fkey(public_id,visibility_status)')
    .eq('installation_id', input.installationId).maybeSingle();
  if (!installation) return linkError('credential-invalid', 'Unknown installation.', 401);
  if (installation.revoked_at) return linkError('installation-revoked', 'Installation is revoked.', 403);
  if (!installation.account_id || !installation.linked_at) return linkError('installation-not-linked', 'Installation is not linked.', 403);
  const profile = Array.isArray(installation.account_profiles) ? installation.account_profiles[0] : installation.account_profiles;
  const contributor = Array.isArray(installation.public_contributors) ? installation.public_contributors[0] : installation.public_contributors;
  if (!profile?.first_name || !profile?.state_code) return linkError('profile-incomplete', 'Account profile is incomplete.', 409);
  if (!contributor?.public_id || contributor.visibility_status === 'hidden') return linkError('public-contributor-missing', 'Public contributor is unavailable.', 409);
  const biome = biomeForState(profile.state_code);
  if (!biome) return linkError('unsupported-region', 'The account profile region is not supported by a garden biome.', 422);

  const digest = snapshotDigest(input);
  const { data, error } = await admin.rpc('publish_completed_plant', {
    p_account_id: installation.account_id,
    p_owner_public_id: contributor.public_id,
    p_biome: biome,
    p_publication_intent_id: input.publicationIntentId,
    p_completed_plant_id: input.completedPlantId,
    p_source_local_plant_id: input.sourceLocalPlantId,
    p_plant_type: input.completedPlant.plantType,
    p_visual_seed: input.completedPlant.visualSeed,
    p_snapshot: input.completedPlant.finalState,
    p_snapshot_version: input.snapshotVersion,
    p_snapshot_digest: digest,
    p_created_at: input.completedPlant.createdAt,
    p_matured_at: input.completedPlant.maturedAt,
  });
  if (data?.error === 'idempotency-conflict') return linkError('idempotency-conflict', 'Publication identity conflicts with an existing publication.', 409);
  if (error) {
    const plotFailure = error.message?.includes('plot-assignment-failed');
    return linkError(plotFailure ? 'plot-assignment-failed' : 'internal-error', plotFailure ? 'No eligible garden plot could be assigned.' : 'Publication could not be completed.', plotFailure ? 409 : 500, true);
  }
  return Response.json(data, { status: data?.idempotentReplay ? 200 : 201 });
}
