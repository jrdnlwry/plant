export const SUPPORTED_STATE_CODES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'] as const;
export const MAX_FIRST_NAME_LENGTH = 50;

export type ProfileInput = { firstName: string | null; stateCode: string | null };
export function validateProfileInput(value: unknown): ProfileInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid profile');
  const keys = Object.keys(value);
  if (keys.some((key) => !['firstName', 'stateCode'].includes(key))) throw new Error('Unexpected profile field');
  const raw = value as Record<string, unknown>;
  if (raw.firstName != null && typeof raw.firstName !== 'string') throw new Error('Invalid first name');
  if (raw.stateCode != null && typeof raw.stateCode !== 'string') throw new Error('Invalid state');
  const firstName = typeof raw.firstName === 'string' ? raw.firstName.trim().replace(/\s+/gu, ' ') : null;
  if (firstName && (firstName.length > MAX_FIRST_NAME_LENGTH || !/^[\p{L}\p{M} .'-]+$/u.test(firstName))) throw new Error('Invalid first name');
  const stateCode = typeof raw.stateCode === 'string' && raw.stateCode ? raw.stateCode.toUpperCase() : null;
  if (stateCode && !SUPPORTED_STATE_CODES.includes(stateCode as typeof SUPPORTED_STATE_CODES[number])) throw new Error('Invalid state');
  return { firstName: firstName || null, stateCode };
}

export function toPublicContributor(value: Record<string, unknown>) {
  return { publicContributorId: value.id, displayFirstName: value.display_first_name ?? null, stateCode: value.state_code ?? null, visibilityStatus: value.visibility_status };
}
