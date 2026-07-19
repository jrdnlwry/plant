export type AuthErrorCode = 'invalid-email' | 'invalid-callback' | 'missing-session' | 'profile-unavailable' | 'unauthorized' | 'invalid-state' | 'invalid-first-name' | 'configuration' | 'unavailable';
const MESSAGES: Record<AuthErrorCode, string> = {
  'invalid-email': 'Enter a valid email address.', 'invalid-callback': 'This sign-in link is invalid or has expired.', 'missing-session': 'Please sign in to continue.', 'profile-unavailable': 'Your profile is temporarily unavailable.', unauthorized: 'You are not allowed to make that change.', 'invalid-state': 'Choose a supported state.', 'invalid-first-name': 'Enter a valid first name of 50 characters or fewer.', configuration: 'Sign-in is not configured.', unavailable: 'Sign-in is temporarily unavailable.',
};
export const authErrorMessage = (code: AuthErrorCode) => MESSAGES[code];
