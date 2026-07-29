'use server';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { hashSecret } from '../../../lib/account-link/server';
import { validateProfileInput } from '../../../lib/auth/profile';

export async function approveExtensionLink(formData: FormData) {
  const token = formData.get('challenge');
  if (typeof token !== 'string') redirect('/account/link-extension?result=invalid-challenge');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('approve_extension_link', { p_token_hash: hashSecret(token) });
  const code = error ? 'internal-error' : data?.error;
  if (code) redirect(`/account/link-extension?result=${encodeURIComponent(code)}`);
  redirect('/account/link-extension?result=approved');
}

export async function completeProfileForLink(formData: FormData) {
  const token = formData.get('challenge');
  let input;
  try { input = validateProfileInput({ firstName: formData.get('firstName'), stateCode: formData.get('stateCode') }); }
  catch { redirect(`/account/link-extension?challenge=${encodeURIComponent(String(token))}&result=invalid-profile`); }
  if (!input.firstName || !input.stateCode) redirect(`/account/link-extension?challenge=${encodeURIComponent(String(token))}&result=profile-incomplete`);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/auth/sign-in?next=${encodeURIComponent(`/account/link-extension?challenge=${String(token)}`)}`);
  const { error } = await supabase.from('account_profiles').update({ first_name: input.firstName, state_code: input.stateCode }).eq('account_id', auth.user.id);
  redirect(`/account/link-extension?challenge=${encodeURIComponent(String(token))}&result=${error ? 'update-failed' : 'profile-saved'}`);
}
