'use server';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { requireAuthenticatedUser } from '../../lib/auth/server';
import { validateProfileInput } from '../../lib/auth/profile';

export async function signOut() { const supabase = await createClient(); await supabase.auth.signOut(); redirect('/auth/sign-in'); }
export async function updateProfile(formData: FormData) {
  const user = await requireAuthenticatedUser();
  let input;
  try { input = validateProfileInput({ firstName: formData.get('firstName'), stateCode: formData.get('stateCode') }); }
  catch { redirect('/account?error=invalid-profile'); }
  const supabase = await createClient();
  const { error } = await supabase.from('account_profiles').update({ first_name: input.firstName, state_code: input.stateCode }).eq('account_id', user.id);
  if (error) redirect('/account?error=update-failed');
  redirect('/account?saved=1');
}
