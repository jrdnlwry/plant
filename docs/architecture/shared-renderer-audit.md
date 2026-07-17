# Phase 0.8 shared renderer audit

## Current rendering entry points

- Popup preview: `apps/extension/src/popup/popup.js` calls `window.PlantCompanionState.renderPlantSvg(state)` and assigns the returned SVG string to `#plant-preview.innerHTML`.
- Webpage overlay: `apps/extension/src/content/injectPlant.js` calls `window.PlantCompanionState.renderPlantSvg(state)` and assigns the returned SVG string to the overlay root `innerHTML`.
- Website preview: `apps/web/app/garden/preview/page.tsx` renders the deterministic fixture using `createPlantRenderModel` from `@plant/plant-renderer`.

## Shared and duplicated code

Before Phase 0.8, popup and overlay already shared one extension renderer: `renderPlantSvg` in `apps/extension/src/sharedPlantState.js`. The website had no plant renderer. Phase 0.8 adds a framework-independent shared render-model package at `packages/plant-renderer` rather than adding a second website renderer.

The extension still owns extension-specific storage, weather refresh, lifecycle advancement, popup controls, overlay DOM insertion, drag handling, and stats panel markup. Those are not moved into shared packages.

## Renderer inputs and output

- Canonical shared boundary: `createPlantRenderModel(snapshot: PlantStateSnapshot)`.
- Strict compatibility check: `checkRenderCompatibility(value)` rejects unsupported renderer versions before validating the full snapshot.
- Input must already be a valid `PlantStateSnapshot`; malformed raw objects are not normalized into renderable plants.
- Output is a deterministic, serializable `PlantRenderModel` containing SVG view box, accessible label, opacity, plant pixels, and pot rectangles.
- Visual rendering may convert the model to SVG markup or React SVG elements, but rendered SVG is not canonical state.

## Dependencies

The shared renderer depends on `@plant/plant-core` for plant types, `PlantStateSnapshot`, `isPlantStateSnapshot`, and `rendererVersion`. It does not depend on React, Next.js, DOM APIs, Chrome APIs, storage, network APIs, Date, or live weather.

Extension rendering depends on browser DOM APIs only at the adapter layer (`innerHTML`, overlay root creation, event listeners). Chrome APIs are used by storage, messaging, injection, and weather flows, not by the pure shared render-model computation.

Styling remains adapter-specific: popup styles live in `apps/extension/src/popup/popup.css`, overlay styles in `apps/extension/src/content/overlay.css`, and web preview styles in `apps/web/app/globals.css`.

## Determinism and mutation

The renderer uses seeded pseudo-random variation derived from `snapshot.seed`, growth stage, and growth progress. It does not call `Math.random()`, `Date.now()`, current date APIs, extension storage, local storage, live weather, or lifecycle advancement. It does not mutate the input snapshot.

## Renderer version handling

`rendererVersion` remains separate from `schemaVersion`. The shared boundary supports only the current renderer version from `@plant/plant-core`. Unsupported renderer versions produce `{ supported: false, reason: "unsupported-renderer-version", receivedVersion, supportedVersion }`. Wrong schema versions fail as invalid snapshots, which is distinct from renderer-version incompatibility.

## Browser and Next.js compatibility

The pure render-model computation is serializable and can run in a normal browser page or a Next.js component because it uses only JavaScript data structures. The web route keeps rendering server-side/static and does not require a client component.

## Risks

- The extension content-script loading model is not ESM-based, so a later phase should decide whether to bundle `@plant/plant-renderer` into the extension or generate a browser-global adapter from the package.
- Extension legacy saved states may not contain `schemaVersion`; extension lifecycle/storage migration should remain separate from renderer compatibility work.
- Full pixel-for-pixel extension parity should be protected if the extension is later switched directly to the shared package bundle.

## Recommended smallest safe extraction

The smallest safe boundary is a pure render-model package: `packages/plant-renderer`. This avoids moving extension UI, Chrome API usage, DOM behavior, weather behavior, or lifecycle mutation into `plant-core`, while giving the website a canonical rendering boundary.

## Files likely to change in later phases

- `apps/extension/src/sharedPlantState.js` if the extension is bundled against `@plant/plant-renderer` directly.
- `apps/extension/manifest.json` if generated renderer assets are introduced.
- `apps/web/app/garden/preview/page.tsx` when persisted garden snapshots replace the deterministic fixture.

## Assumptions later phases must preserve

- The plant snapshot remains canonical state; rendered output is disposable derived data.
- Rendering must remain read-only and deterministic for a fixed snapshot.
- Website pages must not read Chrome extension storage or advance lifecycle state.
- Renderer version and plant schema version remain independently validated.
- Unsupported renderer versions must not silently render with the current implementation.
- Public garden, auth, Supabase, Stripe, synchronization, publishing, persistence, scheduled jobs, and lifecycle mutation are deferred.
