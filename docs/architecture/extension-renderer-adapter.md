# Extension renderer adapter audit

## Scope and current status

This document records the Chrome extension loading model before the extension is
connected to `@plant/plant-renderer`. It is an architectural audit, not the
adapter implementation. At the time of this audit, the website imports the
package through its workspace dependency, while every extension realm obtains
rendering through `PlantCompanionState.renderPlantSvg` from
`src/sharedPlantState.js`.

## Manifest and extension runtime model

`apps/extension/manifest.json` is a Manifest V3 manifest. Chrome loads the
extension directly from the files below `apps/extension`; there is no extension
build output directory or bundle referenced by the manifest.

The manifest defines three distinct runtime contexts:

1. **Popup extension page.** The action opens `src/popup/popup.html`.
2. **Content-script isolated world.** Chrome declaratively loads scripts into
   matching pages at `document_idle`.
3. **Background extension service worker.** Chrome starts
   `src/background/weatherService.js` as the Manifest V3 service worker.

These are separate JavaScript realms. In particular, assigning a value to
`window` in the popup does not make it available to a content script. A content
script also runs in Chrome's isolated world: it can interact with the page DOM,
but its JavaScript globals are isolated from both the webpage's main world and
the popup. The service worker has `globalThis` but no `window`. Consequently, a
renderer browser global must be loaded independently in every context that
executes it; a global created in one context cannot be reused by another.

## Popup loading order

`src/popup/popup.html` contains ordinary external, non-module script tags at the
end of `<body>`, in this order:

1. `/src/sharedPlantState.js`
2. `/src/popup/popup.js`

Classic scripts execute in document order, so `sharedPlantState.js` creates
`window.PlantCompanionState` before `popup.js` reads it. There are no inline
scripts, `type="module"` scripts, dynamic imports, or dynamically added popup
scripts. The leading-slash paths are extension-root-relative URLs.

The popup calls `window.PlantCompanionState.renderPlantSvg(state)` to populate
the preview. It also uses the same global for storage, normalization, lifecycle,
weather helper functions, plant presets, and the renderer version. This means a
renderer adapter can be introduced without converting `popup.js` to ESM, but
load order must continue to make its API available before `popup.js` executes.

## Content-script loading order

The manifest declares one content-script entry for `<all_urls>`. At
`document_idle`, Chrome loads these classic JavaScript files in the listed
order:

1. `src/sharedPlantState.js`
2. `src/content/injectPlant.js`

It also loads `src/content/overlay.css`. Because the scripts share one content
script isolated world, `injectPlant.js` can read the
`window.PlantCompanionState` global created by the preceding script. The overlay
calls `window.PlantCompanionState.renderPlantSvg(state)` and uses the same global
for state, storage, weather helpers, plant metadata, and renderer-version
messages.

There are two additional programmatic injection paths for existing tabs:

- The popup uses `chrome.scripting.insertCSS` and
  `chrome.scripting.executeScript` when it needs to install the companion in the
  current tab.
- The background service worker uses the same APIs to install or reinstall the
  companion in open tabs on service-worker evaluation, extension installation,
  and browser startup.

Both programmatic paths pass the same ordered script file list,
`src/sharedPlantState.js` followed by `src/content/injectPlant.js`. Thus the
declarative and programmatic paths currently agree on their dependency order.
Any renderer artifact added for the overlay must be inserted before the
consumer in **all three lists**: the manifest, the popup's injection list, and
the background worker's injection list. Re-execution is already expected:
`injectPlant.js` detects an existing companion with the current renderer
version and reuses it.

## Background service-worker loading

The service worker is a classic worker, not a module worker. Its first statement
is `importScripts('/src/sharedPlantState.js')`. The shared script assigns its API
to `globalThis.PlantCompanionState`, which makes state and lifecycle operations
available to the worker even though `window` is absent. The worker does not
render SVG today, but it does use storage and lifecycle methods from the same
global and compares/injects renderer-bearing scripts elsewhere.

If `sharedPlantState.js` is changed to depend on a separate renderer global, the
worker must load that artifact first (for example, by listing it before
`sharedPlantState.js` in `importScripts`). Alternatively, the adapter boundary
must ensure that loading the state script in the worker does not require DOM or
`window` APIs.

## How `PlantCompanionState` is created

`src/sharedPlantState.js` is a classic JavaScript file wrapped in an immediately
invoked function expression. At the end of that function, it constructs one
`api` object and assigns it to `globalThis.PlantCompanionState`; when `window`
exists, it also assigns the same object to `window.PlantCompanionState`.

The file currently contains two kinds of code behind that one global:

- extension-specific state/storage/weather/lifecycle behavior; and
- the legacy renderer implementation, including seeded generation, render
  parameter derivation, pixel generation, and SVG serialization.

Therefore merely wrapping the existing `renderPlantSvg` in another extension
file would leave an independently maintained renderer in place. The eventual
adapter or generated artifact must originate from `@plant/plant-renderer`, and
the legacy renderer implementation must be removed from
`sharedPlantState.js`. `PlantCompanionState` may remain as the compatibility API
used by the popup and overlay, delegating renderer calls to that package-derived
global.

## Content Security Policy constraints

