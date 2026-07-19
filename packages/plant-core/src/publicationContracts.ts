import type { PlantStateSnapshot } from './plantSchema.ts';

/** Opaque identifiers prevent accidentally exchanging identities with different trust scopes. */
type OpaqueId<Name extends string> = string & { readonly __identityKind: Name };

export type AccountId = OpaqueId<'AccountId'>;
export type ExtensionInstallationId = OpaqueId<'ExtensionInstallationId'>;
export type LocalPlantId = OpaqueId<'LocalPlantId'>;
export type GardenPlantId = OpaqueId<'GardenPlantId'>;
export type PublicContributorId = OpaqueId<'PublicContributorId'>;
export type SubmissionId = OpaqueId<'SubmissionId'>;
export type AccountLinkChallengeId = OpaqueId<'AccountLinkChallengeId'>;
export type AuthenticationSessionId = OpaqueId<'AuthenticationSessionId'>;
export type EntitlementId = OpaqueId<'EntitlementId'>;

export type AccountLinkChallengeState = 'pending' | 'claimed' | 'consumed' | 'expired' | 'cancelled';
export type PublicationSubmissionState = 'pending' | 'accepted' | 'rejected' | 'duplicate';
export type GardenPlantVisibility = 'public' | 'hidden' | 'removed';

export interface AuthenticatedActor {
  accountId: AccountId;
  sessionId: AuthenticationSessionId;
}

export interface EntitlementDecision {
  entitlementId: EntitlementId;
  accountId: AccountId;
  capability: string;
  allowed: boolean;
  evaluatedAt: string;
  expiresAt: string | null;
}

export interface AccountLinkChallenge {
  challengeId: AccountLinkChallengeId;
  installationId: ExtensionInstallationId;
  state: AccountLinkChallengeState;
  expiresAt: string;
}

/** Client intent only. The server derives account, ownership, entitlement, and biome. */
export interface PublishPlantIntent {
  submissionId: SubmissionId;
  installationId: ExtensionInstallationId;
  localPlantId: LocalPlantId;
  snapshot: PlantStateSnapshot;
  requestedPublicContributorId?: PublicContributorId;
}

/** Server-authored receipt. Reusing a submission id must return the original outcome. */
export type PublishPlantReceipt =
  | { submissionId: SubmissionId; state: 'pending' }
  | { submissionId: SubmissionId; state: 'accepted'; gardenPlantId: GardenPlantId }
  | { submissionId: SubmissionId; state: 'duplicate'; gardenPlantId: GardenPlantId }
  | { submissionId: SubmissionId; state: 'rejected'; reason: PublicationRejectionReason };

export type PublicationRejectionReason =
  | 'authentication-required'
  | 'account-link-required'
  | 'not-mature'
  | 'unsupported-schema-version'
  | 'unsupported-renderer-version'
  | 'invalid-snapshot'
  | 'entitlement-required'
  | 'privacy-policy-violation';

export interface PublishedGardenPlant {
  gardenPlantId: GardenPlantId;
  ownerAccountId: AccountId;
  contributorId: PublicContributorId;
  sourceInstallationId: ExtensionInstallationId;
  sourceLocalPlantId: LocalPlantId;
  acceptedSubmissionId: SubmissionId;
  snapshot: PlantStateSnapshot;
  visibility: GardenPlantVisibility;
  publishedAt: string;
}

/** Public projection: exact location and all private provenance/ownership IDs are absent by type. */
export interface PublicGardenPlant {
  gardenPlantId: GardenPlantId;
  contributorId: PublicContributorId;
  snapshot: Omit<PlantStateSnapshot, 'location'>;
  visibility: Exclude<GardenPlantVisibility, 'removed'>;
  publishedAt: string;
  coarseBiome?: string;
}

const ACCOUNT_LINK_TRANSITIONS: Readonly<Record<AccountLinkChallengeState, readonly AccountLinkChallengeState[]>> = {
  pending: ['claimed', 'expired', 'cancelled'],
  claimed: ['consumed', 'expired', 'cancelled'],
  consumed: [],
  expired: [],
  cancelled: [],
};

const SUBMISSION_TRANSITIONS: Readonly<Record<PublicationSubmissionState, readonly PublicationSubmissionState[]>> = {
  pending: ['accepted', 'rejected', 'duplicate'],
  accepted: [],
  rejected: [],
  duplicate: [],
};

const VISIBILITY_TRANSITIONS: Readonly<Record<GardenPlantVisibility, readonly GardenPlantVisibility[]>> = {
  public: ['hidden', 'removed'],
  hidden: ['public', 'removed'],
  removed: [],
};

export function canTransitionAccountLinkChallenge(
  from: AccountLinkChallengeState,
  to: AccountLinkChallengeState,
): boolean {
  return ACCOUNT_LINK_TRANSITIONS[from].includes(to);
}

export function canTransitionPublicationSubmission(
  from: PublicationSubmissionState,
  to: PublicationSubmissionState,
): boolean {
  return SUBMISSION_TRANSITIONS[from].includes(to);
}

export function canTransitionGardenPlantVisibility(
  from: GardenPlantVisibility,
  to: GardenPlantVisibility,
): boolean {
  return VISIBILITY_TRANSITIONS[from].includes(to);
}
