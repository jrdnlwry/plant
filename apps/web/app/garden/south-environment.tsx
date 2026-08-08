import type { GardenEnvironmentTemplate } from '../../lib/garden/environments';

const Tree = ({ x, y, tone = 0 }: { x: number; y: number; tone?: number }) => <g transform={`translate(${x} ${y})`}>
  <rect x="27" y="49" width="14" height="28" fill="#61442f" /><rect x="11" y="27" width="50" height="35" fill="#315b3b" />
  <rect x="19" y="13" width="43" height="39" fill={tone ? '#4f7b45' : '#426f41'} /><rect x="4" y="35" width="28" height="20" fill="#39643d" />
  <rect x="29" y="9" width="21" height="16" fill={tone ? '#729553' : '#638c4d'} /><rect x="37" y="17" width="8" height="7" fill="#8caf62" />
</g>;

const FlowerClump = ({ x, y, colors = ['#f3cd67', '#e98d77'] }: { x: number; y: number; colors?: string[] }) => <g transform={`translate(${x} ${y})`}>
  <rect x="8" y="9" width="3" height="16" fill="#3f713e" /><rect x="22" y="5" width="3" height="20" fill="#4c7b43" /><rect x="34" y="12" width="3" height="14" fill="#3f713e" />
  <rect x="3" y="5" width="11" height="9" fill={colors[0]} /><rect x="18" width="12" height="10" fill={colors[1]} /><rect x="30" y="7" width="12" height="10" fill={colors[0]} />
</g>;

const Shrub = ({ x, y }: { x: number; y: number }) => <g transform={`translate(${x} ${y})`}>
  <rect x="5" y="12" width="45" height="30" fill="#315e3c" /><rect x="13" y="4" width="29" height="33" fill="#4d7c46" />
  <rect x="20" y="9" width="8" height="7" fill="#76a05a" /><rect x="39" y="23" width="7" height="7" fill="#79a55d" />
</g>;

const Bed = ({ d, accent = false }: { d: string; accent?: boolean }) => <g>
  <path d={d} fill="#6d4934" stroke="#4f703f" strokeWidth="18" strokeLinejoin="round" />
  <path d={d} fill="none" stroke={accent ? '#a97b50' : '#8d6343'} strokeWidth="7" strokeDasharray="7 12" strokeLinejoin="round" />
</g>;