The manifest does not declare a custom `content_security_policy`, so Manifest V3
uses Chrome's default extension-page policy (`script-src 'self'; object-src
'self'`). The implementation should also respect Manifest V3's minimum CSP and
remote-code rules.

Practical consequences for an adapter are:

- extension scripts must be packaged locally with the extension;
- remote scripts are not an option;
- inline JavaScript in extension pages is prohibited by the effective policy;
- `eval`, `new Function`, string-to-code timers, and similar dynamic code
  generation are prohibited;
- the adapter must not depend on runtime transpilation or fetching executable
  code; and
- ordinary packaged classic JavaScript is permitted.

Content scripts are additionally governed by Chrome's isolated-world execution
model. The safest artifact is therefore a local, static classic script that
performs no dynamic code generation and exposes a deliberately named global.
It can be plain JavaScript with no imports. This is compatible with the current
popup script tags, content-script declarations, `executeScript({ files })`, and
classic worker `importScripts` without a broad ESM migration.

## Generated artifacts and packaging today

No generated JavaScript artifact is currently used by the extension. There is
no extension bundler, transpiler, build script, `dist` directory, or packaging
step. The extension workspace exposes only a validation command, and the root
scripts likewise provide `validate:extension` rather than `build:extension`.

The extension validator currently:

- parses `manifest.json` as JSON;
- checks that the popup, service worker, content scripts, and content CSS
  referenced by the manifest exist;
- scans external popup `<script src>` and `<link href>` resources and verifies
  that local targets exist; and
- explicitly checks the current background, shared-state, content-script, and
  stylesheet files.

It does not bundle code, validate script order or CSP compliance, reject inline
scripts, compare a generated artifact with package source, or ensure that every
programmatic injection list matches the manifest. There is also no extension
test command beyond this validation; repository tests exercise shared state and
the renderer package separately.

Manifest and HTML paths therefore assume that every required runtime file is
present beneath `apps/extension` when the source directory is loaded as an
unpacked extension. If a generated browser-global renderer is chosen, either:

1. it must be committed at the exact path referenced by the manifest/HTML and
   kept reproducible with a validation check; or
2. an explicit extension build/package command must generate it before loading
   or packaging, and documentation must stop describing the raw source tree as
   directly loadable.

The first option is the smaller change and preserves the present direct-load
workflow. It should include a deterministic generation command and a stale-file
check so the committed artifact cannot silently diverge from
`@plant/plant-renderer`.

## Smallest safe adapter boundary

The current architecture supports a narrow package-to-classic-script bridge:

1. Generate a local classic browser-global artifact from
   `@plant/plant-renderer` and its package dependencies.
2. Expose only the package renderer contract needed at runtime (including
   snapshot normalization, compatibility checking, model creation, SVG
   rendering, and version constants) on a renderer-specific global.
3. Load that artifact before `sharedPlantState.js` in the popup, content-script
   declarations, programmatic injection paths, and classic service worker if the
   shared-state facade requires it there.
4. Preserve `window.PlantCompanionState` as the extension compatibility facade,
   but make its renderer members normalize extension state and then delegate to
   the package-derived global.
5. Delete the renderer implementation from `sharedPlantState.js`; do not keep a
   fallback copy, because a fallback would recreate the dual-maintenance risk.
6. Extend validation/tests to prove the artifact is current, locally packaged,
   loaded in the required order, deterministic, non-mutating, and produces the
   expected extension SVG for the existing fixture/state inputs.

This boundary leaves storage, weather retrieval, lifecycle advancement, popup
DOM behavior, and overlay DOM behavior where they are. It also preserves the
plant snapshot as canonical state: SVG remains derived, disposable output, and
the renderer does not gain access to Chrome storage, weather retrieval, or
lifecycle mutation.

### State normalization at the facade

The existing extension normalizer does not add `schemaVersion` or
`rendererVersion`, while `@plant/plant-renderer` accepts only a strict current
`PlantStateSnapshot`. Directly passing an extension state to the package would
therefore fail compatibility checking before rendering. The facade's renderer
methods must first pass the state through the package-derived
`normalizePlantStateSnapshot` (or an equivalent explicit migration bundled from
`@plant/plant-core`) and delegate only the resulting snapshot. That conversion
must add the current schema and renderer versions, preserve the extension's
canonical fields, normalize nested weather data, and return a new value rather
than mutating the stored state supplied by the caller.

This conversion belongs at the compatibility facade rather than in the strict
renderer. It allows both previously stored unversioned extension states and
newly created states to render, while keeping the package renderer's rejection
of invalid or unsupported snapshots intact. A later persisted schema version
must receive an explicit migration policy rather than being passed through or
silently treated as current. Tests for the adapter should cover an unversioned
stored fixture, a newly created extension state, version fields on the delegated
snapshot, weather normalization, input non-mutation, and the behavior for an
explicit unsupported future version.

## Audit conclusion

A plain, self-contained browser-global JavaScript artifact is compatible with
the current Manifest V3 extension and is the smallest safe integration path.
It must be loaded independently in the popup and content-script isolated world;
the service worker also needs explicit loading if the shared-state facade has a
load-time renderer dependency. No ESM migration is required. The critical
implementation risks are inconsistent ordering across the declarative and two
programmatic injection paths, delegation of unversioned extension state without
normalization, accidental retention of the legacy renderer, and an unverified
committed artifact drifting from the shared package.
