import type { GardenEnvironmentTemplate } from '../../lib/garden/environments';

/** South is authored on a four-world-pixel grid. Keep scenery coordinates and sizes on this grid. */
export const SOUTH_PIXEL_UNIT = 4;

export const SOUTH_PALETTE = {
  grass: '#708f50', grassDark: '#58763f', grassLight: '#89a75d', grassShade: '#658447',
  soil: '#765039', soilDark: '#50392d', soilLight: '#956a46', mulch: '#b07c4f',
  path: '#bea06a', pathDark: '#806846', pathLight: '#d2b87c',
  water: '#4f8583', waterDark: '#365f61', waterLight: '#82aaa0', waterShine: '#a9c5ad',
  leaf: '#41683d', leafDark: '#294d35', leafLight: '#688a4a', leafSpark: '#88a85c',
  wood: '#745038', woodDark: '#4d382e', woodLight: '#9b7048', cream: '#d8cb9b',
} as const;

type Point = { x: number; y: number };
const points = (value: readonly Point[]) => value.map(({ x, y }) => `${x},${y}`).join(' ');

const grassMarks = Array.from({ length: 55 }, (_, index) => ({
  x: 40 + ((index * 137) % 1512), y: 40 + ((index * 83) % 1112), variant: index % 4,
}));

const Tree = ({ x, y, variant = 0 }: Point & { variant?: number }) => {
  const shift = variant === 1 ? 8 : 0;
  return <g transform={`translate(${x} ${y})`}>
    <rect x={28 + shift} y="52" width="16" height="28" fill={SOUTH_PALETTE.woodDark} />
    <rect x={32 + shift} y="52" width="12" height="24" fill={SOUTH_PALETTE.wood} />
    <polygon points={points([{x:8,y:28},{x:16,y:28},{x:16,y:16},{x:28,y:16},{x:28,y:8},{x:52,y:8},{x:52,y:16},{x:64,y:16},{x:64,y:28},{x:72,y:28},{x:72,y:52},{x:64,y:52},{x:64,y:60},{x:16,y:60},{x:16,y:56},{x:4,y:56},{x:4,y:36},{x:8,y:36}])} fill={SOUTH_PALETTE.leafDark} />
    <rect x={12 + shift} y="24" width="48" height="28" fill={SOUTH_PALETTE.leaf} />
    <rect x={20 + shift} y="12" width="32" height="32" fill={variant ? '#527848' : SOUTH_PALETTE.leafLight} />
    <rect x={28 + shift} y="12" width="16" height="8" fill={SOUTH_PALETTE.leafSpark} /><rect x={52 - shift} y="32" width="8" height="8" fill={SOUTH_PALETTE.leafLight} />
  </g>;
};

const Shrub = ({ x, y }: Point) => <g transform={`translate(${x} ${y})`}>
  <rect x="4" y="16" width="52" height="24" fill={SOUTH_PALETTE.leafDark} /><rect x="12" y="8" width="36" height="28" fill={SOUTH_PALETTE.leaf} />
  <rect x="20" y="8" width="12" height="8" fill={SOUTH_PALETTE.leafLight} /><rect x="44" y="24" width="8" height="8" fill={SOUTH_PALETTE.leafLight} />
</g>;

const FlowerClump = ({ x, y, pink = false }: Point & { pink?: boolean }) => <g transform={`translate(${x} ${y})`}>
  {[4, 20, 36].map((left, index) => <g key={left}><rect x={left + 4} y={8 + index * 2} width="4" height="20" fill={SOUTH_PALETTE.leaf} /><rect x={left} y={4 + index * 2} width="12" height="8" fill={pink && index === 1 ? '#d99caf' : '#e5c764'} /><rect x={left + 4} y={index * 2} width="4" height="16" fill={pink && index === 1 ? '#e9b4c0' : '#f0d77a'} /></g>)}
</g>;

