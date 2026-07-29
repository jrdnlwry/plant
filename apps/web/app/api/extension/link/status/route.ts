import { createAdminClient } from '../../../../../lib/supabase/admin';
import { CREDENTIAL_TTL_MS, deriveInstallationCredential, hashSecret, linkError } from '../../../../../lib/account-link/server';

export async function POST(request: Request) {
  let token: unknown;
  try { token = (await request.json()).challengeToken; } catch { return linkError('invalid-challenge', 'Malformed request.'); }
  if (typeof token !== 'string' || token.length < 32) return linkError('invalid-challenge', 'Invalid challenge.');
  const admin = createAdminClient();
  const { data: challenge } = await admin.from('account_link_challenges').select('challenge_id,installation_id,status,expires_at').eq('token_hash', hashSecret(token)).maybeSingle();
  if (!challenge) return linkError('invalid-challenge', 'Invalid challenge.', 404);
  if (challenge.status === 'pending' && Date.parse(challenge.expires_at) <= Date.now()) return linkError('expired-challenge', 'The challenge expired.', 410);
  if (challenge.status !== 'approved' && challenge.status !== 'consumed') return Response.json({ status: challenge.status, challengeId: challenge.challenge_id, expiresAt: challenge.expires_at });
  const credential = deriveInstallationCredential(challenge.installation_id, challenge.challenge_id);
  const credentialHash = hashSecret(credential);
  const { data: existingCredential } = await admin.from('installation_credentials').select('expires_at').eq('installation_id', challenge.installation_id).maybeSingle();
  const expiresAt = existingCredential?.expires_at ?? new Date(Date.now() + CREDENTIAL_TTL_MS).toISOString();
  if (!existingCredential) await admin.from('installation_credentials').insert({ installation_id: challenge.installation_id, credential_hash: credentialHash, expires_at: expiresAt });
  await admin.from('account_link_challenges').update({ status: 'consumed', consumed_at: new Date().toISOString() }).eq('challenge_id', challenge.challenge_id).in('status', ['approved','consumed']);
  const { data: installation } = await admin.from('extension_installations').select('linked_at,public_contributors(public_id)').eq('installation_id', challenge.installation_id).single();
  const contributor = Array.isArray(installation?.public_contributors) ? installation.public_contributors[0] : installation?.public_contributors;
  return Response.json({ status: 'linked', challengeId: challenge.challenge_id, installationId: challenge.installation_id, publicContributorId: contributor?.public_id, linkedAt: installation?.linked_at, credential, credentialExpiresAt: expiresAt });
}
