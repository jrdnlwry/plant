# Plant Lifecycle Design

This guide defines believable visual milestone ordering for each plant category. The core rule is that the renderer should ask: **given this plant type and current maturity, what is the next believable thing it could grow?** Weather can accelerate, slow, stress, or polish that milestone, but it should not skip structure.

## Universal sequencing rules

Use the seven-stage model as a design vocabulary even if the saved state uses fewer numeric stages today.

| Stage | Purpose | Generic visual intent |
| --- | --- | --- |
| 0 | Dormant / Seed | Seed, bulb, nub, resting crown, bare node, or empty pot surface. |
| 1 | Emergence | First sprout, fiddlehead, tiny rosette, root node, or primary shoot. |
| 2 | Structure | Stem, trunk, crown, rhizome, main vine, or first stable axis. |
| 3 | Expansion | Branches, frond arms, new leaf layers, vine length, or side shoots. |
| 4 | Foliage / Density | Leaves, canopy mass, frond density, plump rosette, or repeated vine nodes. |
| 5 | Maturity | Full silhouette with stable structure and healthy density. |
| 6 | Flourish / Rare Reward | Flowers, fruit, berries, spores, pups, dew, glow, rare colors, or other rewards. |

Practical gating principles:

- Do not let flowers, fruit, berries, spores, glow, rare mutations, or decorative flourishes appear before the plant has the structural features that make them plausible.
- Weather may affect color, hydration, droop, density, and growth speed; weather should not independently create a flower on an immature plant.
- Stress should usually pause or regress decorative rewards before it removes the plant's core identity.
- Recovery should show restored posture and color before brand-new reward features appear.

## Visual lifecycle examples

A companion contact sheet is available at [`assets/lifecycle-stage-examples.svg`](../assets/lifecycle-stage-examples.svg). It shows example pixel-art silhouettes for all seven lifecycle stages across sapling, fern, succulent, blossom, and vine plants. Use it as a visual reference for milestone gating: each row keeps late rewards such as fruit, spores, pups, blooms, and berries out of the early structure-building stages.

## Sapling

A sapling should read as a young tree: sprout, trunk, branches, leaves, then canopy. Flowers or fruit are rare late-stage bonuses, not the normal reward loop.

### Lifecycle

- **Early-stage growth:** Seed crack, tiny green shoot, and a short upright stem. Keep the silhouette simple and low.
- **Mid-stage growth:** Thicker central stem becomes a visible trunk. Add one or two small branch nubs before broad leaves.
- **Mature-stage growth:** Multiple branches support leaf clusters. The canopy begins to read as a young tree rather than a generic sprout.
- **Late-stage flourish / reward features:** Small canopy highlights, seasonal blossom dots, tiny fruit, bark texture, bird-safe sparkle/dew, or a rare leaf color mutation. These should be subtle and uncommon.
- **Stress / dormancy behavior:** Leaves droop, shrink, desaturate, or fall back to sparse branch tips. Trunk remains visible. Avoid producing flowers during stress.
- **Recovery behavior:** Restore trunk posture and leaf color first, then add lost leaf clusters, then allow late seasonal rewards only after the canopy is healthy again.

### Gate until later

- Flowers, fruit, strong canopy glow, rare leaf mutations, decorative sparkles, and dense canopy clusters.
- Fruit should require trunk + branches + healthy leaf canopy.
- Flowers should require branches and enough leaf mass to make a flowering tree believable.

### Healthy progress before rewards

A healthy sapling should first show a taller trunk, branch separation, and a wider green canopy. If it does not yet have branches and leaves, it should not flower.

### Feature progression map

```text
seed/nub -> sprout -> thin stem -> trunk -> branch nubs -> small leaves -> leaf clusters -> canopy mass -> bark/detail -> rare flower/fruit
```

## Fern

A fern should focus on fiddleheads, unfurling fronds, arching fronds, and dense lush foliage. Flower-like visuals should generally be avoided.

### Lifecycle

- **Early-stage growth:** Small crown or rhizome point with one curled fiddlehead.
- **Mid-stage growth:** Fiddleheads unfurl into one or two simple fronds. Add visible ribs before adding many leaflets.
- **Mature-stage growth:** Several arching fronds with repeated leaflets. Density, symmetry variation, and overlapping fronds create the payoff.
- **Late-stage flourish / reward features:** Dew beads, spores on undersides, fresh fiddleheads near the crown, lush highlights, or a rare variegated frond. Spores should read as dots on fronds, not flowers.
- **Stress / dormancy behavior:** Fronds curl inward, droop, fade olive, or lose leaflet density. The crown remains alive but compact.
- **Recovery behavior:** Existing fronds regain color and lift first. Then new fiddleheads appear, then density returns.

### Gate until later

- Spores, dew clusters, rare variegation, glow, and extra fiddlehead bursts.
- Flower-shaped modules should not be part of the fern reward loop.

### Healthy progress before rewards

A healthy fern should show more fronds, wider arching reach, and denser leaflets before it gets spores or dew. The visual reward is lushness, not blossoms.

### Feature progression map

