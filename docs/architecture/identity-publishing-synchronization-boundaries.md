# Identity, publishing, ownership, and synchronization boundaries (Phase 0.9)

## Status and scope

This document resolves the identity questions deferred by the community-garden plan. It defines
provider-neutral contracts and trust boundaries only. It does **not** add authentication, a database,
API routes, publication, synchronization, payments, jobs, or garden UI. The renderer adapter and
artifact generator contain no identity behavior and remain unchanged.

## Current identifier audit

| Existing value | Purpose and scope today | Stability | Public-safe? | Identity conclusion |
| --- | --- | --- | --- | --- |
| `ambientPlantState` | Fixed `chrome.storage.local` key for the one active local plant | Stable across setup changes and normal extension updates; storage is normally lost on uninstall | The literal key is harmless, but its value contains exact location | A storage address, not an ID or ownership proof |
| `seed` | Unsigned number for deterministic renderer variation | Explicit seeds survive saves/resetting setup; legacy seedless records render as zero. It is lost with local storage/reinstall | Safe only as part of a privacy-filtered snapshot | Identifies neither a person nor reliably a plant; collisions and client editing are possible |
| `createdAt`, `updatedAt`, `weatherUpdatedAt` | Local lifecycle and freshness timestamps | Survive saves while the local record exists; client-controlled and lost on reinstall | Timestamps may be publishable after policy review | Not identity or proof |
| `schemaVersion` / `rendererVersion` | Snapshot compatibility and deterministic rendering | Stable for a given normalized snapshot | Public-safe | Version metadata, never identity, authentication, or migration permission |
| plant type, location, weather, lifecycle fields | Active local plant state and rendering inputs | Mutable; one record is overwritten in place | Exact location and raw weather place names are **not** public-safe | Plant data, not an account or identifier |
| Chrome extension/runtime/tab IDs | Chrome routing and runtime context; not persisted in the plant contract | Browser-managed and unsuitable as durable product IDs | Must not become public identity | Not account, installation, plant, or ownership proof |
| alarm name `ambient-plant-weather-refresh` | Selects a periodic background task | Static | Harmless literal | Not identity |

There is currently no local plant ID, installation ID, browser-profile ID, account ID, owner field,
contributor ID, public ID, submission ID, garden record ID, archive/completed-plant record, auth session,
or entitlement ID. There is one active plant object. “Change setup” exposes the setup form and then
overwrites that object on save; it does not delete, reset, archive, or create an identity. Maturity is
currently the local rendering/lifecycle ceiling (`growthStage === 4`), not a server-verified publication
credential. The website has copy and environment placeholders only; it has no identity implementation.

No current value proves ownership: all snapshot fields, storage values, seeds, timestamps, versions,
message payloads, and extension-side values are client-readable or client-writable. Reinstallation also
means no current value can reliably recognize an installation. The extension message boundary currently
handles weather and overlay behavior, not identity. The renderer generator walks only renderer/core code
and embeds no account or publication concern.

## Separate identity concepts

The provider-neutral opaque types live in `publicationContracts.ts`. Their meanings and issuers are:

| Concept | Type | Issuer / exposure | Required behavior |
| --- | --- | --- | --- |
| Account | `AccountId` | Auth/backend; private | Canonical authorization principal. Never accepted from a client as proof of the caller. |
| Extension installation | `ExtensionInstallationId` | Generated locally once in future extension-owned storage, then registered/verified by server | Pseudonymous device/install handle. Rotates on reinstall or explicit unlink; never public. It is not a browser profile or account. |
| Local plant | `LocalPlantId` | Generated locally when future identity migration creates a plant | Identifies a local lineage only. Reset/new-plant policy may create a new one; never proves ownership. |
| Garden plant | `GardenPlantId` | Server | Durable identity of the independent accepted snapshot. Public-safe opaque ID. |
| Public contributor | `PublicContributorId` | Server | Public pseudonym/profile handle, separable and rotatable from `AccountId`; public-safe. |
| Submission | `SubmissionId` | Client-generated high-entropy idempotency key, recorded under authenticated account by server | Deduplicates retries, not authorization. Never reused for changed content. |
| Account-link challenge | `AccountLinkChallengeId` | Server | Short-lived, single-use, unpredictable linking transaction; private and redacted from logs. |
| Authentication session | `AuthenticationSessionId` | Auth layer | Revocable login session; secret/bearer material never enters plant state or public records. |
| Entitlement | `EntitlementId` | Server/payment integration | Server-side decision/audit identity. Stripe IDs and secrets remain server-only. |

