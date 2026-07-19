'use client';
import { createBrowserClient } from '@supabase/ssr';
import { readPublicEnvironment } from '../env/public';

export function createClient() {
  const env = readPublicEnvironment();
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
