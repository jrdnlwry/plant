import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '../supabase/server';

export async function getOptionalAuthenticatedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}
export async function requireAuthenticatedUser() {
  const user = await getOptionalAuthenticatedUser();
  if (!user) redirect('/auth/sign-in?next=%2Faccount');
  return user;
}
export async function getCurrentAccountProfile() {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from('account_profiles').select('first_name,state_code').eq('account_id', user.id).single();
  if (error) throw new Error('Account profile is temporarily unavailable');
  return data;
}
