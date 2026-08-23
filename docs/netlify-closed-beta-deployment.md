# Netlify Free closed-beta deployment

## Deployment architecture

The deployable site is the Next.js App Router application in `apps/web`. It uses dynamic server-rendered
garden pages, Supabase SSR authentication, and Next.js route handlers for extension linking and publication.
Netlify's automatic Next.js adapter deploys those routes as functions; the site must not use a generic SPA
rewrite. `netlify.toml` builds from the repository root so npm workspaces remain available, runs
`npm run build:netlify`, and publishes `apps/web/.next`.

The beta has no scheduled jobs, background workers, persistent filesystem writes, or long-running server.
Its request/response route handlers and small build are suitable for a 5–10 tester Netlify Free beta.

## Netlify environment variables

Set these for **Builds and Functions** (all deploy contexts used for the beta):

| Variable | Classification | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public/client-safe | Exact deployed HTTPS origin, for example `https://your-site.netlify.app`; also configures the release extension |
| `NEXT_PUBLIC_SUPABASE_URL` | Public/client-safe | HTTPS URL of the remote beta Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public/client-safe | Remote project's publishable anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server secret** | Server route access for linking and publication; never prefix with `NEXT_PUBLIC_` |

`EXTENSION_SITE_ORIGIN` is an optional build-only override for local release packaging. Do not set it on
Netlify unless it is exactly the same origin as `NEXT_PUBLIC_SITE_URL`. No Stripe variables are read by the
current application.

Production values must be remote HTTPS services. The deployed application intentionally has no localhost
fallback. Netlify's first hostname is not known in advance, so create the site, set the assigned origin in
`NEXT_PUBLIC_SITE_URL`, and then trigger the production deploy.

## Supabase prerequisites

The repository does not contain a linked remote project ID or production credentials. Choose the existing
beta Supabase project; do not use the local project configured in `supabase/config.toml`. Apply the checked-in
migrations to that project in chronological order (the Supabase CLI does this automatically):

1. `20260719000000_website_auth_foundation.sql`
2. `20260729000000_extension_account_linking.sql`
3. `20260730000000_garden_publication_foundation.sql`
4. `20260808000000_garden_publication_contract_and_service_grants.sql`
5. `20260808010000_persistent_garden_mature_life.sql`
6. `20260810000000_repair_garden_mature_life_columns.sql`

Safest one-time workflow: inspect the target first with `supabase migration list --linked`, then run
`supabase db push --dry-run --linked`, review the plan, and only then run `supabase db push --linked`.
Do not reset a remote database. Run `npm run test:db` against local Supabase to validate the migration
contracts; the repository cannot safely prove the state of an unavailable remote project.

In Supabase Authentication URL Configuration, set **Site URL** to the Netlify HTTPS origin and add
`https://your-site.netlify.app/auth/callback` as an allowed redirect URL. Email magic-link authentication,
extension installations/challenges/credentials, public contributors, publications, gardens/plots,
allocation, and mature-life state are created by the migrations above.

## Shortest Netlify UI launch

1. Push this commit/branch to GitHub.
2. In Netlify choose **Add new site → Import an existing project**, authorize GitHub, and select the repository.
3. Leave the repository root selected. Netlify reads `netlify.toml`; confirm build command
   `npm run build:netlify` and publish directory `apps/web/.next`.
4. Create the site once to obtain its stable `https://…netlify.app` hostname. A failed placeholder deploy
   before variables exist is harmless.
5. Under **Site configuration → Environment variables**, add the four variables above for Builds and
   Functions. Set `NEXT_PUBLIC_SITE_URL` to that exact hostname (no path or trailing configuration).
6. In Supabase, configure the site/callback URLs and verify/apply migrations as described above.
7. Trigger **Deploys → Trigger deploy → Clear cache and deploy site**.

No paid Netlify feature or manual routing rule is required. Changing the Netlify hostname later requires
updating `NEXT_PUBLIC_SITE_URL`, the Supabase auth URLs, and rebuilding so the downloadable extension is
repackaged for the new origin.

## Release artifact

`npm run build:netlify` first packages the validated extension from `apps/extension` into `dist/extension`,
replacing its development site origin with `NEXT_PUBLIC_SITE_URL`. It then creates
`apps/web/public/downloads/plant-extension-v0.1.0-beta.1.zip`. The version comes from the extension manifest
plus `release-metadata.json`, which the landing page also reads.

The download packager fails unless the release artifact has the configured origin, has no `localhost` or
`127.0.0.1` runtime text, and contains `manifest.json` at the ZIP root. The preceding release validator also
checks every manifest/popup runtime reference. Generated `dist` and download artifacts are ignored; Netlify
reproducibly creates and includes the ZIP in the Next.js public assets during every build.

## Post-deployment MVP smoke test

### Public garden and Supabase

- Open `/` and confirm the extension section and garden link render.
- Open `/garden`, visit a populated garden, and refresh the direct garden URL; no Netlify 404 should occur.
- Confirm published plants render from the remote project and the browser console/network panel has no
  missing configuration or localhost requests.

### Extension download and linking

- Download `/downloads/plant-extension-v0.1.0-beta.1.zip`; confirm the response is a ZIP, not HTML.
- Extract it and confirm `manifest.json` is at the extracted folder root. In `src/config/siteOrigin.js`,
  confirm the Netlify HTTPS origin and no localhost value.
- Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select that folder.
- Open the extension and start setup. Confirm account linking opens the deployed `/account/link-extension`
  page, authenticate, approve, and confirm the extension reports linked status.

### Publication and new lifecycle

- Mature a beta plant and publish it. Confirm the submit API succeeds, its receipt/garden URL uses the
  Netlify HTTPS origin, and the immutable plant appears in the public garden.
- Start/reset the extension's next local plant and confirm the previously published garden plant persists.
  Publication and the new local lifecycle are intentionally independent.

These browser/remote checks must be performed after the owner supplies Netlify and Supabase access; a local
production build validates packaging and route compilation but cannot substitute for the live services.
