# Current system audit (Phase 0.5)

This audit preserves the prior repository findings after checking the current task branch. No material divergence from the prior extension-first architecture was found in the tracked source.

## Relevant files and directories

- `apps/extension/manifest.json` defines the Manifest V3 Chrome extension, popup, background service worker, permissions, alarms, storage, scripting, and web-accessible resources.
- `apps/extension/src/sharedPlantState.js` is the current canonical runtime implementation for local plant state normalization, lifecycle advancement, weather modifiers, deterministic seed handling, and SVG rendering.
- `apps/extension/src/background/weatherService.js` owns remote weather fetching, overlay injection, and the weather refresh alarm.
- `apps/extension/src/content/injectPlant.js` owns webpage overlay DOM insertion, visibility, drag behavior, stats display, and storage-change rendering.
- `apps/extension/src/popup/popup.html`, `popup.css`, and `popup.js` own local setup, preview rendering, refresh, reset/change setup, and overlay messaging.
- `scripts/validate-extension.mjs` validates the extension manifest and required file paths.
- `packages/plant-core/src/*` now contains the minimal versioned, environment-independent plant and weather snapshot contract introduced during Phase 0.5.
- `test/sharedPlantState.test.js` characterizes the existing extension plant model behavior.

## Current plant-state schema

The extension stores one local object under Chrome local storage key `ambientPlantState`. The current runtime shape includes `plantType`, `location`, `growthStage`, `health`, `hydration`, `growthProgress`, `flowerCount`, `weatherMood`, `weatherSummary`, `weather`, `seed`, `createdAt`, `updatedAt`, and `weatherUpdatedAt`.

Normalization defaults unknown plant types to `fern`, trims string locations, clamps `growthStage` to 1-4, clamps `health`, `hydration`, and `growthProgress` to 0-100, clamps `flowerCount` to 0-5, replaces invalid weather with `null`, and fills missing timestamps with the current time. The normalizer computes a deterministic fallback seed from plant type, trimmed location, and creation time, and explicit seeds are preserved. Current seedless saved objects and newly created objects do not receive that computed seed in the returned object because the computed value is not attached to the normalized return value; rendering therefore falls back to the renderer's numeric handling for missing seeds. This edge case is characterized and intentionally deferred.

During Phase 0.5 the extension implementation remains the canonical runtime definition because it is what Chrome loads. The shared package mirrors the contract for future website/API use and should become the single imported canonical schema in a later phase after packaging/build integration is added safely.

## Current lifecycle flow

Creation starts in the popup form, creates an initial plant with stage 1, health 85, hydration 70, zero progress, zero flowers, and a deterministic seed, then saves it to Chrome storage. Popup and overlay reads normalize saved state before rendering.

Lifecycle advancement is elapsed-time based with weather modifiers. Hydration decays with elapsed days, health decays with elapsed days and low hydration, and growth increases from elapsed time, rain, and sun while hot or cloudy conditions can reduce growth. Elapsed days are clamped to at most seven days per advancement.

A single lifecycle advancement can increase `growthStage` by at most one stage. If progress reaches or exceeds 100 and the stage is below 4, the stage increments once and 100 progress is subtracted; the function does not loop through additional possible stage increases. This edge case is intentionally preserved and tested.

Flower generation is restricted by plant type, minimum stage, sunny mood, health over 70, sufficient weather-effect timing, and deterministic RNG. Ferns do not generate flowers under the current rules.

## Current persistence architecture

Persistence is entirely local extension persistence via `chrome.storage.local`. There is no backend persistence, database access, API synchronization, account identity, garden publication, or payment state. `getStoredPlantState` reads and normalizes the object; `savePlantState` normalizes and writes it with a fresh `updatedAt` timestamp.

## Current weather architecture

Weather lookup is initiated from shared state through a Chrome runtime message and handled by the background service worker. The background worker geocodes U.S. `City, State` input through Open-Meteo, selects a matching U.S. place, fetches current and recent daily weather, and returns a normalized weather-like object with temperature, humidity, precipitation, weather code, wind speed, day/night, recent rain, recent sun hours, and `fetchedAt`.

Weather refresh is considered stale after one hour, while the background alarm runs every 30 minutes and refreshes stored plants that have a location. The task intentionally does not change refresh timing.

## Existing backend capabilities

There is no application backend in this repository. The only network-backed capability is extension-side weather fetching from the background service worker to Open-Meteo. No API routes, database clients, auth providers, Stripe integration, garden sync, or server lifecycle jobs exist.

## Existing website and deployment capabilities

There is no website application yet. The repository is a workspace-capable monorepo with an extension app and package workspace support, but no Next.js app, Vercel configuration, Supabase integration, or website deployment implementation exists.

## Existing test infrastructure

The root `npm test` command previously delegated to extension validation. Phase 0.5 keeps that validation and extends the root test command to run Node's built-in test runner. The validation script checks manifest structure and required extension file paths. The new behavior tests load the extension shared-state script in a VM with a small Chrome API stub.

## Existing extension alarms or scheduled behavior

The background service worker creates `ambient-plant-weather-refresh` with a 30-minute period during install, startup, and service-worker evaluation. Alarm handling fetches remote weather for the stored plant location, advances the plant once, and saves the resulting state. This behavior is unchanged.

## Preview-versus-overlay rendering behavior

The popup preview and webpage overlay both derive SVG from `window.PlantCompanionState.renderPlantSvg`. The popup injects `src/sharedPlantState.js` and `src/content/injectPlant.js` into the active tab when necessary, and renderer-version handshakes ensure the current overlay renderer responds. The overlay re-renders on storage changes and on popup refresh messages.

## Important technical risks

- The current runtime schema lives in an extension IIFE, so the new shared TypeScript contract is temporarily duplicated rather than imported by the extension.
- Timestamps filled during normalization make some incomplete-state normalization time-dependent.
- Seedless state computes but does not attach a fallback seed in the current extension runtime; fixing that could change existing deterministic output and is deferred.
- Lifecycle advancement has intentionally preserved edge cases, including at most one stage increase per advancement.
- Weather location parsing is U.S.-specific and stores user-provided location text locally.
- Chrome APIs make integration testing dependent on stubs unless a browser-based test harness is added.
- No server ownership, synchronization model, conflict resolution, auth, privacy model, or entitlement enforcement exists yet.

## Assumptions later phases should preserve

- Local extension use remains available without login.
- Existing saved plants must continue to normalize safely.
- Popup preview and overlay should continue to use one renderer implementation.
- Chrome storage key and alarm timing should not change without migration notes.
- Renderer and plant-state versions should be advanced deliberately when compatibility changes.
- Future website/API code should consume the versioned shared plant-state contract rather than inventing another schema.
