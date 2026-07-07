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
4. Select the `extension/` directory.
5. Open an ordinary webpage and use the extension popup to toggle the plant overlay.

Future phases will add persisted plant state, onboarding, deterministic growth, weather, and dynamic SVG rendering.

## Phase 4

Phase 4 replaces the fixed hand-authored plant shapes with a deterministic modular pixel growth language. Plant SVGs are now assembled from reusable modules—stems, trunks, branches, leaf clusters, buds, flowers, tendrils, canopy clusters, and the shared pot—using a saved seed plus plant-type rules so different seeds produce visibly different but stylistically consistent companions.

## Phase 5

Phase 5 makes the renderer L-system-inspired while preserving the existing crisp pixel-art output. A seeded stochastic grammar now produces bracketed plant structures per type, derives weather- and age-sensitive growth parameters, walks the grammar with a snapped turtle interpreter, and stamps stems, branches, leaves, flowers, rosettes, and canopy pixels into the same 32×32 SVG grid. The result keeps each plant family recognizable while allowing individual seeds and weather conditions to create more organic silhouettes.
