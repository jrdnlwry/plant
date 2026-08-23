export interface PublicEnvironment {
  siteUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

function required(name: string, value: string | undefined): string {
  if (!value?.trim()) throw new Error(`Missing required public configuration: ${name}`);
  return value;
}

export function readPublicEnvironment(source: Record<string, string | undefined> = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
}): PublicEnvironment {
  const siteUrl = required('NEXT_PUBLIC_SITE_URL', source.NEXT_PUBLIC_SITE_URL);
  const configuredSupabaseUrl = required('NEXT_PUBLIC_SUPABASE_URL', source.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = required('NEXT_PUBLIC_SUPABASE_ANON_KEY', source.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  try {
    new URL(siteUrl);
    const parsedSupabaseUrl = new URL(configuredSupabaseUrl);
    // Supabase client constructors append `rest/v1` themselves. The REST endpoint
    // is easy to copy from the dashboard, but passing it as the project URL makes
    // supabase-js request `/rest/v1/rest/v1/<relation>`, which PostgREST rejects.
    if (parsedSupabaseUrl.pathname.replace(/\/+$/, '') === '/rest/v1') {
      parsedSupabaseUrl.pathname = '/';
    }
    const supabaseUrl = parsedSupabaseUrl.href.replace(/\/$/, '');
    return { siteUrl, supabaseUrl, supabaseAnonKey };
  } catch {
    throw new Error('Public site and Supabase configuration must contain valid URLs');
  }
}