Opaque typing prevents accidental interchange at compile time; it is not runtime authentication.
`PlantStateSnapshot` is referenced by publication records and remains unchanged. Credentials, tokens,
installation secrets, Stripe identifiers, account ownership, and backend metadata must never be added to it.

## Authentication and extension linking

1. Website authentication terminates at the future website/API layer. The server derives `AccountId`
   from a validated session, never from request JSON.
2. An unlinked extension remains fully functional locally. Linking is explicit and revocable.
3. A linked user initiates a server-issued, short-lived challenge. The website claims it while
   authenticated; the extension consumes the claimed challenge through proof bound to its installation.
4. Challenge states are `pending -> claimed -> consumed`; `pending` or `claimed` may instead become
   `expired`/`cancelled`. Terminal states cannot reopen. Challenge codes are single-use, rate-limited,
   stored hashed where feasible, and must not be placed in URLs that leak to referrers without mitigation.
5. Linking authorizes an installation/account association; it does not transfer garden ownership and
   does not prove that historical local snapshots originated on that installation.
6. Unlinking revokes installation credentials and future publication access, but does not delete local
   state or already-published plants. Account/session and installation credential revocation are separate.

## Explicit one-way publication

Publication is a copy operation, not synchronization:

1. The user explicitly selects **Publish** for a mature local plant.
2. The extension creates a new high-entropy `SubmissionId` and sends `PublishPlantIntent`, containing the
   linked installation, local lineage ID, and a complete `PlantStateSnapshot`.
3. The authenticated server derives account identity, validates the installation link, strict snapshot
   shape and supported versions, maturity policy, entitlement, moderation, and privacy projection. It
   independently derives any biome from approved coarse inputs; client biome claims are ignored.
4. In one transaction, the server reserves `(AccountId, SubmissionId)`, creates a server-generated
   `GardenPlantId`, stores the normalized accepted snapshot plus private provenance, and returns a receipt.
5. Repeating the same submission returns `duplicate` with the original garden ID. A reused submission ID
   with different canonical snapshot content is rejected and audited rather than overwriting anything.

`pending` may transition once to `accepted`, `rejected`, or `duplicate`, all terminal. Transport retries do
not create multiple plants. Rate limits, payload limits, authenticated authorization, and a server-side
uniqueness constraint are required in addition to the typed contract.

The accepted garden plant is an independent immutable publication snapshot. Later local growth, weather
refresh, setup changes, reset, storage loss, unlink, or reinstall do not mutate it. A future “publish newer
version” feature should create an explicit revision or new garden record; it must not silently become
bidirectional synchronization. Unsupported schema or renderer versions are rejected/quarantined for an
explicit migration path, never silently normalized to current versions.

## Ownership, public identity, and removal

`ownerAccountId` is private server authorization data. `contributorId` is the only public identity link and
must not expose or be derivable from account, email, auth-provider subject, installation, or payment IDs.
Display names are presentation data with moderation and rename policy; they are not authorization keys.

Only the server may create ownership. A caller may request a contributor persona, but the server verifies
that the authenticated account controls it. Ownership transfer is out of scope and must not be simulated
by editing IDs. Administrative actions require audited server authorization.

Garden visibility is `public -> hidden -> public`, with either non-removed state able to become `removed`.
Removal is terminal for that garden record and suppresses public rendering/discovery; retention or hard
deletion follows future legal/operational policy. Republish creates a new record. Hide/remove never writes
to extension storage, resets the local plant, or revokes the contributor/account. Deleting local state
never invokes garden removal.

## Location and data minimization

- Never publish exact user-entered location, coordinates, raw geocoder results, raw weather place names,
  IP-derived location, or extension installation identifiers.
