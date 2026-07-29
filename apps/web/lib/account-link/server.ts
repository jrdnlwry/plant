import 'server-only';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { readServiceRoleKey } from '../env/server';

export const LINK_TTL_MS = 15 * 60 * 1000;
export const CREDENTIAL_TTL_MS = 180 * 24 * 60 * 60 * 1000;
export const INSTALLATION_ID_PATTERN = /^inst_[0-9a-f]{32,64}$/;
export const hashSecret = (value: string) => createHash('sha256').update(value).digest('hex');
export const createChallengeToken = () => randomBytes(32).toString('base64url');
export function deriveInstallationCredential(installationId: string, challengeId: string) {
  return `pic_${createHmac('sha256', readServiceRoleKey()).update(`${installationId}:${challengeId}`).digest('base64url')}`;
}
export function linkError(code: string, message: string, status = 400, retryable = false) {
  return Response.json({ error: { code, message, retryable } }, { status });
}
