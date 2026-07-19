# Website authentication foundation (Phase 1.0)

## Audit and decisions

The repository used Next.js 16.2.10 App Router with no middleware, auth code, database, or environment
validation. Existing public routes are Server Components and the preview is deterministic. Phase 0.9's
provider-neutral `AccountId` and `PublicContributorId` agree with Supabase auth plus a separate contributor
record. Its statement that provider details and schemas were deferred is superseded only by this phase.
No extension, renderer, plant contract, publication, linking, billing, or garden persistence code changes.

Passwordless email magic link is the single initial method: it minimizes credential handling, uses
Supabase PKCE callback exchange, and requires no social provider. `@supabase/supabase-js` 2.57.4 and
`@supabase/ssr` 0.7.0 are web-workspace dependencies; deprecated auth helpers are not used. Next.js 16's
`proxy.ts` convention refreshes cookies only for auth/account paths. Browser and request-cookie clients
live in `lib/supabase/client.ts` and `server.ts`. There is no administrative client or service-role call.

## Configuration and operation

Create a hosted project in the Supabase dashboard or link one with `supabase link --project-ref REF`.
Install the CLI as a development tool (not with `npm install -g`), then use:

```sh
npm run supabase:start
npm run supabase:reset
npm run test:db
npm run supabase:stop
```

Migration order is filename order; the sole migration is transactional under normal CLI application.
For rollback in an unshipped local environment, reset the database. In a shared environment, create a
forward migration that removes policies/triggers/views before tables; never rewrite an applied migration.

Copy `.env.example` to `.env.local`. `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are intentionally browser-visible. `SUPABASE_SERVICE_ROLE_KEY` is a secret,
reserved and unused in Phase 1.0. Put the same values in Vercel per environment, marking the service key
sensitive. Configure Supabase Auth Site URL and allowed redirect URL as
`http://localhost:3000/auth/callback` locally and the exact HTTPS deployment callback in production.

Run `npm run dev:web`, submit an email at `/auth/sign-in`, and open the message in local Mailpit. Inspect
`auth.users`, `public.account_profiles`, and `public.public_contributors` in Studio. Never paste keys into
logs or screenshots. `supabase db reset` applies migrations; `supabase test db` runs pgTAP assertions.

## Data and authorization

`account_profiles` contains the private auth UUID, optional first name/state, and timestamps.
`public_contributors` has a separate UUID, a 144-bit random `pc_…` public identifier, private account link,
optional display fields, visibility, and timestamps. The auth-user trigger idempotently inserts incomplete
records in one transaction. A failed trigger aborts user creation rather than leaving partial records.
Auth deletion is restricted, preserving the boundary pending a formal deletion/retention policy.

Profile changes synchronize display name/state immediately to the contributor record. Application and
database validation limit names to 50 Unicode letters/marks plus conservative punctuation and support only
AZ, CA, CO, FL, GA, IL, MA, MI, NC, NY, OH, OR, PA, TX, VA, and WA. Other US regions are deferred. There
are no city, ZIP, coordinate, location, billing, entitlement, installation, or plant columns.

RLS permits authenticated users to select their own rows. They can update only their own profile and only
the `first_name`/`state_code` columns; clients cannot insert/delete profiles or mutate contributors.
Anonymous table access is revoked. The invoker-security `public_contributor_projection` allowlists public
ID, display first name, state, and visibility, but all access remains revoked until Phase 1.4.

## Flows and security review

The client requests a magic link with an allowlisted internal continuation. The callback exchanges its
one-time code through the cookie-aware server client. Missing/expired callbacks return safe messages.
`/account` obtains the user using `auth.getUser()`, never accepts a browser account ID, and redirects a
missing session. Sign-out invalidates the Supabase session and redirects. Expected failures map to short
application messages; raw Supabase errors, callback values, sessions, and tokens are not logged.

The public routes do not call Supabase. Proxy refresh is narrowly matched, skips safely when public config
is absent, and follows current SSR cookie guidance. Static/unit builds need no real secrets. Security review
found no service-role import in browser code, public auth/account identifiers are separate, all new tables
use RLS and intentional grants, redirect destinations are decoded and allowlisted, and exact location is
absent. Remaining risks: magic-link delivery/rate limits and production redirect settings are provider
configuration; database tests require Docker; account deletion, moderation, and public visibility need later
policy. CSP/rate-limit hardening should be revisited before public launch.

## Manual verification checklist

- Start local Supabase and web; confirm `/`, `/garden`, `/garden/preview`, and `/auth/sign-in` load without
  authentication and `/account` redirects.
- Sign in from Mailpit, confirm callback, refresh/navigation persistence, both bootstrap records, distinct
  auth/public IDs, profile update synchronization, sign-out, and denied signed-out account access.
- Create a second user and use SQL/RLS clients to prove each can read/update only its profile and neither
  anonymous nor the other user can read base rows or change ownership.
- Inspect browser sources/storage: only public config and expected Supabase session cookies may appear;
  the service key must not. Try `next=https://example.com` and encoded `//example.com`; both go to `/account`.
- Confirm no extension-link, publication, garden, Stripe, or scheduled-job tables/requests exist. Phase 1.1
  will add explicit installation linking and challenges; it is deliberately not prepared here.