const Bed = ({ x, y, width = 336, accent = false }: Point & { width?: number; accent?: boolean }) => {
  const outline = [{x:16,y:0},{x:width-32,y:0},{x:width-32,y:8},{x:width-8,y:8},{x:width-8,y:24},{x:width,y:24},{x:width,y:144},{x:width-8,y:144},{x:width-8,y:160},{x:width-28,y:160},{x:width-28,y:168},{x:24,y:168},{x:24,y:164},{x:8,y:164},{x:8,y:152},{x:0,y:152},{x:0,y:20},{x:8,y:20},{x:8,y:8},{x:16,y:8}];
  return <g transform={`translate(${x} ${y})`}>
    <polygon points={points(outline)} fill={SOUTH_PALETTE.soilDark} />
    <polygon points={points(outline.map(({x: px,y: py}) => ({x: Math.max(8, Math.min(width - 8, px)), y: Math.max(8, Math.min(160, py))})))} fill={SOUTH_PALETTE.soil} />
    {Array.from({ length: 12 }, (_, i) => <rect key={i} x={24 + ((i * 73) % (width - 52))} y={24 + ((i * 37) % 112)} width={i % 3 === 0 ? 12 : 8} height="4" fill={i % 2 || accent ? SOUTH_PALETTE.soilLight : SOUTH_PALETTE.mulch} />)}
    <rect x="20" y="16" width={width - 48} height="4" fill={SOUTH_PALETTE.soilLight} />
  </g>;
};

const Path = ({ vertices }: { vertices: readonly Point[] }) => <g>
  <polygon points={points(vertices)} fill={SOUTH_PALETTE.pathDark} />
  <polygon points={points(vertices.map(({x,y}, i) => ({ x: x + (i < vertices.length / 2 ? 8 : -8), y })))} fill="url(#south-path-tile)" />
</g>;

const Pond = ({ x, y }: Point) => <g transform={`translate(${x} ${y})`}>
  <polygon points="24,0 164,0 164,8 196,8 196,20 216,20 216,48 228,48 228,104 216,104 216,128 192,128 192,144 44,144 44,136 16,136 16,124 4,124 4,40 12,40 12,16 24,16" fill={SOUTH_PALETTE.waterDark} />
  <polygon points="32,12 164,12 164,20 192,20 192,32 208,32 208,108 188,108 188,124 48,124 48,120 24,120 24,40 32,40" fill="url(#south-water-tile)" />
  <rect x="68" y="44" width="44" height="4" fill={SOUTH_PALETTE.waterShine} /><rect x="132" y="84" width="32" height="4" fill={SOUTH_PALETTE.waterLight} />
  <rect x="40" y="112" width="8" height="24" fill={SOUTH_PALETTE.leaf} /><rect x="200" y="96" width="8" height="28" fill={SOUTH_PALETTE.leaf} />
  <rect x="156" y="52" width="20" height="8" fill={SOUTH_PALETTE.leafLight} /><rect x="168" y="48" width="4" height="8" fill="#d7c56a" />
</g>;

const CommunityHouse = ({ x, y }: Point) => <g transform={`translate(${x} ${y})`}>
  <rect x="16" y="48" width="232" height="120" fill={SOUTH_PALETTE.woodDark} /><rect x="24" y="56" width="216" height="104" fill={SOUTH_PALETTE.cream} />
  <polygon points="0,52 0,40 16,40 16,32 40,32 40,24 72,24 72,16 104,16 104,8 136,8 136,16 168,16 168,24 200,24 200,32 232,32 232,40 256,40 256,56" fill={SOUTH_PALETTE.leafDark} />
  <rect x="24" y="44" width="216" height="8" fill={SOUTH_PALETTE.leafLight} /><rect x="104" y="100" width="48" height="60" fill={SOUTH_PALETTE.wood} /><rect x="112" y="108" width="32" height="52" fill={SOUTH_PALETTE.woodDark} />
  {[48,176].map(left => <g key={left}><rect x={left} y="84" width="40" height="36" fill={SOUTH_PALETTE.woodDark} /><rect x={left+4} y="88" width="32" height="28" fill={SOUTH_PALETTE.waterLight} /><rect x={left+16} y="88" width="4" height="28" fill={SOUTH_PALETTE.cream} /></g>)}
  {[48,80,176,208].map(left => <rect key={left} x={left} y="28" width="20" height="4" fill={SOUTH_PALETTE.leafLight} />)}
