# Plant Extension

A phased browser extension MVP for a small ambient plant companion.

## Phase 0

Phase 0 defines the pixel-art design target for the plant companion before the deeper simulation is built. See [`docs/phase-0-pixel-art-design-system.md`](docs/phase-0-pixel-art-design-system.md) for the style guide, palette, shape language, growth-state rules, SVG pixel constraints, and sample plant-type mockups.

Lifecycle milestone ordering for believable plant growth is documented in [`docs/plant-lifecycle-design.md`](docs/plant-lifecycle-design.md), with a visual contact sheet in [`assets/lifecycle-stage-examples.svg`](assets/lifecycle-stage-examples.svg).

## Phase 1

Phase 1 is a Chrome Manifest V3 extension that injects a lightweight static SVG plant overlay into ordinary webpages and exposes a popup toggle to show or hide the plant on the current tab.

### Load locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `apps/extension/` directory.
5. Open an ordinary webpage and use the extension popup to toggle the plant overlay.

Future phases will add persisted plant state, onboarding, deterministic growth, weather, and dynamic SVG rendering.

## Phase 4

Phase 4 replaces the fixed hand-authored plant shapes with a deterministic modular pixel growth language. Plant SVGs are now assembled from reusable modules—stems, trunks, branches, leaf clusters, buds, flowers, tendrils, canopy clusters, and the shared pot—using a saved seed plus plant-type rules so different seeds produce visibly different but stylistically consistent companions.

## Phase 5

Phase 5 makes the renderer L-system-inspired while preserving the existing crisp pixel-art output. A seeded stochastic grammar now produces bracketed plant structures per type, derives weather- and age-sensitive growth parameters, walks the grammar with a snapped turtle interpreter, and stamps stems, branches, leaves, flowers, rosettes, and canopy pixels into the same 32×32 SVG grid. The result keeps each plant family recognizable while allowing individual seeds and weather conditions to create more organic silhouettes.

## Phase 0.75 web workspace

Phase 0.75 adds `apps/web`, an isolated Next.js App Router workspace for the future website and API surface. The Chrome extension in `apps/extension` remains locally usable without running the website, creating an account, connecting Supabase, configuring Stripe, or enabling network synchronization. Website deployment does not update, replace, or alter Chrome extensions that users have already installed.

### Install dependencies

Install from the repository root so npm uses the single root `package-lock.json` and workspace layout:

```bash
npm install
```

Do not create a separate lockfile inside `apps/web`.

### Run the web app locally

```bash
npm run dev:web
```

The app exposes a minimal home route at `/` and a read-only placeholder at `/garden`. During this phase, the web app only imports the shared plant-state contract from `@plant/plant-core`; it does not read extension storage or mutate plant state.

### Build the web app

```bash
npm run build:web
```

The build must succeed without Supabase or Stripe credentials. `apps/web/.env.example` documents future placeholders, split between public `NEXT_PUBLIC_*` values and server-only secrets.

### Extension validation and tests

Run the extension manifest/resource validation directly:

```bash
npm run validate:extension
```

Run the existing Node characterization tests directly:

```bash
node --test
```

Run the combined root verification workflow:

```bash
npm test
```

The root `npm test` command preserves extension validation and Node characterization tests, and also runs the web workspace contract tests. The web tests exercise the strict shared plant snapshot guard from `@plant/plant-core` for valid snapshots, malformed snapshots, wrong schema versions, and incomplete nested weather snapshots.

### Vercel workspace configuration

When deploying the website to Vercel, configure the project with:

- **Root Directory:** `apps/web`
- **Install Command:** `npm install` from the repository root/workspace context
- **Build Command:** `npm run build:web` from the repository root, or `npm run build` when Vercel is scoped directly to `apps/web`
- **Development Command:** `npm run dev:web` from the repository root, or `npm run dev` inside `apps/web`
- **Output:** the default Next.js output managed by Vercel

Future environment variables are documented in `apps/web/.env.example`:

- Public browser-readable placeholders: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Server-only placeholders: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

Supabase and Stripe remain selected for later phases, but this phase does not instantiate clients, define database schemas, add API routes, implement authentication, configure payments, publish plants, synchronize extension data, schedule jobs, or simulate garden lifecycle behavior.

## Extension renderer artifact

The unpacked extension commits a classic-script renderer generated from the canonical
`packages/plant-renderer` source. Regenerate and verify it after changing the renderer
or its `plant-core` schema dependency:

```sh
npm run build:extension-renderer
npm run verify:extension-renderer
```

Verification is read-only and fails when the committed artifact is missing or stale.
