# Phase 0: Pixel Art Plant Design System

## Art Direction

The plant companion should feel like a **cute pixel pet rendered with decorative object care**: readable at small sizes, charming before it is realistic, and detailed only where detail improves personality. The target is a compact retro sprite with a bold outline, blocky stepped geometry, selective highlights, and a constrained warm palette. It should read instantly as a friendly living companion on top of any webpage while leaving enough visual grammar for later growth, weather, health, hydration, and flowering simulation.

## Sprite Standard

| Decision | MVP Standard | Reasoning |
| --- | --- | --- |
| Logical sprite size | `32x32` pixel grid | Large enough for expression and plant variety; still compact and retro. |
| Display scale | `4x` to `5x` CSS scale | Keeps pixels readable in the overlay without redrawing the source grid. |
| Camera angle | Front-facing with a slight `3/4` pot lip | Simple silhouettes, friendly presentation, and enough depth for a pot/soil anchor. |
| Base composition | Tiny pot by default; soil patch and roots as variants | Pot gives the companion a stable, toy-like anchor on arbitrary webpages. |
| Background | Transparent | Allows the plant to sit over page content. |
| Rendering density | Medium-cute | More expressive than a 16-bit icon, less busy than a decorative scene prop. |
| Outline style | One-pixel dark outline on the logical grid | Keeps the subject readable on light and dark websites. |

## Starter Palette

Use this palette as the default renderer contract. Future themes can remap these semantic slots while preserving value contrast.

| Token | Hex | Use |
| --- | --- | --- |
| `outline` | `#24313A` | Outer silhouette, deepest creases, pot rim shadow. |
| `leaf-dark` | `#2F7D32` | Leaf shadow blocks, hidden fronds, unhealthy base tone. |
| `leaf-mid` | `#4CAF50` | Primary healthy leaf fill. |
| `leaf-light` | `#8BCF5A` | Pixel highlights and fresh new growth. |
| `leaf-pale` | `#C7E86B` | Rare sparkle pixels, seedling tips, strong hydration highlight. |
| `bark-dark` | `#6B3F24` | Trunks, root shadows, soil dark pixels. |
| `pot-mid` | `#B86F35` | Primary terracotta pot fill. |
| `pot-light` | `#E0A14A` | Pot lip and left/top highlights. |
| `flower-accent` | `#F06CA7` | Blossoms, happy-state accents. |
| `flower-light` | `#FFC0D9` | Blossom highlight pixels. |
| `dry-muted` | `#8A8F54` | Thirsty/dull leaf replacement tone. |

### Palette Rules

- Use no more than **8 colors in a single 32x32 plant sprite** unless it is a special mature/flowering variant.
- Every plant should reserve `outline` for silhouette readability.
- Highlights should be small: usually **1-3 connected pixels per leaf cluster**.
- Thirst and poor health should shift leaves toward `dry-muted` and reduce `leaf-light`, not introduce many new colors.

## Shape Language by Plant Type

| Plant type | Silhouette read | Construction rules | Personality notes |
| --- | --- | --- | --- |
| Fern | Layered triangular spread | Central base with stair-stepped fronds that widen at mid-height and taper at tips. | Soft, shy, lush. |
| Vine | Curling asymmetric line | One main climbing stem with squared tendril hooks and staggered heart/oval leaf blocks. | Curious, playful, reaching. |
| Flower | Vertical stalk with blossom focal point | Thin central stem, two or four leaves, blossom as a high-contrast pixel cluster. | Cheerful, expressive, mood-readable. |
| Bonsai | Squat trunk, sculpted canopy | Thick angled trunk, rounded block canopy masses, strong negative space under foliage. | Calm, sturdy, wise. |
| Cactus | Chunky segmented silhouette | Vertical oval/block column with side arms and sparse highlight spines. | Hardy, funny, resilient. |
| Grass tuft | Low clustered blades | Multiple triangular stepped blades from one soil point; widest at base. | Energetic, simple, humble. |

