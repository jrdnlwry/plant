import { createAdminClient } from '../../../../../lib/supabase/admin';
import {
  createChallengeToken,
  hashSecret,
  INSTALLATION_ID_PATTERN,
  LINK_TTL_MS,
  linkError,
} from '../../../../../lib/account-link/server';

export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return linkError('invalid-challenge', 'Malformed request.');
  }

  const installationId = (input as { installationId?: unknown })?.installationId;

  if (
    typeof installationId !== 'string'
    || !INSTALLATION_ID_PATTERN.test(installationId)
  ) {
    return linkError(
      'invalid-challenge',
      'Invalid installation identity.',
    );
  }

  const admin = createAdminClient();

  // First check whether this installation already exists.
  const {
    data: installation,
    error: installationLookupError,
  } = await admin
    .from('extension_installations')
    .select('revoked_at,account_id')
    .eq('installation_id', installationId)
    .maybeSingle();

  if (installationLookupError) {
    console.error(
      'extension_installations lookup failed:',
      installationLookupError,
    );

    return linkError(
      'internal-error',
      'Unable to inspect installation.',
      500,
      true,
    );
  }

  if (installation?.revoked_at) {
    return linkError(
      'installation-revoked',
      'This installation is revoked.',
      403,
    );
  }

  if (installation?.account_id) {
    return linkError(
      'installation-already-linked',
      'This installation is already linked.',
      409,
    );
  }

  // Register a brand-new extension installation.
  if (!installation) {
    const { error: installationInsertError } = await admin
      .from('extension_installations')
      .insert({
        installation_id: installationId,
      });

    if (
      installationInsertError
      && installationInsertError.code !== '23505'
    ) {
      console.error(
        'extension_installations insert failed:',
        installationInsertError,
      );

      return linkError(
        'internal-error',
        'Unable to register installation.',
        500,
        true,
      );
    }
  }

  const now = new Date();

  // Check for an existing, still-valid pending challenge.
  const {
    data: pending,
    error: pendingLookupError,
  } = await admin
    .from('account_link_challenges')
    .select('challenge_id,expires_at')
    .eq('installation_id', installationId)
    .eq('status', 'pending')
    .gt('expires_at', now.toISOString())
    .maybeSingle();

  if (pendingLookupError) {
    console.error(
      'account_link_challenges lookup failed:',
      pendingLookupError,
    );

    return linkError(
      'internal-error',
      'Unable to inspect linking challenge.',
      500,
      true,
    );
  }

  // A raw token is deliberately unrecoverable.
  // A retry cancels the bounded current attempt before replacing it.
  if (pending) {
    const { error: cancelError } = await admin
      .from('account_link_challenges')
      .update({
        status: 'cancelled',
      })
      .eq('challenge_id', pending.challenge_id)
      .eq('status', 'pending');

    if (cancelError) {
      console.error(
        'account_link_challenges cancellation failed:',
        cancelError,
      );

      return linkError(
        'internal-error',
        'Unable to replace the existing linking challenge.',
        500,
        true,
      );
    }
  }

  // Mark any old pending challenges as expired.
  const { error: expiryUpdateError } = await admin
    .from('account_link_challenges')
    .update({
      status: 'expired',
    })
    .eq('installation_id', installationId)
    .eq('status', 'pending')
    .lte('expires_at', now.toISOString());

  if (expiryUpdateError) {
    console.error(
      'account_link_challenges expiry update failed:',
      expiryUpdateError,
    );

    return linkError(
      'internal-error',
      'Unable to expire old linking challenges.',
      500,
      true,
    );
  }

  const token = createChallengeToken();
  const expiresAt = new Date(
    now.getTime() + LINK_TTL_MS,
  ).toISOString();

  const {
    data: challenge,
    error: challengeInsertError,
  } = await admin
    .from('account_link_challenges')
    .insert({
      installation_id: installationId,
      token_hash: hashSecret(token),
      expires_at: expiresAt,
    })
    .select('challenge_id')
    .single();

  if (challengeInsertError) {
    console.error(
      'account_link_challenges insert failed:',
      challengeInsertError,
    );

    return linkError(
      'internal-error',
      'Unable to create linking challenge.',
      500,
      true,
    );
  }

  const site = new URL(process.env.NEXT_PUBLIC_SITE_URL!);

  site.pathname = '/account/link-extension';
  site.searchParams.set('challenge', token);

  return Response.json({
    challengeId: challenge.challenge_id,
    expiresAt,
    approvalUrl: site.toString(),
    challengeToken: token,
  });
}