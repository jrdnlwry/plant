import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { readPublicEnvironment } from '../env/public';

export async function createClient() {
  const env = readPublicEnvironment();
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values: Array<{ name: string; value: string; options?: Parameters<typeof store.set>[2] }>) {
        try { values.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* Server Components cannot set cookies; proxy performs refresh. */ }
      },
    },
  });
}