## Growth-State Visual Rules

Growth should change the silhouette first, then internal detail. A player should understand state from the outline before seeing highlights.

| State | Visual treatment |
| --- | --- |
| Seed | Pot/soil with one dark seed pixel or a two-pixel sprout nub. |
| Seedling | One 1-2 pixel stem with two tiny leaves; minimal highlights. |
| Young | Taller stem or wider spread; 2-4 leaf clusters; clear plant-type identity begins. |
| Mature | Full silhouette for the type; extra secondary leaves/fronds; stronger highlight pattern. |
| Flowering | Add `flower-accent` clusters at focal points; keep blooms small so the plant still reads as the same type. |
| Healthy | Upright posture, saturated `leaf-mid`, visible `leaf-light` highlights. |
| Thirsty | 1-2 pixel downward droop, less highlight, some `dry-muted` leaves, slightly compressed silhouette. |
| Unhealthy | More `leaf-dark`/`dry-muted`, fewer new-growth pixels, broken or missing leaf tips. |
| Windy | Whole canopy leans 1-2 grid pixels with pot/root base unchanged. |
| Resting/night | Lower contrast highlights and closed/drooped blossom pixels, but silhouette stays readable. |

## SVG Pixel Rendering Constraints

The renderer should imitate pixel art even though output is SVG.

1. Use a `viewBox="0 0 32 32"` logical grid for MVP sprites.
2. Build sprites from `<rect>` elements or stepped `<path>` commands using integer coordinates.
3. Avoid ellipses, gradients, blur, and smooth Bezier curves in the plant itself.
4. Permit only CSS drop shadows outside the sprite if needed for webpage legibility.
5. Add `shape-rendering="crispEdges"` to SVG output.
6. Scale via CSS with `image-rendering: pixelated` and fixed aspect ratio.
7. Keep the base anchored in rows `24-31`; plant silhouettes should usually occupy rows `4-27`.
8. Keep transparent background and avoid large filled backdrop shapes.
9. Favor chunky one-pixel outline runs over sub-pixel strokes.
10. Validate every generated plant at `1x`, `3x`, and final overlay scale.

## Plant Type Silhouette Sheet

Each row below describes the intended 32x32 silhouette envelope. `#` means filled silhouette, `.` means transparent space.

```text
Fern        Vine        Flower      Bonsai      Cactus      Grass
........    ........    ........    ........    ........    ........
...##...    .....#..    ....#...    ..####..    ...###..    ........
..####..    ....##..    ...###..    .######.    ...###..    ........
.######.    .....#..    ....#...    ..####..    ..#####.    ........
..####..    ...###..    ...###..    ...##...    .######.    ...#....
.######.    ..##.#..    ....#...    ..####..    ...###..    ..###...
########    ....##..    ..#####.    .######.    ...###..    .#####..
...##...    .....#..    ....#...    ...##...    ...###..    #######.
..####..    ...###..    ....#...    ..####..    .#####..    ..###...
.######.    ..##....    ...###..    .######.    .#####..    .#####..
...##...    ....#...    ....#...    ...##...    ...###..    ...#....
..####..    ...###..    ...###..    ..####..    ...###..    ..###...
########    ........    .#####..    .######.    ...###..    #######.
```

## Sample Plant Mockups

The file [`assets/phase-0/sample-plant-types.svg`](../assets/phase-0/sample-plant-types.svg) contains one crisp SVG mockup for each MVP plant type: fern, vine, flower, bonsai, cactus, and grass tuft. These are not final production sprites; they are renderer targets that demonstrate palette, silhouette, outline, pot anchoring, and stepped pixel geometry.

## MVP Acceptance Criteria

- A new plant sprite uses the `32x32` grid and transparent background.
- The plant remains readable when displayed at `128x128` CSS pixels.
- The plant uses a bold outline and no smooth plant geometry.
- Health, hydration, and growth states alter posture, silhouette density, and palette in consistent ways.
- The overall emotional read is **cute companion first, decorative pixel object second**.
