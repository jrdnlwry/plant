import 'server-only';

export function readServiceRoleKey(source: NodeJS.ProcessEnv = process.env): string {
  const value = source.SUPABASE_SERVICE_ROLE_KEY;
  if (!value?.trim()) throw new Error('Missing required server configuration: SUPABASE_SERVICE_ROLE_KEY');
  return value;
}
