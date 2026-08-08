import type { GardenEnvironmentTemplate } from '../../lib/garden/environments';

const Tree = ({ x, y, tone = 0 }: { x: number; y: number; tone?: number }) => <g transform={`translate(${x} ${y})`}>
  <rect x="24" y="48" width="18" height="28" fill="#705337" />
  <rect x="8" y="20" width="50" height="38" fill={tone ? '#527a43' : '#416c3d'} />
  <rect x="18" y="8" width="34" height="40" fill={tone ? '#699052' : '#588548'} />
  <rect x="4" y="32" width="18" height="16" fill="#345d38" />
  <rect x="28" y="14" width="9" height="9" fill="#84a85e" />
</g>;

const Fence = ({ x, y, width }: { x: number; y: number; width: number }) => <g transform={`translate(${x} ${y})`} fill="#9a7048">
  <rect y="7" width={width} height="8" /><rect y="28" width={width} height="8" />
  {Array.from({ length: Math.ceil(width / 42) }, (_, index) => <rect key={index} x={index * 42} width="9" height="44" fill="#765238" />)}
</g>;

function PlantingDistrict({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <rect width={width} height={height} rx="42" fill="#789452" />
    <rect x="20" y="20" width={width - 40} height={height - 40} rx="32" fill="#866044" />
    {Array.from({ length: 8 }, (_, row) => <g key={row}>
      <rect x="34" y={42 + row * 102} width={width - 68} height="67" rx="25" fill="#745139" />
      <path d={`M45 ${71 + row * 102} H${width - 45}`} stroke="#9b7450" strokeWidth="4" strokeDasharray="9 13" />
    </g>)}
  </g>;
}

export function SouthEnvironment({ template }: { template: GardenEnvironmentTemplate }) {
  const edgeTrees = [...Array.from({ length: 15 }, (_, i) => ({ x: 18 + i * 108, y: 25 + (i % 3) * 7 })), ...Array.from({ length: 14 }, (_, i) => ({ x: 30 + i * 116, y: 1090 + (i % 2) * 8 }))];
  return <svg className="south-environment" viewBox={`0 0 ${template.world.width} ${template.world.height}`} aria-hidden="true" focusable="false" shapeRendering="crispEdges">
    <defs>
      <pattern id="south-grass" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#789b58" /><rect x="5" y="7" width="3" height="7" fill="#668b4d" /><rect x="24" y="22" width="5" height="3" fill="#87a967" /></pattern>
      <pattern id="south-water" width="28" height="18" patternUnits="userSpaceOnUse"><rect width="28" height="18" fill="#6fa6a0" /><rect x="3" y="5" width="12" height="3" fill="#91beb1" /></pattern>
    </defs>
    <rect width="1600" height="1200" fill="url(#south-grass)" />
    <PlantingDistrict x={170} y={210} width={350} height={875} />
    <PlantingDistrict x={650} y={220} width={350} height={875} />
    <PlantingDistrict x={1095} y={195} width={350} height={875} />
    <path d="M575 0 C548 180 610 290 570 430 S548 720 596 825 S550 1050 580 1200" fill="none" stroke="#b38a5c" strokeWidth="82" />
    <path d="M0 165 C245 200 430 135 575 185 S940 175 1080 160 S1390 205 1600 158" fill="none" stroke="#b38a5c" strokeWidth="62" />
    <g transform="translate(610 65)"><rect width="280" height="150" rx="8" fill="#d6d6a7" stroke="#526a4e" strokeWidth="10" /><path d="M25 75 L140 12 255 75" fill="#9fc0a2" stroke="#526a4e" strokeWidth="10" /><rect x="118" y="76" width="50" height="74" fill="#789e86" /><rect x="25" y="82" width="65" height="40" fill="#a9cac0" /><rect x="190" y="82" width="65" height="40" fill="#a9cac0" /><text x="140" y="53" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#3e5944">COMMON HOUSE</text></g>
    <g transform="translate(72 105)"><rect x="15" y="40" width="150" height="85" fill="#76523d" /><path d="M0 45 L90 0 180 45" fill="#594337" /><rect x="67" y="70" width="48" height="55" fill="#4d382e" /><rect x="128" y="82" width="25" height="28" fill="#9d7650" /><circle cx="28" cy="128" r="22" fill="#75513d" /><circle cx="28" cy="128" r="12" fill="#9d7650" /></g>
    <g transform="translate(1340 84)"><rect x="12" y="18" width="120" height="70" fill="#79563b" /><rect x="68" y="88" width="8" height="48" fill="#63432f" /><path d="M0 18 H144 L126 0 H18Z" fill="#5e4832" /><text x="72" y="47" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#f0d49c">SOUTH GARDEN</text><text x="72" y="67" textAnchor="middle" fontSize="12" fill="#f0d49c">GROW TOGETHER</text></g>
    <g transform="translate(90 865)"><ellipse cx="95" cy="86" rx="88" ry="68" fill="#59794f" /><ellipse cx="95" cy="82" rx="72" ry="54" fill="url(#south-water)" /><rect x="178" y="60" width="120" height="14" fill="#795638" /><rect x="190" y="38" width="10" height="62" fill="#60442f" /><rect x="276" y="38" width="10" height="62" fill="#60442f" /></g>
    <g transform="translate(1260 890)" fill="#76533a"><rect width="145" height="14" /><rect x="14" y="14" width="12" height="45" /><rect x="119" y="14" width="12" height="45" /><rect x="28" y="66" width="42" height="36" fill="#946743" /><rect x="76" y="56" width="52" height="46" fill="#a2764e" /></g>
    <Fence x={70} y={82} width={470} /><Fence x={1000} y={82} width={320} />
    {edgeTrees.map((tree, index) => <Tree key={index} {...tree} tone={index % 2} />)}
    <g fill="#d7c067">{[[560,330],[1045,355],[570,730],[1032,850],[1490,650]].map(([x,y], i) => <g key={i} transform={`translate(${x} ${y})`}><rect x="7" y="5" width="4" height="18" fill="#577342" /><rect width="9" height="9" /><rect x="10" y="2" width="9" height="9" fill="#d99b73" /></g>)}</g>
  </svg>;
}