export function SouthEnvironment({ template }: { template: GardenEnvironmentTemplate }) {
  const edgeTrees = [...Array.from({ length: 15 }, (_, i) => ({ x: 8 + i * 108, y: 18 + (i % 3) * 8 })), ...Array.from({ length: 14 }, (_, i) => ({ x: 24 + i * 116, y: 1105 + (i % 2) * 8 }))];
  return <svg className="south-environment" viewBox={`0 0 ${template.world.width} ${template.world.height}`} aria-hidden="true" focusable="false" shapeRendering="crispEdges">
    <defs>
      <pattern id="south-grass" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#769955" /><rect x="5" y="7" width="4" height="8" fill="#638548" /><rect x="27" y="29" width="7" height="3" fill="#8cab64" /><rect x="34" y="10" width="3" height="5" fill="#527943" /></pattern>
      <pattern id="south-path" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#c6a267" /><rect x="3" y="4" width="6" height="3" fill="#d8b878" /><rect x="17" y="16" width="4" height="3" fill="#aa8556" /></pattern>
      <pattern id="south-water" width="28" height="18" patternUnits="userSpaceOnUse"><rect width="28" height="18" fill="#5d9694" /><rect x="3" y="5" width="13" height="3" fill="#8fc1ae" /></pattern>
    </defs>
    <rect width="1600" height="1200" fill="url(#south-grass)" />

    {/* A single meandering spine connects small garden rooms instead of dividing crop lanes. */}
    <path d="M760 0 C750 135 690 185 720 290 C760 410 855 430 812 560 C775 675 660 700 720 805 C790 920 850 1030 805 1200" fill="none" stroke="#80633f" strokeWidth="102" />
    <path d="M760 0 C750 135 690 185 720 290 C760 410 855 430 812 560 C775 675 660 700 720 805 C790 920 850 1030 805 1200" fill="none" stroke="url(#south-path)" strokeWidth="82" />
    <path d="M710 205 C535 155 375 185 230 150 M815 520 C1000 470 1195 505 1435 425 M700 805 C510 850 340 850 160 945 M790 965 C1015 985 1215 930 1430 1015" fill="none" stroke="#80633f" strokeWidth="60" />
    <path d="M710 205 C535 155 375 185 230 150 M815 520 C1000 470 1195 505 1435 425 M700 805 C510 850 340 850 160 945 M790 965 C1015 985 1215 930 1430 1015" fill="none" stroke="url(#south-path)" strokeWidth="44" />

    {/* Irregular, mixed beds follow the deterministic anchor districts. */}
    <Bed d="M145 210 Q235 175 360 210 L480 285 Q500 380 430 445 L255 430 Q145 375 145 210Z" />
    <Bed d="M125 515 Q230 455 395 490 Q500 550 465 665 Q390 740 245 705 Q120 650 125 515Z" accent />
    <Bed d="M175 785 Q300 740 455 790 L500 905 Q415 970 260 940 Q165 900 175 785Z" />
    <Bed d="M620 225 Q710 180 870 225 Q945 300 900 395 Q795 440 655 390 Q590 325 620 225Z" accent />
    <Bed d="M875 555 Q1010 495 1145 545 Q1200 640 1140 735 Q1000 780 885 710 Q840 635 875 555Z" />
    <Bed d="M900 800 Q1020 740 1160 795 Q1225 875 1170 965 Q1025 1015 910 945 Q860 875 900 800Z" accent />
    <Bed d="M1190 190 Q1325 150 1460 220 Q1500 315 1430 390 Q1290 425 1185 355 Q1145 270 1190 190Z" />
    <Bed d="M1215 500 Q1350 455 1480 535 L1470 700 Q1355 760 1225 690 Q1175 605 1215 500Z" accent />
    <Bed d="M1230 790 Q1350 745 1480 825 L1455 955 Q1335 1005 1225 935 Q1185 855 1230 790Z" />

    {/* Community landmarks and habitat corners give each part of the map a purpose. */}
    <g transform="translate(585 45)"><rect x="20" y="45" width="210" height="112" fill="#d7c999" stroke="#4d6948" strokeWidth="9" /><path d="M0 52 L125 0 250 52" fill="#58734e" /><rect x="99" y="94" width="50" height="63" fill="#6f8f79" /><rect x="38" y="79" width="42" height="35" fill="#91b9ae" /><rect x="170" y="79" width="42" height="35" fill="#91b9ae" /></g>
    <g transform="translate(75 115)"><rect x="14" y="34" width="130" height="76" fill="#76513a" /><path d="M0 36 L78 0 158 36" fill="#504234" /><rect x="58" y="65" width="40" height="45" fill="#49372d" /><rect x="115" y="69" width="20" height="26" fill="#b08a58" /></g>
    <g transform="translate(1370 92)"><rect x="59" y="67" width="9" height="60" fill="#65462f" /><rect width="130" height="73" fill="#79563b" stroke="#543d2e" strokeWidth="7" /><text x="65" y="30" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#f4d99d">SOUTH GARDEN</text><text x="65" y="52" textAnchor="middle" fontSize="11" fill="#f4d99d">GROW TOGETHER</text></g>
    <g transform="translate(45 760)"><path d="M10 95 Q20 20 115 10 Q205 20 215 95 Q180 165 105 158 Q25 155 10 95Z" fill="#416f54" /><path d="M30 92 Q40 38 112 30 Q175 35 192 91 Q165 135 108 132 Q50 132 30 92Z" fill="url(#south-water)" /><rect x="27" y="65" width="10" height="30" fill="#4d793e" /><rect x="187" y="74" width="9" height="30" fill="#4d793e" /><rect x="100" y="30" width="18" height="5" fill="#b5d8b0" /></g>
    <g transform="translate(1260 1020)" fill="#6e4c35"><rect width="145" height="13" /><rect x="14" y="13" width="12" height="43" /><rect x="119" y="13" width="12" height="43" /><rect x="24" y="62" width="43" height="38" fill="#8d613f" /><rect x="74" y="54" width="53" height="46" fill="#a47748" /></g>
    <g transform="translate(1005 105)"><rect x="10" width="10" height="115" fill="#76523a" /><rect x="105" width="10" height="115" fill="#76523a" /><rect x="5" y="12" width="115" height="8" fill="#9b734a" /><rect x="5" y="54" width="115" height="8" fill="#9b734a" /><rect x="5" y="96" width="115" height="8" fill="#9b734a" /><path d="M18 4 Q45 35 30 105 M108 3 Q75 34 90 108" fill="none" stroke="#3e713f" strokeWidth="8" /></g>
    <g transform="translate(1040 430)" fill="#714d35"><rect width="135" height="15" /><rect x="10" y="15" width="12" height="38" /><rect x="112" y="15" width="12" height="38" /></g>

    {edgeTrees.map((tree, index) => <Tree key={index} {...tree} tone={index % 2} />)}
    {[{x:55,y:340},{x:510,y:555},{x:1045,y:260},{x:1500,y:570},{x:1135,y:1025}].map((p, i) => <Shrub key={i} {...p} />)}
    {[{x:90,y:470},{x:510,y:330},{x:1070,y:750},{x:1470,y:310},{x:470,y:1020}].map((p, i) => <FlowerClump key={i} {...p} colors={i % 2 ? ['#e7b9d0','#f0ce64'] : undefined} />)}
  </svg>;
}
