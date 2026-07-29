import { createHash } from 'node:crypto';
import { isPlantType, type GardenBiome, type GardenPublicationRequest } from '@plant/plant-core';

const STATE_BIOMES = {
  south: ['AL', 'AR', 'DE', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'SC', 'TN', 'TX', 'VA', 'WV', 'DC'],
  north: ['CT', 'ME', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
  west: ['AZ', 'CA', 'CO', 'ID', 'MT', 'NV', 'NM', 'OR', 'UT', 'WA', 'WY'],
  central: ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'OK', 'SD', 'WI'],
} as const satisfies Record<GardenBiome, readonly string[]>;

export function biomeForState(stateCode: string): GardenBiome | null {
  if (!/^[A-Z]{2}$/.test(stateCode)) return null;
  return (Object.entries(STATE_BIOMES).find(([, states]) => (states as readonly string[]).includes(stateCode))?.[0] as GardenBiome) || null;
}

export type GardenPlotTemplate = { row: number; column: number; plotType: 'plantable' | 'path' | 'environment' };
const makeLayout = (): GardenPlotTemplate[] => Array.from({ length: 8 }, (_, row) =>
  Array.from({ length: 12 }, (_, column) => ({ row, column, plotType: column % 4 === 3 ? 'path' as const : 'plantable' as const })),
).flat();

// Separate immutable entries intentionally allow biome geometry to diverge later.
export const GARDEN_LAYOUTS: Readonly<Record<GardenBiome, readonly GardenPlotTemplate[]>> = {
  south: makeLayout(), north: makeLayout(), west: makeLayout(), central: makeLayout(),
};

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const INSTALLATION = /^inst_[0-9a-f]{32,64}$/;
const TIMESTAMP_KEYS = ['createdAt', 'maturedAt', 'completedAt'] as const;
const ENVELOPE_KEYS = ['publicationIntentId', 'completedPlantId', 'sourceLocalPlantId', 'installationId', 'contractVersion', 'snapshotVersion', 'completedPlant'];
const COMPLETED_KEYS = ['plantType', 'visualSeed', 'createdAt', 'maturedAt', 'completedAt', 'finalState'];
const PROHIBITED = new Set(['accountId', 'ownerAccountId', 'contributorId', 'publicContributorId', 'firstName', 'stateCode', 'biome', 'gardenId', 'gardenNumber', 'plotId', 'row', 'column', 'renderedSvg', 'svg', 'html']);

export class PublicationValidationError extends Error {
  code: 'invalid-publication-intent' | 'invalid-completed-plant' | 'plant-not-mature' | 'snapshot-too-large';
  constructor(code: PublicationValidationError['code'], message: string) { super(message); this.code = code; }
}

function containsProhibited(value: unknown): boolean {
  if (!value || typeof value !== 'object') return typeof value === 'string' && /<\/?(?:svg|script|html)\b/i.test(value);
  if (Array.isArray(value)) return value.some(containsProhibited);
  return Object.entries(value).some(([key, item]) => PROHIBITED.has(key) || containsProhibited(item));
}

export function validateGardenPublicationRequest(value: unknown, contentLength?: number): GardenPublicationRequest {
  if ((contentLength || 0) > 64 * 1024) throw new PublicationValidationError('snapshot-too-large', 'Publication snapshot exceeds 64 KiB.');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PublicationValidationError('invalid-publication-intent', 'Publication request is malformed.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !ENVELOPE_KEYS.includes(key))) throw new PublicationValidationError('invalid-publication-intent', 'Publication request contains unsupported fields.');
  for (const key of ['publicationIntentId', 'completedPlantId', 'sourceLocalPlantId'] as const) if (typeof input[key] !== 'string' || !ID.test(input[key])) throw new PublicationValidationError('invalid-publication-intent', `Invalid ${key}.`);
  if (typeof input.installationId !== 'string' || !INSTALLATION.test(input.installationId)) throw new PublicationValidationError('invalid-publication-intent', 'Invalid installationId.');
  if (!Number.isInteger(input.contractVersion) || !Number.isInteger(input.snapshotVersion)) throw new PublicationValidationError('invalid-publication-intent', 'Invalid publication versions.');
  const completed = input.completedPlant;
  if (!completed || typeof completed !== 'object' || Array.isArray(completed)) throw new PublicationValidationError('invalid-completed-plant', 'Completed plant is malformed.');
  const record = completed as Record<string, unknown>;
  if (Object.keys(record).some((key) => !COMPLETED_KEYS.includes(key)) || !isPlantType(record.plantType) || typeof record.visualSeed !== 'string' || !/^\d{1,10}$/.test(record.visualSeed)) throw new PublicationValidationError('invalid-completed-plant', 'Completed plant metadata is invalid.');
  const times = TIMESTAMP_KEYS.map((key) => typeof record[key] === 'string' ? Date.parse(record[key]) : NaN);
  if (times.some((time) => !Number.isFinite(time)) || !(times[0] <= times[1] && times[1] <= times[2])) throw new PublicationValidationError('invalid-completed-plant', 'Completed plant timestamps are invalid.');
  const snapshot = record.finalState as Record<string, unknown>;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) || containsProhibited(snapshot)) throw new PublicationValidationError('invalid-completed-plant', 'Completed snapshot contains prohibited or invalid data.');
  if (snapshot.plantId !== input.sourceLocalPlantId || snapshot.plantType !== record.plantType || String(snapshot.seed) !== record.visualSeed) throw new PublicationValidationError('invalid-completed-plant', 'Completed snapshot identity does not match the request.');
  if ((snapshot.schemaVersion !== undefined && snapshot.schemaVersion !== 1) || (snapshot.rendererVersion !== undefined && snapshot.rendererVersion !== 'l-system-pixel-v2')) throw new PublicationValidationError('invalid-completed-plant', 'Completed snapshot renderer contract is invalid.');
  if (typeof snapshot.location !== 'string' || typeof snapshot.weatherMood !== 'string' || typeof snapshot.weatherSummary !== 'string') throw new PublicationValidationError('invalid-completed-plant', 'Completed snapshot is missing required render state.');
  for (const key of ['createdAt', 'updatedAt'] as const) if (typeof snapshot[key] !== 'string' || !Number.isFinite(Date.parse(snapshot[key] as string))) throw new PublicationValidationError('invalid-completed-plant', `Invalid snapshot ${key}.`);
  for (const [key, min, max] of [['health', 0, 100], ['hydration', 0, 100], ['growthProgress', 0, 100], ['totalGrowth', 0, 400], ['flowerCount', 0, 5]] as const) if (typeof snapshot[key] !== 'number' || !Number.isFinite(snapshot[key]) || snapshot[key] < min || snapshot[key] > max) throw new PublicationValidationError('invalid-completed-plant', `Invalid snapshot ${key}.`);
  if (snapshot.growthStage !== 4 || (snapshot.growthProgress as number) < 100) throw new PublicationValidationError('plant-not-mature', 'Plant has not reached canonical maturity.');
  if (JSON.stringify(value).length > 64 * 1024) throw new PublicationValidationError('snapshot-too-large', 'Publication snapshot exceeds 64 KiB.');
  return value as GardenPublicationRequest;
}

export const snapshotDigest = (request: GardenPublicationRequest) => createHash('sha256').update(JSON.stringify(request.completedPlant)).digest('hex');