</g>;

const Shed = ({ x, y }: Point) => <g transform={`translate(${x} ${y})`}>
  <rect x="12" y="40" width="144" height="88" fill={SOUTH_PALETTE.woodDark} /><rect x="20" y="48" width="128" height="72" fill={SOUTH_PALETTE.wood} />
  <polygon points="0,44 0,32 16,32 16,24 40,24 40,16 68,16 68,8 92,8 92,16 120,16 120,24 144,24 144,32 168,32 168,48" fill={SOUTH_PALETTE.woodDark} />
  <rect x="56" y="68" width="48" height="52" fill={SOUTH_PALETTE.woodDark} /><rect x="92" y="92" width="4" height="4" fill={SOUTH_PALETTE.pathLight} /><rect x="120" y="64" width="20" height="24" fill={SOUTH_PALETTE.pathLight} />
</g>;

const Fence = ({ x, y, width }: Point & { width: number }) => <g transform={`translate(${x} ${y})`}>
  <rect x="0" y="12" width={width} height="8" fill={SOUTH_PALETTE.woodDark} /><rect x="0" y="4" width={width} height="8" fill={SOUTH_PALETTE.woodLight} />
  {Array.from({ length: Math.ceil(width / 48) }, (_, i) => <g key={i}><rect x={i*48} y="0" width="12" height="44" fill={SOUTH_PALETTE.woodDark} /><rect x={i*48+4} y="0" width="8" height="36" fill={SOUTH_PALETTE.wood} /></g>)}
</g>;

