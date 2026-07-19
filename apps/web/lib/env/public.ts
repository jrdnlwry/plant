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
  const supabaseUrl = required('NEXT_PUBLIC_SUPABASE_URL', source.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = required('NEXT_PUBLIC_SUPABASE_ANON_KEY', source.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  try {
    new URL(siteUrl);
    new URL(supabaseUrl);
  } catch {
    throw new Error('Public site and Supabase configuration must contain valid URLs');
  }
  return { siteUrl, supabaseUrl, supabaseAnonKey };
}
