// Generated from packages/plant-renderer.
// Do not edit directly.
// Run: npm run build:extension-renderer
(() => {
  const modules = {
"packages/plant-core/src/index.ts": function(module, exports, require) {
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function (o, m, k, k2) {
    if (k2 === undefined)
        k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function () { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function (o, m, k, k2) {
    if (k2 === undefined)
        k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function (m, exports) {
    for (var p in m)
        if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p))
            __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("packages/plant-core/src/plantTypes.ts"), exports);
__exportStar(require("packages/plant-core/src/plantSchema.ts"), exports);
__exportStar(require("packages/plant-core/src/weatherSchema.ts"), exports);
__exportStar(require("packages/plant-core/src/versions.ts"), exports);
__exportStar(require("packages/plant-core/src/serialization.ts"), exports);

},
"packages/plant-core/src/plantSchema.ts": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultPlantStateSnapshot = void 0;
exports.clamp = clamp;
exports.hashString = hashString;
exports.normalizePlantStateSnapshot = normalizePlantStateSnapshot;
exports.isPlantStateSnapshot = isPlantStateSnapshot;
const plantTypes_ts_1 = require("packages/plant-core/src/plantTypes.ts");
const weatherSchema_ts_1 = require("packages/plant-core/src/weatherSchema.ts");
const versions_ts_1 = require("packages/plant-core/src/versions.ts");
exports.defaultPlantStateSnapshot = {
    schemaVersion: versions_ts_1.plantStateVersion,
    rendererVersion: versions_ts_1.rendererVersion,
    plantType: plantTypes_ts_1.defaultPlantType,
    location: '',
    growthStage: 1,
    health: 85,
    hydration: 70,
    growthProgress: 0,
    flowerCount: 0,
    weatherMood: 'starting',
    weatherSummary: 'Waiting for local weather',
    weather: null,
    seed: 0,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    weatherUpdatedAt: null,
};
function clamp(value, min, max) {
    return Math.min(Math.max(Number(value) || 0, min), max);
}
function hashString(value) {
    return String(value || '').split('').reduce((hash, char) => {
        const nextHash = (hash << 5) - hash + char.charCodeAt(0);
        return nextHash >>> 0;
    }, 2166136261);
}
function normalizePlantStateSnapshot(value, now = new Date().toISOString()) {
    const input = value && typeof value === 'object' ? value : {};
    const plantType = (0, plantTypes_ts_1.isPlantType)(input.plantType) ? input.plantType : plantTypes_ts_1.defaultPlantType;
    const location = typeof input.location === 'string' ? input.location.trim() : '';
    const createdAt = typeof input.createdAt === 'string' && input.createdAt ? input.createdAt : now;
    const seed = Number.isFinite(Number(input.seed)) ? Number(input.seed) >>> 0 : hashString(`${plantType}|${location}|${createdAt}`);
    return {
        schemaVersion: versions_ts_1.plantStateVersion,
        rendererVersion: versions_ts_1.rendererVersion,
        plantType,
        location,
        growthStage: clamp(input.growthStage ?? exports.defaultPlantStateSnapshot.growthStage, 1, 4),
        health: clamp(input.health ?? exports.defaultPlantStateSnapshot.health, 0, 100),
        hydration: clamp(input.hydration ?? exports.defaultPlantStateSnapshot.hydration, 0, 100),
        growthProgress: clamp(input.growthProgress ?? exports.defaultPlantStateSnapshot.growthProgress, 0, 100),
        flowerCount: clamp(input.flowerCount ?? exports.defaultPlantStateSnapshot.flowerCount, 0, 5),
        weatherMood: typeof input.weatherMood === 'string' ? input.weatherMood : exports.defaultPlantStateSnapshot.weatherMood,
        weatherSummary: typeof input.weatherSummary === 'string' ? input.weatherSummary : exports.defaultPlantStateSnapshot.weatherSummary,
        weather: (0, weatherSchema_ts_1.normalizeWeatherSnapshot)(input.weather),
        seed,
        createdAt,
        updatedAt: typeof input.updatedAt === 'string' && input.updatedAt ? input.updatedAt : now,
        weatherUpdatedAt: typeof input.weatherUpdatedAt === 'string' ? input.weatherUpdatedAt : null,
    };
}
function hasFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function isPlantStateSnapshot(value) {
    if (!value || typeof value !== 'object')
        return false;
    const input = value;
    return input.schemaVersion === versions_ts_1.plantStateVersion
        && input.rendererVersion === versions_ts_1.rendererVersion
        && (0, plantTypes_ts_1.isPlantType)(input.plantType)
        && typeof input.location === 'string'
        && hasFiniteNumber(input.growthStage) && input.growthStage >= 1 && input.growthStage <= 4
        && hasFiniteNumber(input.health) && input.health >= 0 && input.health <= 100
        && hasFiniteNumber(input.hydration) && input.hydration >= 0 && input.hydration <= 100
        && hasFiniteNumber(input.growthProgress) && input.growthProgress >= 0 && input.growthProgress <= 100
        && hasFiniteNumber(input.flowerCount) && input.flowerCount >= 0 && input.flowerCount <= 5
        && typeof input.weatherMood === 'string'
        && typeof input.weatherSummary === 'string'
        && (input.weather === null || (0, weatherSchema_ts_1.isWeatherSnapshot)(input.weather))
        && hasFiniteNumber(input.seed)
        && typeof input.createdAt === 'string' && input.createdAt.length > 0
        && typeof input.updatedAt === 'string' && input.updatedAt.length > 0
        && (input.weatherUpdatedAt === null || typeof input.weatherUpdatedAt === 'string');
}

},
"packages/plant-core/src/plantTypes.ts": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plantTypeDefinitions = exports.defaultPlantType = exports.plantTypes = void 0;
exports.isPlantType = isPlantType;
exports.plantTypes = ['fern', 'succulent', 'blossom', 'vine', 'sapling'];
exports.defaultPlantType = 'fern';
exports.plantTypeDefinitions = {
    fern: { label: 'Fern', stem: '#2f7d32', leaf: '#4caf50', highlight: '#8bcf5a', silhouette: 'frond' },
    succulent: { label: 'Succulent', stem: '#3f7f5f', leaf: '#66b889', highlight: '#a6d9a8', silhouette: 'rosette' },
    blossom: { label: 'Blossom', stem: '#2f7d32', leaf: '#5fbf5a', highlight: '#f06ca7', flower: '#f06ca7', silhouette: 'flower' },
    vine: { label: 'Vine', stem: '#2f7d32', leaf: '#59a846', highlight: '#a8d65f', silhouette: 'tendril' },
    sapling: { label: 'Sapling', stem: '#6b3f24', leaf: '#4caf50', highlight: '#8bcf5a', silhouette: 'canopy' },
};
function isPlantType(value) {
    return typeof value === 'string' && exports.plantTypes.includes(value);
}

},
"packages/plant-core/src/serialization.ts": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializePlantStateSnapshot = serializePlantStateSnapshot;
exports.parsePlantStateSnapshot = parsePlantStateSnapshot;
exports.parseUnknownPlantStateSnapshot = parseUnknownPlantStateSnapshot;
exports.serializeWeatherSnapshot = serializeWeatherSnapshot;
exports.parseWeatherSnapshot = parseWeatherSnapshot;
const plantSchema_ts_1 = require("packages/plant-core/src/plantSchema.ts");
const weatherSchema_ts_1 = require("packages/plant-core/src/weatherSchema.ts");
function serializePlantStateSnapshot(snapshot) {
    return JSON.stringify((0, plantSchema_ts_1.normalizePlantStateSnapshot)(snapshot));
}
function parsePlantStateSnapshot(serialized) {
    return (0, plantSchema_ts_1.normalizePlantStateSnapshot)(JSON.parse(serialized));
}
function parseUnknownPlantStateSnapshot(value) {
    return (0, plantSchema_ts_1.normalizePlantStateSnapshot)(value);
}
function serializeWeatherSnapshot(snapshot) {
    return JSON.stringify((0, weatherSchema_ts_1.normalizeWeatherSnapshot)(snapshot));
}
function parseWeatherSnapshot(serialized) {
    return (0, weatherSchema_ts_1.normalizeWeatherSnapshot)(JSON.parse(serialized));
}

},
"packages/plant-core/src/versions.ts": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rendererVersion = exports.PLANT_STATE_SCHEMA_VERSION = exports.plantStateVersion = void 0;
exports.plantStateVersion = 1;
exports.PLANT_STATE_SCHEMA_VERSION = exports.plantStateVersion;
exports.rendererVersion = 'l-system-pixel-v2';

},
"packages/plant-core/src/weatherSchema.ts": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeWeatherSnapshot = normalizeWeatherSnapshot;
exports.isWeatherSnapshot = isWeatherSnapshot;
function toNumber(value, fallback) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
}
function normalizeWeatherSnapshot(value) {
    if (!value || typeof value !== 'object')
        return null;
    const input = value;
    return {
        placeName: typeof input.placeName === 'string' ? input.placeName : undefined,
        temperatureC: toNumber(input.temperatureC, 20),
        humidity: toNumber(input.humidity, 50),
        precipitation: toNumber(input.precipitation, 0),
        weatherCode: toNumber(input.weatherCode, 0),
        windSpeed: toNumber(input.windSpeed, 0),
        isDay: input.isDay !== false,
        recentRain: toNumber(input.recentRain, 0),
        recentSunHours: toNumber(input.recentSunHours, 0),
        fetchedAt: typeof input.fetchedAt === 'string' ? input.fetchedAt : new Date(0).toISOString(),
    };
}
function hasFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function isWeatherSnapshot(value) {
    if (!value || typeof value !== 'object')
        return false;
    const input = value;
    return (input.placeName === undefined || typeof input.placeName === 'string')
        && hasFiniteNumber(input.temperatureC)
        && hasFiniteNumber(input.humidity)
        && hasFiniteNumber(input.precipitation)
        && hasFiniteNumber(input.weatherCode)
        && hasFiniteNumber(input.windSpeed)
        && typeof input.isDay === 'boolean'
        && hasFiniteNumber(input.recentRain)
        && hasFiniteNumber(input.recentSunHours)
        && typeof input.fetchedAt === 'string' && input.fetchedAt.length > 0;
}

},
"packages/plant-renderer/src/index.ts": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_RENDERER_VERSION = void 0;
exports.checkRenderCompatibility = checkRenderCompatibility;
exports.createPlantRenderModel = createPlantRenderModel;
exports.renderPlantSvg = renderPlantSvg;
const plant_core_1 = require("packages/plant-core/src/index.ts");
exports.SUPPORTED_RENDERER_VERSION = plant_core_1.rendererVersion;
const L_SYSTEM_PRESETS = { fern: { axiom: 'X', angle: 34, step: 2, iterations: 2, startAngle: -90, rules: { X: [{ weight: 3, value: 'F[+X]F[-X]+X' }, { weight: 2, value: 'F[-X][+X]FX' }, { weight: 1, value: 'F[+L]F[-X]X' }], F: [{ weight: 2, value: 'FF' }, { weight: 1, value: 'F' }] } }, vine: { axiom: 'X', angle: 28, step: 2, iterations: 3, startAngle: -96, rules: { X: [{ weight: 3, value: 'F[+L]F[-X]FX' }, { weight: 2, value: 'F[-L][+X]F' }, { weight: 1, value: 'F[+X]F[-L]X' }], F: [{ weight: 3, value: 'F' }, { weight: 1, value: 'FF' }] } }, blossom: { axiom: 'X', angle: 31, step: 2, iterations: 3, startAngle: -90, rules: { X: [{ weight: 3, value: 'F[+L]F[-L]B' }, { weight: 2, value: 'F[+X][-X]B' }, { weight: 1, value: 'F[+B]F[-L]X' }], F: [{ weight: 2, value: 'FF' }, { weight: 1, value: 'F' }] } }, sapling: { axiom: 'X', angle: 24, step: 2, iterations: 3, startAngle: -90, rules: { X: [{ weight: 3, value: 'F[+X]F[-X]FC' }, { weight: 2, value: 'F[+C][-X]FX' }, { weight: 1, value: 'FF[+X][-C]C' }], F: [{ weight: 3, value: 'F' }, { weight: 2, value: 'FF' }] } }, succulent: { axiom: 'A', angle: 45, step: 2, iterations: 2, startAngle: -90, rules: { A: [{ weight: 1, value: 'L[+L][-L][++L][--L]A' }] } } };
function createRng(seed) { let value = seed >>> 0; return () => { value += 0x6d2b79f5; let result = value; result = Math.imul(result ^ (result >>> 15), result | 1); result ^= result + Math.imul(result ^ (result >>> 7), result | 61); return ((result ^ (result >>> 14)) >>> 0) / 4294967296; }; }
function weightedPick(rng, rules) {
    const total = rules.reduce((s, r) => s + r.weight, 0);
    let cursor = rng() * total;
    for (const rule of rules) {
        cursor -= rule.weight;
        if (cursor <= 0)
            return rule.value;
    }
    return rules[rules.length - 1].value;
}
function pixelKey(x, y) { return `${x},${y}`; }
function addPixel(pixels, x, y, fill) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || px > 31 || py < 0 || py > 31)
        return;
    pixels.set(pixelKey(px, py), fill);
}
function addBlock(pixels, x, y, w, h, fill) {
    for (let iy = 0; iy < h; iy++)
        for (let ix = 0; ix < w; ix++)
            addPixel(pixels, x + ix, y + iy, fill);
}
function drawPixelLine(pixels, x1, y1, x2, y2, fill, thickness = 1) {
    const steps = Math.max(Math.abs(Math.round(x2 - x1)), Math.abs(Math.round(y2 - y1)), 1);
    for (let step = 0; step <= steps; step++) {
        const ratio = step / steps;
        const x = Math.round(x1 + (x2 - x1) * ratio);
        const y = Math.round(y1 + (y2 - y1) * ratio);
        addPixel(pixels, x, y, fill);
        if (thickness > 1)
            addPixel(pixels, x + 1, y, fill);
    }
}
function deriveGrowthParameters(state) { const preset = plant_core_1.plantTypeDefinitions[state.plantType]; const stage = Math.round(state.growthStage); const healthRatio = state.health / 100; const hydrationRatio = state.hydration / 100; const windSpeed = state.weather?.windSpeed ?? 0; return { stage, lean: windSpeed >= 25 ? (windSpeed >= 40 ? 2 : 1) : 0, droop: Math.round((1 - hydrationRatio) * 3) + (state.weatherMood === 'hot' ? 1 : 0) - (state.weatherMood === 'rainy' ? 1 : 0), stemFill: healthRatio < 0.35 ? '#777a45' : preset.stem, leafFill: state.weatherMood === 'hot' || hydrationRatio < 0.35 ? '#86a85a' : state.weatherMood === 'rainy' ? '#55c767' : preset.leaf, highlight: state.weatherMood === 'cloudy' ? '#7fae68' : state.weatherMood === 'sunny' ? '#b6e66b' : preset.highlight, outline: healthRatio < 0.35 ? '#4f5133' : '#1f3b24', opacity: (0.55 + healthRatio * 0.45).toFixed(2), stepScale: 0.75 + stage * 0.18, iterations: Math.max(1, Math.min((L_SYSTEM_PRESETS[state.plantType]?.iterations || 2), stage === 1 ? 1 : stage === 2 ? 2 : 3)) }; }
function generateLSystem(state, params) {
    const config = L_SYSTEM_PRESETS[state.plantType] || L_SYSTEM_PRESETS.fern;
    const rng = createRng(state.seed + params.stage * 1009 + Math.round(state.growthProgress) * 17);
    let sentence = config.axiom;
    for (let i = 0; i < params.iterations; i++) {
        sentence = sentence.split('').map((symbol) => { const rules = config.rules[symbol]; return rules ? weightedPick(rng, rules) : symbol; }).join('');
    }
    return { sentence, config };
}
function stampLeaf(pixels, x, y, params, direction = 1) { const dy = Math.max(0, params.droop); addPixel(pixels, x, y + dy, params.outline); addPixel(pixels, x + direction, y + dy, params.leafFill); addPixel(pixels, x + direction * 2, y + dy, params.outline); addPixel(pixels, x + direction, y + dy - 1, params.highlight); }
function stampFlower(pixels, x, y, petal, outline) { addPixel(pixels, x, y - 1, outline); addPixel(pixels, x - 1, y, outline); addPixel(pixels, x, y, petal); addPixel(pixels, x + 1, y, outline); addPixel(pixels, x, y + 1, '#f7d35b'); }
function turtlePixelsFromLSystem(state, params) {
    const { sentence, config } = generateLSystem(state, params);
    const rng = createRng(state.seed ^ 0xa53c9e7d ^ params.stage * 313);
    const pixels = new Map();
    const stack = [];
    let turtle = { x: 16 + params.lean, y: 22, angle: config.startAngle + params.lean * 7, width: state.plantType === 'sapling' ? 2 : 1 };
    const stepLength = config.step * params.stepScale;
    const angleJitter = 5 + params.stage;
    if (state.plantType === 'succulent') {
        const leaves = 7 + params.stage * 3;
        for (let i = 0; i < leaves; i++) {
            const angle = (Math.PI * 2 * i) / leaves + rng() * 0.28;
            const length = 3 + params.stage + Math.floor(rng() * 3);
            const x2 = 16 + Math.cos(angle) * length;
            const y2 = 18 + Math.sin(angle) * Math.max(1.2, length * 0.55) + params.droop;
            drawPixelLine(pixels, 16, 19, x2, y2, params.outline);
            drawPixelLine(pixels, 16, 19, x2 - Math.cos(angle), y2, params.leafFill);
            addPixel(pixels, Math.round((16 + x2) / 2), Math.round((19 + y2) / 2) - 1, params.highlight);
        }
        return pixels;
    }
    for (const symbol of sentence.slice(0, 420)) {
        if (symbol === 'F') {
            const rad = turtle.angle * Math.PI / 180;
            const wind = params.lean * (0.15 + rng() * 0.1);
            const next = { x: Math.round(turtle.x + Math.cos(rad) * stepLength + wind), y: Math.round(turtle.y + Math.sin(rad) * stepLength + Math.max(0, params.droop) * 0.12) };
            drawPixelLine(pixels, turtle.x, turtle.y, next.x, next.y, params.outline, turtle.width);
            if (turtle.width > 1)
                drawPixelLine(pixels, turtle.x + 1, turtle.y, next.x + 1, next.y, params.stemFill);
            else
                addPixel(pixels, next.x, next.y, params.stemFill);
            turtle = { ...turtle, ...next };
        }
        else if (symbol === '+')
            turtle.angle += config.angle + (rng() - 0.5) * angleJitter;
        else if (symbol === '-')
            turtle.angle -= config.angle + (rng() - 0.5) * angleJitter;
        else if (symbol === '[')
            stack.push({ ...turtle, width: Math.max(1, turtle.width - 1) });
        else if (symbol === ']') {
            if (rng() > 0.25)
                stampLeaf(pixels, turtle.x, turtle.y, params, turtle.x < 16 ? -1 : 1);
            turtle = stack.pop() || turtle;
        }
        else if (symbol === 'L')
            stampLeaf(pixels, turtle.x, turtle.y, params, turtle.x < 16 ? -1 : 1);
        else if (symbol === 'B') {
            if (params.stage >= 3)
                stampFlower(pixels, turtle.x, turtle.y, state.plantType === 'blossom' ? params.highlight : '#f06ca7', params.outline);
        }
        else if (symbol === 'C') {
            addBlock(pixels, turtle.x - 1, turtle.y - 1, 3, 2, params.outline);
            addPixel(pixels, turtle.x, turtle.y - 1, params.leafFill);
            addPixel(pixels, turtle.x + 1, turtle.y - 1, params.highlight);
        }
    }
    for (let i = 0; i < state.flowerCount; i++)
        stampFlower(pixels, 10 + i * 3 + params.lean, 14 - (i % 2), params.highlight, params.outline);
    return pixels;
}
function checkRenderCompatibility(value) {
    if (!value || typeof value !== 'object')
        return { supported: false, reason: 'invalid-snapshot' };
    const receivedVersion = value.rendererVersion;
    if (receivedVersion !== exports.SUPPORTED_RENDERER_VERSION)
        return { supported: false, reason: 'unsupported-renderer-version', receivedVersion, supportedVersion: exports.SUPPORTED_RENDERER_VERSION };
    if (!(0, plant_core_1.isPlantStateSnapshot)(value))
        return { supported: false, reason: 'invalid-snapshot' };
    return { supported: true };
}
function createPlantRenderModel(snapshot) {
    const compatibility = checkRenderCompatibility(snapshot);
    if (!compatibility.supported)
        throw new Error(`Cannot render plant: ${compatibility.reason}`);
    const params = deriveGrowthParameters(snapshot);
    const pixels = turtlePixelsFromLSystem(snapshot, params);
    const preset = plant_core_1.plantTypeDefinitions[snapshot.plantType];
    return { rendererVersion: exports.SUPPORTED_RENDERER_VERSION, viewBox: '0 0 32 32', ariaLabel: `${preset.label} pixel L-system plant companion for ${snapshot.location || 'your location'}: ${snapshot.weatherSummary}`, opacity: params.opacity, pixels: Array.from(pixels.entries()).map(([key, fill]) => { const [x, y] = key.split(',').map(Number); return { x, y, fill }; }), pot: [{ x: 8, y: 21, width: 16, height: 2, fill: params.outline }, { x: 9, y: 23, width: 14, height: 1, fill: params.outline }, { x: 10, y: 24, width: 12, height: 5, fill: params.outline }, { x: 11, y: 29, width: 10, height: 1, fill: params.outline }, { x: 9, y: 21, width: 14, height: 1, fill: '#e0a14a' }, { x: 10, y: 22, width: 12, height: 1, fill: '#b86f35' }, { x: 11, y: 24, width: 10, height: 4, fill: '#b86f35' }, { x: 11, y: 24, width: 3, height: 4, fill: '#e0a14a' }, { x: 18, y: 25, width: 3, height: 3, fill: '#6b3f24' }, { x: 12, y: 29, width: 8, height: 1, fill: '#6b3f24' }] };
}
function escapeAttribute(value) { return value.replace(/[&"<>]/g, (char) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[char])); }
function rect(x, y, width, height, fill, extra = '') { return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" ${extra}/>`; }
function renderPlantSvg(snapshot) { const model = createPlantRenderModel(snapshot); return `<svg viewBox="${model.viewBox}" role="img" aria-label="${escapeAttribute(model.ariaLabel)}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" style="opacity:${model.opacity}">${model.pixels.map(p => rect(p.x, p.y, 1, 1, p.fill)).join('')}${model.pot.map(p => rect(p.x, p.y, p.width, p.height, p.fill)).join('')}</svg>`; }

}
  };
  const cache = {};
  function require(id) {
    if (cache[id]) return cache[id].exports;
    const factory = modules[id];
    if (!factory) throw new Error(`Unknown renderer module: ${id}`);
    const module = { exports: {} };
    cache[id] = module;
    factory(module, module.exports, require);
    return module.exports;
  }
  const renderer = require("packages/plant-renderer/src/index.ts");
  const core = require("packages/plant-core/src/index.ts");
  globalThis.PlantCompanionRenderer = {
    checkRenderCompatibility: renderer.checkRenderCompatibility,
    createPlantRenderModel: renderer.createPlantRenderModel,
    renderPlantSvg: renderer.renderPlantSvg,
    isPlantStateSnapshot: core.isPlantStateSnapshot,
    normalizePlantStateSnapshot: core.normalizePlantStateSnapshot,
    plantStateVersion: core.plantStateVersion,
    rendererVersion: core.rendererVersion
  };
})();
