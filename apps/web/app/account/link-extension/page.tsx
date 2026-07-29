import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { getCurrentAccountProfile, getOptionalAuthenticatedUser } from '../../../lib/auth/server';
import { SUPPORTED_STATE_CODES } from '../../../lib/auth/profile';
import { hashSecret } from '../../../lib/account-link/server';
import { approveExtensionLink, completeProfileForLink } from './actions';
export const dynamic = 'force-dynamic';

export default async function LinkExtensionPage({ searchParams }: { searchParams: Promise<{ challenge?: string; result?: string }> }) {
  const params = await searchParams;
  if (!await getOptionalAuthenticatedUser()) redirect(`/auth/sign-in?next=${encodeURIComponent(`/account/link-extension${params.challenge ? `?challenge=${params.challenge}` : ''}`)}`);
  const profile = await getCurrentAccountProfile();
  const complete = Boolean(profile.first_name && profile.state_code);
  let challengeState: string | null = null;
  if (params.challenge) {
    const supabase = await createClient();
    const { data } = await supabase.rpc('inspect_extension_link_challenge', { p_token_hash: hashSecret(params.challenge) });
    challengeState = data?.status ?? 'invalid';
  }
  return <section className="panel"><p className="eyebrow">Extension account link</p><h1>Link your plant companion</h1>
    {params.result && <p className={params.result === 'approved' ? 'feedback' : 'feedback error'}>{params.result === 'approved' ? 'Installation approved. Return to the extension and check link status.' : `Linking status: ${params.result}.`}</p>}
    {!params.challenge && !params.result && <p>Start linking from the Chrome extension to receive a short-lived approval link.</p>}
    {params.challenge && challengeState === 'pending' && <><p>A Chrome extension installation is requesting permission to authenticate future garden publication requests.</p><p>Linking does not publish a plant. Garden participation remains opt-in, and your private history, email, and location remain private.</p>
      {!complete ? <><p>Complete the approved public identity fields before linking.</p><form action={completeProfileForLink}><input type="hidden" name="challenge" value={params.challenge}/><label>First name<input name="firstName" maxLength={50} required defaultValue={profile.first_name ?? ''}/></label><label>State<select name="stateCode" required defaultValue={profile.state_code ?? ''}><option value="">Select state</option>{SUPPORTED_STATE_CODES.map(s => <option key={s}>{s}</option>)}</select></label><button>Save profile</button></form></>
      : <><dl className="contract-card"><div><dt>Public first name</dt><dd>{profile.first_name}</dd></div><div><dt>Public state</dt><dd>{profile.state_code}</dd></div></dl><form action={approveExtensionLink}><input type="hidden" name="challenge" value={params.challenge}/><button>Approve extension link</button></form><p><a href="/account/link-extension?result=cancelled">Cancel</a></p></>}</>}
    {params.challenge && challengeState !== 'pending' && <p className="feedback error">This challenge is {challengeState === 'invalid' ? 'invalid' : challengeState}. Start a new link from the extension if needed.</p>}
  </section>;
}