export function SouthEnvironment({ template }: { template: GardenEnvironmentTemplate }) {
  const edgeTrees = [...Array.from({ length: 15 }, (_, i) => ({ x: 8 + i * 108, y: 12 + (i % 3) * 8 })), ...Array.from({ length: 14 }, (_, i) => ({ x: 24 + i * 116, y: 1104 + (i % 2) * 8 }))];
  return <svg className="south-environment" viewBox={`0 0 ${template.world.width} ${template.world.height}`} aria-hidden="true" focusable="false" shapeRendering="crispEdges">
    <defs>
      <pattern id="south-grass-tile" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill={SOUTH_PALETTE.grass} /><rect x="4" y="8" width="4" height="8" fill={SOUTH_PALETTE.grassDark} /><rect x="20" y="24" width="8" height="4" fill={SOUTH_PALETTE.grassLight} /></pattern>
      <pattern id="south-path-tile" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill={SOUTH_PALETTE.path} /><rect x="4" y="8" width="12" height="4" fill={SOUTH_PALETTE.pathLight} /><rect x="24" y="20" width="4" height="8" fill={SOUTH_PALETTE.pathDark} /></pattern>
      <pattern id="south-water-tile" width="32" height="24" patternUnits="userSpaceOnUse"><rect width="32" height="24" fill={SOUTH_PALETTE.water} /><rect x="4" y="8" width="16" height="4" fill={SOUTH_PALETTE.waterLight} /></pattern>
    </defs>
    <rect width={template.world.width} height={template.world.height} fill="url(#south-grass-tile)" />
    {grassMarks.map((mark, index) => <g key={index} transform={`translate(${mark.x} ${mark.y})`}><rect width="4" height={mark.variant === 0 ? 12 : 8} fill={mark.variant < 2 ? SOUTH_PALETTE.grassDark : SOUTH_PALETTE.grassLight} />{mark.variant === 0 && <rect x="4" y="4" width="4" height="4" fill={SOUTH_PALETTE.grassShade} />}</g>)}

    <Path vertices={[{x:720,y:0},{x:808,y:0},{x:808,y:128},{x:784,y:128},{x:784,y:244},{x:816,y:244},{x:816,y:376},{x:848,y:376},{x:848,y:528},{x:816,y:528},{x:816,y:668},{x:760,y:668},{x:760,y:800},{x:800,y:800},{x:800,y:932},{x:840,y:932},{x:840,y:1064},{x:824,y:1064},{x:824,y:1200},{x:736,y:1200},{x:736,y:1064},{x:752,y:1064},{x:752,y:948},{x:712,y:948},{x:712,y:816},{x:672,y:816},{x:672,y:772},{x:696,y:772},{x:696,y:652},{x:728,y:652},{x:728,y:520},{x:760,y:520},{x:760,y:392},{x:728,y:392},{x:728,y:260},{x:696,y:260},{x:696,y:128},{x:720,y:128}]} />
    <Path vertices={[{x:220,y:120},{x:700,y:176},{x:700,y:236},{x:220,y:180}]} /><Path vertices={[{x:808,y:476},{x:1440,y:396},{x:1448,y:456},{x:816,y:536}]} />
    <Path vertices={[{x:152,y:916},{x:684,y:788},{x:700,y:844},{x:168,y:972}]} /><Path vertices={[{x:800,y:936},{x:1440,y:988},{x:1432,y:1044},{x:792,y:992}]} />

    <Bed x={136} y={196} width={356} /><Bed x={120} y={492} width={360} accent /><Bed x={164} y={780} width={344} />
    <Bed x={604} y={216} width={316} accent /><Bed x={864} y={544} width={312} /><Bed x={892} y={796} width={300} accent />
    <Bed x={1172} y={188} width={320} /><Bed x={1200} y={508} width={300} accent /><Bed x={1212} y={796} width={292} />

    <CommunityHouse x={584} y={36} /><Shed x={68} y={104} /><Pond x={40} y={760} />
    <Fence x={1240} y={1040} width={192} /><Fence x={1020} y={432} width={168} />
    <g transform="translate(1004 104)">{[8,104].map(left => <rect key={left} x={left} width="12" height="120" fill={SOUTH_PALETTE.woodDark} />)}{[12,56,100].map(top => <rect key={top} x="4" y={top} width="120" height="8" fill={SOUTH_PALETTE.woodLight} />)}{Array.from({length:8},(_,i)=><rect key={i} x={24+(i%2)*56} y={20+i*12} width="8" height="12" fill={i%2 ? SOUTH_PALETTE.leaf : SOUTH_PALETTE.leafLight} />)}</g>
    <g transform="translate(1372 92)"><rect x="56" y="68" width="12" height="64" fill={SOUTH_PALETTE.woodDark} /><rect width="136" height="68" fill={SOUTH_PALETTE.woodDark} /><rect x="8" y="8" width="120" height="52" fill={SOUTH_PALETTE.wood} /><text x="68" y="30" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#f0d99e">SOUTH GARDEN</text><text x="68" y="50" textAnchor="middle" fontSize="10" fill="#f0d99e">GROW TOGETHER</text></g>
    <g transform="translate(1260 1080)"><rect width="48" height="40" fill={SOUTH_PALETTE.woodDark}/><rect x="8" y="8" width="32" height="24" fill={SOUTH_PALETTE.wood}/><rect x="60" y="4" width="44" height="36" fill={SOUTH_PALETTE.woodDark}/><rect x="68" y="12" width="28" height="20" fill={SOUTH_PALETTE.woodLight}/><rect x="116" width="32" height="44" fill={SOUTH_PALETTE.woodDark}/><rect x="124" y="8" width="16" height="28" fill={SOUTH_PALETTE.mulch}/></g>

    {edgeTrees.map((tree, index) => <Tree key={index} {...tree} variant={index % 2} />)}
    {[{x:52,y:340},{x:516,y:552},{x:1048,y:264},{x:1500,y:568},{x:1136,y:1024}].map((p, i) => <Shrub key={i} {...p} />)}
    {[{x:88,y:468},{x:512,y:332},{x:1072,y:748},{x:1472,y:312},{x:472,y:1020}].map((p, i) => <FlowerClump key={i} {...p} pink={i % 2 === 1} />)}
  </svg>;
}