```text
crown -> curled fiddlehead -> unfurling frond -> frond ribs -> leaflets -> multiple fronds -> dense overlap -> dew/spores/new fiddleheads
```

## Succulent

A succulent should grow slowly, geometrically, and satisfyingly. The main reward is thickness, symmetry, and fullness.

### Lifecycle

- **Early-stage growth:** Tiny central rosette with a few thick leaves.
- **Mid-stage growth:** Add a second ring of plump leaves. Leaves widen more than they lengthen.
- **Mature-stage growth:** Full rosette with layered geometry, balanced offsets, and hydrated highlights.
- **Late-stage flourish / reward features:** Pups around the base, cluster offsets, a rare flower stalk, blush coloration, farina highlights, or tiny dew.
- **Stress / dormancy behavior:** Growth slows strongly. Leaves desaturate, wrinkle, flatten, or tuck inward. Avoid rapid leaf loss unless severe.
- **Recovery behavior:** Restore plumpness and color first, then add new inner leaves, then allow pups or a flower stalk only after sustained health.

### Gate until later

- Pups, side clusters, flower stalks, rare color blush, sparkles, and bloom flowers.
- Flower stalk requires a full rosette and should be occasional, not guaranteed.

### Healthy progress before rewards

A healthy succulent should get fuller, thicker, and more layered. Users should see rosette geometry complete before pups or a bloom stalk appears.

### Feature progression map

```text
tiny rosette -> inner leaves -> second leaf ring -> thicker leaves -> fuller symmetry -> plump highlights -> pups/cluster -> rare flower stalk
```

## Blossom

A blossom plant can focus on flowers, but it still needs visible buildup. The flower is the climax of a stem-and-bud sequence.

### Lifecycle

- **Early-stage growth:** Seed, sprout, and a delicate stem.
- **Mid-stage growth:** Add leaves and supporting side stems. Keep the flower absent.
- **Mature-stage growth:** Add closed buds, then swollen buds. Buds should visibly precede open petals.
- **Late-stage flourish / reward features:** Open blooms, additional bloom colors, scent/sparkle marks, pollen dots, or rare double petals.
- **Stress / dormancy behavior:** Buds stay closed, blooms wilt or drop first, leaves droop, and stem color dulls.
- **Recovery behavior:** Leaves perk up first, closed buds return, swollen buds appear, then blooms reopen.

### Gate until later

- Open blooms, pollen, sparkle, rare petal forms, seed pods, and fruit-like decorations.
- Even for blossom plants, blooms require stems, leaves, and buds first.

### Healthy progress before rewards

A healthy blossom should show an upright stem, leaves, and at least one closed or swollen bud before any flower opens.

### Feature progression map

```text
seed -> sprout -> stem -> leaves -> side stem -> closed bud -> swollen bud -> bloom -> bloom cluster/rare petal
```

## Vine

A vine should spread procedurally. Its payoff is path, attachment, nodes, leaves, and later small rewards along the path.

### Lifecycle

- **Early-stage growth:** Root node and short tendril.
- **Mid-stage growth:** Main vine lengthens and bends. Add anchor nodes before leaves become dense.
- **Mature-stage growth:** Repeated nodes, leaves at nodes, and side tendrils. The vine should feel established and directional.
- **Late-stage flourish / reward features:** Flowers, berries, fruit, thorns, glowing nodes, tendril curls, or rare color changes.
- **Stress / dormancy behavior:** Tip growth pauses, leaves curl, internodes look bare, and decorative rewards drop or dim.
- **Recovery behavior:** Main vine color and turgor return, then node leaves refill, then side tendrils resume, then flowers or berries can return.

### Gate until later

- Berries, fruit, flowers, thorns, glowing nodes, and rare tendril ornaments.
- Berries require established nodes and leaves. Flowers require side growth or mature nodes.

### Healthy progress before rewards

A healthy vine should first show length, directional spread, nodes, and leaves. It should not produce berries on a bare tendril.

### Feature progression map

```text
root node -> short tendril -> main vine -> bend/anchor -> nodes -> node leaves -> side tendrils -> dense path -> flowers/berries/thorns/glow
```

## Avoiding weird sequencing in code

Treat every visual module as having prerequisites. Good low-friction checks include:

- `flower` requires `hasStem && hasLeaves && hasBudHistory && maturity >= blossomBloomStage`.
- `fruit` requires `hasBranchesOrNodes && leafDensity >= matureDensity && maturity >= fruitStage`.
- `berry` requires `nodeCount >= matureNodeCount && leafCount >= matureLeafCount`.
- `fernSpores` requires `frondCount >= matureFrondCount`; never reuse generic flower shapes for fern rewards.
- `succulentPup` requires `rosetteRingCount >= matureRingCount && health >= healthyThreshold`.
- `rareGlow` requires mature structure and good health, and should disappear during stress.

When a weather event creates a reward opportunity, route it through lifecycle gates first:

```text
weather bonus -> growth progress -> lifecycle milestone eligibility -> optional flourish roll
```

Do not route it as:

```text
weather bonus -> immediate flower/fruit
```
