import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { readPublicEnvironment } from '../env/public';
import { readServiceRoleKey } from '../env/server';

export function createAdminClient() {
  const env = readPublicEnvironment();
  return createClient(env.supabaseUrl, readServiceRoleKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}
