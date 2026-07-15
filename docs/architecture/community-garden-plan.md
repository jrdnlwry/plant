# Community garden architecture decisions (Phase 0.5)

## Selected future stack

- Website/API: Next.js
- Database + Auth: Supabase
- Deployment: Vercel
- Payments and subscriptions source of truth: Stripe

These are selected decisions for future phases, not implemented behavior in Phase 0.5.

## Recorded decisions

- Local extension use remains available without login.
- Garden participation will be opt-in.
- The extension plant object remains the local source of truth.
- The backend will persist normalized plant-state snapshots rather than SVG.
- Authentication will belong to the future website and API layer.
- The website and extension must consume the same versioned plant-state contract.
- Stripe will be the future source of truth for payments and subscriptions.
- Supabase may store synchronized subscription and entitlement fields updated through verified Stripe webhooks.
- “Change setup,” “reset local plant,” “remove from garden,” and “delete garden plant” are separate actions.
- Server-owned lifecycle processing is deferred until synchronization and conflict ownership are designed.
- All future plant mutations should eventually pass through one mutation boundary.
- The initial synchronization model should favor explicit publishing or simple one-way snapshot synchronization instead of complex bidirectional synchronization.
- The initial MVP should allow users to experience the local extension before being asked to create an account.

## Remaining unresolved decisions

- Extension authentication flow.
- Extension-to-web account linking.
- Synchronization ownership.
- Conflict resolution.
- Server lifecycle ownership.
- Location privacy.
- Public versus private plant visibility.
- Plant-state version migration.
- Renderer-version compatibility.
- Whether lifecycle advancement eventually runs locally, server-side, or through a hybrid model.
- Whether published garden plants update automatically or only when republished.
- How subscription entitlements will be cached and enforced.
- How users remove a published plant without deleting their local plant.
- How location data should be reduced or anonymized before publication.

## Phase boundaries

Phase 0.5 introduces documentation, characterization tests, and a minimal shared contract only. It does not implement the community garden, website, Supabase, authentication, Stripe, extension synchronization, backend persistence, API routes, database schema, or server lifecycle processing.
