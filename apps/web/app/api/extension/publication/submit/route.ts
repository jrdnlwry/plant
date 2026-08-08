import {
  GARDEN_PUBLICATION_CONTRACT_VERSION,
  GARDEN_RENDERER_SNAPSHOT_VERSION,
} from '@plant/plant-core';

import {
  hashSecret,
  linkError,
} from '../../../../../lib/account-link/server';

import {
  biomeForState,
  canonicalPublicationSnapshot,
  PublicationValidationError,
  snapshotDigest,
  validateGardenPublicationRequest,
} from '../../../../../lib/garden/publication';

import {
  createAdminClient,
} from '../../../../../lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Bearer ') || authorization.length <= 7) {
    return linkError(
      'authentication-required',
      'Installation authentication is required.',
      401,
    );
  }

  let input;

  try {
    const length = Number(
      request.headers.get('content-length') || 0,
    );

    input = validateGardenPublicationRequest(
      await request.json(),
      length,
    );
  } catch (error) {
    const validation =
      error instanceof PublicationValidationError
        ? error
        : new PublicationValidationError(
            'invalid-publication-intent',
            'Publication request is malformed.',
          );

    return linkError(
      validation.code,
      validation.message,
      validation.code === 'snapshot-too-large' ? 413 : 422,
    );
  }

  if (
    input.contractVersion !== GARDEN_PUBLICATION_CONTRACT_VERSION
  ) {
    return linkError(
      'unsupported-contract-version',
      'The publication contract version is unsupported.',
      422,
    );
  }

  if (
    input.snapshotVersion !== GARDEN_RENDERER_SNAPSHOT_VERSION
  ) {
    return linkError(
      'unsupported-snapshot-version',
      'The renderer snapshot version is unsupported.',
      422,
    );
  }

  const admin = createAdminClient();

  /*
   * Validate the opaque installation credential before doing
   * any account or publication work.
   */
  const credentialHash = hashSecret(
    authorization.slice(7),
  );

  const {
    data: credential,
    error: credentialLookupError,
  } = await admin
    .from('installation_credentials')
    .select('installation_id,expires_at,revoked_at')
    .eq('credential_hash', credentialHash)
    .maybeSingle();

  if (credentialLookupError) {
    console.error(
      'publication credential lookup failed:',
      credentialLookupError,
    );

    return linkError(
      'internal-error',
      'Unable to inspect installation credential.',
      500,
      true,
    );
  }

  if (!credential || credential.revoked_at) {
    return linkError(
      'credential-invalid',
      'Installation credential is invalid.',
      401,
    );
  }

  if (Date.parse(credential.expires_at) <= Date.now()) {
    return linkError(
      'credential-expired',
      'Installation credential expired.',
      401,
    );
  }

  if (credential.installation_id !== input.installationId) {
    return linkError(
      'credential-invalid',
      'Credential does not match the installation.',
      401,
    );
  }

  /*
   * Load the installation directly.
   *
   * Do not use an embedded PostgREST relationship to
   * account_profiles here. extension_installations.account_id
   * references auth.users, not account_profiles directly.
   */
  const {
    data: installation,
    error: installationLookupError,
  } = await admin
    .from('extension_installations')
    .select(
      'installation_id,account_id,public_contributor_id,linked_at,revoked_at',
    )
    .eq('installation_id', input.installationId)
    .maybeSingle();

  if (installationLookupError) {
    console.error(
      'publication installation lookup failed:',
      installationLookupError,
    );

    return linkError(
      'internal-error',
      'Unable to inspect linked installation.',
      500,
      true,
    );
  }

  if (!installation) {
    return linkError(
      'credential-invalid',
      'Unknown installation.',
      401,
    );
  }

  if (installation.revoked_at) {
    return linkError(
      'installation-revoked',
      'Installation is revoked.',
      403,
    );
  }

  if (
    !installation.account_id
    || !installation.public_contributor_id
    || !installation.linked_at
  ) {
    return linkError(
      'installation-not-linked',
      'Installation is not linked.',
      403,
    );
  }

  /*
   * Resolve private profile and public contributor separately.
   */
  const [
    {
      data: profile,
      error: profileError,
    },
    {
      data: contributor,
      error: contributorError,
    },
  ] = await Promise.all([
    admin
      .from('account_profiles')
      .select('first_name,state_code')
      .eq('account_id', installation.account_id)
      .maybeSingle(),

    admin
      .from('public_contributors')
      .select('public_id,visibility_status')
      .eq('id', installation.public_contributor_id)
      .maybeSingle(),
  ]);

  if (profileError) {
    console.error(
      'publication profile lookup failed:',
      profileError,
    );

    return linkError(
      'internal-error',
      'Unable to inspect account profile.',
      500,
      true,
    );
  }

  if (contributorError) {
    console.error(
      'publication contributor lookup failed:',
      contributorError,
    );

    return linkError(
      'internal-error',
      'Unable to inspect public contributor.',
      500,
      true,
    );
  }

  if (
    !profile?.first_name
    || !profile?.state_code
  ) {
    return linkError(
      'profile-incomplete',
      'Account profile is incomplete.',
      409,
    );
  }

  if (
    !contributor?.public_id
    || contributor.visibility_status === 'hidden'
  ) {
    return linkError(
      'public-contributor-missing',
      'Public contributor is unavailable.',
      409,
    );
  }

  const biome = biomeForState(
    profile.state_code,
  );

  if (!biome) {
    return linkError(
      'unsupported-region',
      'The account profile region is not supported by a garden biome.',
      422,
    );
  }

  /*
   * Normalize the extension finalState into the canonical
   * public-garden snapshot before persistence.
   *
   * This preserves the incoming fix that adds the shared schema
   * and renderer versions to legacy/versionless snapshots.
   */
  const canonicalSnapshot =
    canonicalPublicationSnapshot(input);

  const digest = snapshotDigest(
    input,
    canonicalSnapshot,
  );

  const {
    data,
    error,
  } = await admin.rpc(
    'publish_completed_plant',
    {
      p_account_id: installation.account_id,
      p_owner_public_id: contributor.public_id,
      p_biome: biome,
      p_publication_intent_id:
        input.publicationIntentId,
      p_completed_plant_id:
        input.completedPlantId,
      p_source_local_plant_id:
        input.sourceLocalPlantId,
      p_plant_type:
        input.completedPlant.plantType,
      p_visual_seed:
        input.completedPlant.visualSeed,

      // Persist the normalized snapshot, not the raw finalState.
      p_snapshot:
        canonicalSnapshot,

      p_snapshot_version:
        input.snapshotVersion,
      p_snapshot_digest:
        digest,
      p_created_at:
        input.completedPlant.createdAt,
      p_matured_at:
        input.completedPlant.maturedAt,
    },
  );

  if (data?.error === 'idempotency-conflict') {
    return linkError(
      'idempotency-conflict',
      'Publication identity conflicts with an existing publication.',
      409,
    );
  }

  if (data?.error) {
    console.error(
      'publish_completed_plant returned an application error:',
      data.error,
    );

    return linkError(
      'internal-error',
      'Publication could not be completed.',
      500,
      true,
    );
  }

  if (error) {
    console.error(
      'publish_completed_plant RPC failed:',
      error,
    );

    const plotFailure =
      error.message?.includes(
        'plot-assignment-failed',
      );

    return linkError(
      plotFailure
        ? 'plot-assignment-failed'
        : 'internal-error',
      plotFailure
        ? 'No eligible garden plot could be assigned.'
        : 'Publication could not be completed.',
      plotFailure ? 409 : 500,
      true,
    );
  }

  /*
   * Do not report a successful publication unless the RPC
   * actually returned the persisted garden objects.
   */
  if (
    !data?.gardenPlantId
    || !data?.plotId
    || !data?.receiptId
  ) {
    return linkError(
      'internal-error',
      'Publication could not be completed.',
      500,
      true,
    );
  }

  return Response.json(
    data,
    {
      status:
        data?.idempotentReplay
          ? 200
          : 201,
    },
  );
}