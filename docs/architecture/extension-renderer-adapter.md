# Extension renderer adapter

## Implemented architecture

`packages/plant-renderer` is the only editable renderer source. The focused, deterministic
TypeScript bundling script at `scripts/build-extension-renderer.mjs` follows the renderer's
production dependency graph and emits a self-contained CommonJS-module-runtime IIFE at
`apps/extension/src/generated/plantRenderer.global.js`. The committed output is build output;
it must not be edited directly and contains no testing fixture export.

The classic artifact assigns `globalThis.PlantCompanionRenderer`, so the same file works in
extension pages, content-script isolated worlds, and the service worker without assuming
`window`. Its public production rendering contract is `checkRenderCompatibility`,
`createPlantRenderModel`, and `renderPlantSvg`. It additionally exposes the package-derived
snapshot guard, normalizer, schema version, and renderer version needed by the narrow legacy
adapter; it has no DOM, Chrome, storage, network, lifecycle, React, or Next.js dependency.

Generate or check it without network access:

```sh
npm run build:extension-renderer
npm run verify:extension-renderer
```

Regenerate whenever `packages/plant-renderer`, its `packages/plant-core` dependency, or the
build script changes. Verification generates in memory, does not modify the repository, and
fails clearly for a missing or byte-stale artifact. Root `npm test` runs this stale check.

## Realm loading order

Each independent realm loads its own copy of the global:

1. Popup: `/src/generated/plantRenderer.global.js`, `/src/sharedPlantState.js`, then
   `/src/popup/popup.js`.
2. Declarative and programmatic content injection: `src/generated/plantRenderer.global.js`,
   `src/sharedPlantState.js`, then `src/content/injectPlant.js`.
3. Service worker: `importScripts` loads `/src/generated/plantRenderer.global.js` before
   `/src/sharedPlantState.js`.

All resources are packaged locally and remain classic scripts compatible with Manifest V3 CSP.

## Legacy-state migration boundary

`PlantCompanionState.toRenderablePlantSnapshot` is the explicit render-only boundary. It
never persists or mutates the caller's state. Unversioned extension state with a recognized
plant type and string location is normalized with package code: current version metadata is
added, lifecycle and identity fields are preserved/clamped under the shared rules, incomplete
weather becomes a complete `WeatherSnapshot`, timestamps are retained when supplied, and a
missing seed becomes zero to preserve the historical extension renderer's effective RNG seed.
The resulting value must pass the package `isPlantStateSnapshot` guard before compatibility is
checked and rendering is delegated.

A current strict snapshot follows the same clone-and-validation path. Explicit non-current
schema versions and renderer versions are rejected before normalization, so future data is not
silently rewritten. Malformed legacy objects are rejected rather than replaced by a default
plant. Schema failure, renderer-version failure, and malformed-state failure remain separately
identifiable.

Where `window` exists, `window.PlantCompanionState.renderPlantSvg(state)` remains the popup and
overlay compatibility facade. Its implementation now performs migration, strict validation,
compatibility checking, and delegation to `globalThis.PlantCompanionRenderer` in that order.
There is no fallback renderer in extension source.

## Ownership and remaining risks

The generated file is committed because Chrome loads `apps/extension` directly. CI and local
root tests must retain stale-artifact verification. The principal remaining risk is browser-only
interaction regression; structural and VM equivalence tests cover realm wiring and output, but
unpacked-extension popup, drag, toggle, and modal behavior still require a real Chrome session.
Weather, storage, location, lifecycle advancement, and reset remain extension responsibilities.
Authentication, synchronization, backend APIs, payments, publishing, persistence services, and
community garden work remain deferred to Phase 0.9 or later.