- Before persistence to a public record, build an allowlisted public projection. Omit `snapshot.location`
  and review weather fields for re-identification; do not rely on UI hiding.
- The backend derives a coarse biome/region label from a verified server process when needed. Store only
  the least precise result required. Do not trust a client-provided biome.
- Private source snapshots need a documented purpose, retention window, access policy, encryption, and
  deletion process. Prefer storing a sanitized normalized snapshot if exact location is unnecessary.
- Public rendering must use a sanitized snapshot or separate public view model so renderer aria labels
  cannot reveal the snapshot location.

## Entitlement boundary

Local use is never entitlement-gated. Future premium publication features are enforced by the server at
each protected mutation using server-derived entitlement state. Client UI and cached claims are hints only.
Payment-provider customer/subscription IDs, webhook secrets, service credentials, prices, and authoritative
status remain server-side. Webhooks must be signature-verified and idempotent. Temporary caches need an
expiry and fail-closed policy for paid mutations; loss of entitlement does not reset local plants or silently
delete existing garden records. Display/access policy after expiry must be specified separately.

## Threat-model decisions

| Threat | Decision / required control |
| --- | --- |
| Forged account/owner/contributor/entitlement/biome | Ignore authority claims in payload; derive and authorize server-side. |
| Stolen link code or replay | High entropy, short TTL, one-time state machine, installation binding, rate limits, redaction, revocation. |
| Duplicate retry/race | Unique `(account, submission)` reservation and atomic result; reject payload mismatch. |
| Guessable or edited local IDs/seeds | Treat solely as provenance hints; never authorization or global uniqueness. |
| Snapshot tampering | Strict validation, supported-version allowlist, size limits, maturity policy, canonical hashing, audit outcome. |
| Location disclosure | Allowlisted public projection and server-side redaction before storage/response/rendering. |
| Cross-account garden mutation | Load record server-side and authorize its private `ownerAccountId`; do not query by caller-supplied owner. |
| Token/secret leakage | No secrets in snapshots, public IDs, extension bundle, logs, query strings, or public environment values. |
| Silent version downgrade | Reject/quarantine unsupported versions; migrations are explicit, versioned, and auditable. |
| Local/garden coupling | Separate records and mutation commands; no delete/reset cascade in either direction. |

## Recommended implementation sequence

1. **Contract hardening:** retain these opaque names/state transitions; define runtime request validators,
   canonical hashing, public snapshot projection, maturity policy, and version-rejection tests.
2. **Website authentication:** provider adapter, secure session validation, server-derived `AccountId`, CSRF
   protection, session revocation, and an account deletion policy. No extension changes yet.
3. **Public contributor profiles:** server-issued pseudonymous IDs, authorization and moderation rules,
   without garden persistence/UI.
4. **Installation linking:** local installation identity/credential storage, challenge endpoint and website
   confirmation, expiry/replay/rate-limit tests, unlink/revocation. Preserve anonymous local operation.
5. **Publication persistence/API:** transactional idempotency, strict snapshot/version/maturity checks,
   sanitized public projection, server-generated garden IDs, ownership authorization, and audit logging.
6. **Extension publish control:** explicit consent and status/retry UX only; never automatic upload. Confirm
   reset/change-setup behavior remains local and independent.
7. **Read-only garden and removal:** public views consume sanitized snapshots; add hide/unhide/remove with
   owner authorization and prove no extension mutation occurs.
8. **Entitlements:** add verified payment webhooks and server-side enforcement only after free publishing
   semantics are stable. Keep provider identifiers out of shared plant/publication payloads.
9. Consider revision publication or richer synchronization only after observing one-way behavior. Define
   conflict ownership and lifecycle authority before any bidirectional or scheduled mutation.

## Explicitly deferred

Provider selection details, database schema/RLS, endpoints, credentials, UI, synchronization transport,
garden lifecycle processing, scheduled jobs, account deletion retention, ownership transfer, moderation,
and paid product rules remain future work. Nothing in this phase changes extension maturity, reset, storage,
renderer behavior, generated artifact ownership, or script ordering.
