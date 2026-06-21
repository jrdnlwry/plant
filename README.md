# Plant Extension

A phased browser extension MVP for a small ambient plant companion.

## Phase 0

Phase 0 defines the pixel-art design target for the plant companion before the deeper simulation is built. See [`docs/phase-0-pixel-art-design-system.md`](docs/phase-0-pixel-art-design-system.md) for the style guide, palette, shape language, growth-state rules, SVG pixel constraints, and sample plant-type mockups.

## Phase 1

Phase 1 is a Chrome Manifest V3 extension that injects a lightweight static SVG plant overlay into ordinary webpages and exposes a popup toggle to show or hide the plant on the current tab.

### Load locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension/` directory.
5. Open an ordinary webpage and use the extension popup to toggle the plant overlay.

Future phases will add persisted plant state, onboarding, deterministic growth, weather, and dynamic SVG rendering.
