# Extension account linking and publication authorization (Phase 1.1)

## Repository assessment and reused contracts

Phase 1.0 already provided Supabase magic-link authentication, cookie-aware server/browser clients,
private `account_profiles`, distinct `public_contributors`, validation, bootstrap/synchronization triggers,
and restrictive RLS. `@plant/plant-core` already defined opaque account, installation, contributor, challenge,
session, entitlement, local-plant, and submission identities plus account-link transitions and publication
receipts. The extension already serialized lifecycle mutations in its service worker and retained immutable
completed records and pending accepted publication intents. This phase extends those boundaries; it does
not introduce another auth provider, garden persistence, or rendered canonical data.

## Data, privacy, and concurrency

Migration `20260729000000_extension_account_linking.sql` adds only installations, link challenges, and
installation credentials. Installation IDs use a checked, random `inst_…` format. Challenge public IDs,
token hashes, statuses, expiration, approval identity, and terminal timestamps are durable. A partial unique
index permits at most one pending challenge per installation. Credential hashes are unique and indexed.
All three tables have RLS enabled and no `anon` or `authenticated` table privileges. Website approval is a
security-definer RPC: it derives `auth.uid()`, locks challenge and installation rows, rejects incomplete
profiles/revocation/cross-account relinking, and idempotently returns the original result to the approving
account. The browser receives no token hash, account UUID, auth UUID, email, installation ID, or credential.

The existing contributor row remains one-per-account. Profile validation trims and collapses whitespace,
uses the existing Unicode-letter/mark and conservative punctuation allowlist, limits length to 50, and
uppercases the existing MVP state allowlist. The profile is authoritative; the publication endpoint ignores
owner fields by rejecting every request key outside the shared request contract. The public response is an
explicit allowlist of contributor public ID, first name, and state.

## Challenge and credential lifecycle

The service worker generates one 192-bit installation identity and stores it in extension-owned local
storage. It creates a 256-bit, 15-minute challenge through the website API and opens the authenticated
approval route. Only SHA-256 token hashes are stored server-side. A retry cancels at most one prior pending
attempt before creating a replacement, preventing unbounded active challenges. Approval requires a
complete profile and explicit button press. Status polling is token-bound, returns no account data, and
converts an approved challenge to consumed while returning the same canonical confirmation on retries.

For the MVP, the server returns a deterministic opaque credential derived with HMAC-SHA-256 from the
installation and challenge using the server-only service secret. Only its SHA-256 hash is stored. This makes
post-approval status retries recover the same credential without plaintext database storage or conflicting
credentials. The credential is sent only in the HTTPS response, stored only in extension service-worker
owned storage, supplied in an Authorization header, expires after 180 days, and can be revoked through the
installation or credential rows. A dedicated signing secret should replace service-key derivation before
independent rotation is needed. Credentials and challenge tokens must never be logged.

## Publication authorization boundary

`POST /api/extension/publication/validate` is deliberately read-only with respect to plant/publication
state. It hashes the bearer credential, verifies its installation binding, expiry and revocation, validates
the shared identity/version envelope, and resolves profile and contributor fields server-side. It returns an
authorization result, not a publication receipt. It creates no garden object and never marks a local intent
submitted. The extension transformer copies the completed-plant, local-plant, publication-intent, and
installation identities from the existing pending intent; it neither substitutes the new active plant nor
sends its snapshot/SVG or owner identity.

## Operations, manual QA, and remaining risks

Run local Supabase and the website, then load the unpacked extension. The extension currently targets
`http://localhost:3000`; a release build must inject the deployed HTTPS origin and restrict manifest host
permissions before distribution.

1. Sign up/sign in with the existing magic-link page.
2. On `/account`, or when prompted by linking, save an approved first name and MVP state.
3. In the extension popup choose **Link account** and open the generated website tab.
4. Verify the explanation and displayed public fields, then explicitly approve.
5. Return to the popup and choose **Check link status**.
6. Close/reopen the popup and restart Chrome; confirm the same linked installation remains.
7. Clear local state or use an unlinked profile and confirm all private plant/weather/lifecycle behavior works.
8. Accept a mature plant and confirm its intent remains local and pending.
9. Inspect the database and network: no garden, plant, plot, biome, submission, or receipt write occurs.

No real browser automation is included, and local database tests require Docker. Cancellation currently
abandons the approval page; the challenge expires or is superseded rather than immediately transitioning to
cancelled. Server-side rate limiting, a production extension origin, an explicit remote revoke endpoint,
credential rotation, and service-secret separation remain deployment work.

The garden-persistence phase must preserve: the completed plant as source identity; immutable archives;
local intent pending status until an actual idempotent publication receipt; server-derived account,
contributor, state, eligibility and ownership; installation credential binding/revocation; supported shared
contract versions; normalized snapshot data rather than SVG; no exposure of private profile/provenance; and
authorization validation as distinct from publication.
