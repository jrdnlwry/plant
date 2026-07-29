import { createAdminClient } from '../../../../../lib/supabase/admin';
import { createChallengeToken, hashSecret, INSTALLATION_ID_PATTERN, LINK_TTL_MS, linkError } from '../../../../../lib/account-link/server';

export async function POST(request: Request) {
  let input: unknown;
  try { input = await request.json(); } catch { return linkError('invalid-challenge', 'Malformed request.'); }
  const installationId = (input as { installationId?: unknown })?.installationId;
  if (typeof installationId !== 'string' || !INSTALLATION_ID_PATTERN.test(installationId)) return linkError('invalid-challenge', 'Invalid installation identity.');
  const admin = createAdminClient();
  const { data: installation } = await admin.from('extension_installations').select('revoked_at,account_id').eq('installation_id', installationId).maybeSingle();
  if (installation?.revoked_at) return linkError('installation-revoked', 'This installation is revoked.', 403);
  if (installation?.account_id) return linkError('installation-already-linked', 'This installation is already linked.', 409);
  if (!installation) {
    const { error } = await admin.from('extension_installations').insert({ installation_id: installationId });
    if (error && error.code !== '23505') return linkError('internal-error', 'Unable to register installation.', 500, true);
  }
  const now = new Date();
  const { data: pending } = await admin.from('account_link_challenges').select('challenge_id,expires_at').eq('installation_id', installationId).eq('status', 'pending').gt('expires_at', now.toISOString()).maybeSingle();
  // A raw token is deliberately unrecoverable; a retry cancels the bounded current attempt before replacing it.
  if (pending) await admin.from('account_link_challenges').update({ status: 'cancelled' }).eq('challenge_id', pending.challenge_id).eq('status', 'pending');
  await admin.from('account_link_challenges').update({ status: 'expired' }).eq('installation_id', installationId).eq('status', 'pending').lte('expires_at', now.toISOString());
  const token = createChallengeToken();
  const expiresAt = new Date(now.getTime() + LINK_TTL_MS).toISOString();
  const { data, error } = await admin.from('account_link_challenges').insert({ installation_id: installationId, token_hash: hashSecret(token), expires_at: expiresAt }).select('challenge_id').single();
  if (error) return linkError('internal-error', 'Unable to create linking challenge.', 500, true);
  const site = new URL(process.env.NEXT_PUBLIC_SITE_URL!);
  site.pathname = '/account/link-extension'; site.searchParams.set('challenge', token);
  return Response.json({ challengeId: data.challenge_id, expiresAt, approvalUrl: site.toString(), challengeToken: token });
}
