/**
 * SettlementMap: the map of a village, town or city you have entered on a
 * Wander journey. Same parchment-and-ink style as the wilderness map. Each
 * district is a hex with a few inked buildings; towns and cities are walled,
 * villages fenced. Walk to a neighbouring district to see what's there.
 */
import { useMemo, useState, type ReactNode } from "react";
import { hexDistance, hexHash, type WanderTerrain } from "@shared/wander/terrain";
import { DISTRICT_INFO, type District, type DistrictKind, type SettlementKind } from "@shared/wander/sites";
import { CompassRose, INK, ROUTE, WASH, hexPoints } from "./WanderHexMap";

export interface SettlementViewData {
  key: string;
  q: number;
  r: number;
  name: string;
  kind: SettlementKind;
  flavor: WanderTerrain;
  glyph: string;
  home?: boolean;
  at: { q: number; r: number };
  districts: District[];
}

const SIZE = 30;

/** What each district offers, in a line, for the hover card. */
export const DISTRICT_HINT: Partial<Record<DistrictKind, string>> = {
  gate: "The way back out into the wilds",
  square: "News, performers and passers-by",
  tavern: "Ale, road rumors, and the odd brawl",
  inn: "A room for the night (5 sp) and rations",
  temple: "Healing (10 gp) and quiet prayer",
  market: "Rations, curios, and quick fingers",
  smithy: "Honest work and talk of the road",
  notice: "Jobs and warnings",
  well: "Free water and neighborhood gossip",
  homes: "Ordinary folk, and their troubles",
  stables: "Caravan work and travelers",
  guild: "Contracts for capable hands",
  library: "Old chronicles of the region",
  noble: "Wealth, errands and etiquette",
  slums: "Cheap, crowded and not always safe",
  keep: "The watch, and work for swords",
  docks: "Ships, sailors and smugglers",
  fishmarket: "Fish, nets and sea stories",
  forge: "The deep forge, and work at the bellows",
  mine: "The mine head, and miners' news",
  caravanserai: "Caravans from far away",
  cistern: "Cool water in the heat",
  ferry: "The ferryman knows every channel",
  boardwalk: "Mind the rotten boards",
  lumberyard: "Woodcutters and hunters",
  lodge: "Hunters' tales of the wild",
  fields: "Farm work and open sky",
};

const GROUND: Partial<Record<DistrictKind, string>> = {
  fields: "#cdd49a", docks: "#93bccb", fishmarket: "#a9c6cf", ferry: "#a3b292", boardwalk: "#a3b292",
  lumberyard: "#93ad72", lodge: "#93ad72", mine: "#c4ad86", forge: "#c9a27e", caravanserai: "#e8cf93", cistern: "#e8cf93",
  noble: "#e2d7b4", slums: "#bfae8c", keep: "#cbbd9c", temple: "#e6dcc0",
};

function rand(seed: number) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A few small inked buildings, with a special shape for some districts. */
function Buildings({ d, seed }: { d: District; seed: number }) {
  const rnd = rand(seed);
  const house = (x: number, y: number, w: number, h: number, roof = "#9c4f2e", key: string) => (
    <g key={key}>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill="#ead8b0" stroke={INK} strokeWidth={0.6} />
      <path d={`M${x - w / 2 - 1},${y - h / 2} L${x},${y - h / 2 - h * 0.8} L${x + w / 2 + 1},${y - h / 2} Z`} fill={roof} stroke={INK} strokeWidth={0.6} strokeLinejoin="round" />
    </g>
  );
  switch (d.kind) {
    case "temple":
      return (
        <g>
          <rect x={-7} y={-2} width={14} height={9} fill="#f1e6c8" stroke={INK} strokeWidth={0.7} />
          <path d="M-8.5,-2 L0,-8 L8.5,-2 Z" fill="#7a8fa3" stroke={INK} strokeWidth={0.7} />
          <path d="M0,-8 L0,-15 M-2,-12.5 L2,-12.5" stroke={INK} strokeWidth={0.9} />
        </g>
      );
    case "keep":
      return (
        <g>
          <rect x={-6} y={-12} width={12} height={19} fill="#d9cba6" stroke={INK} strokeWidth={0.8} />
          <path d="M-6,-12 v-2.5 h2.4 v2.5 h2.4 v-2.5 h2.4 v2.5 h2.4 v-2.5 h2.4 v2.5" fill="none" stroke={INK} strokeWidth={0.7} />
          <path d="M-1.5,7 v-4 a1.5,1.5 0 0 1 3,0 v4" fill={INK} />
        </g>
      );
    case "fields":
      return (
        <g stroke={INK} strokeWidth={0.5} opacity={0.75}>
          {[-9, -5, -1, 3, 7].map((y) => <line key={y} x1={-13} y1={y} x2={13} y2={y - 3} />)}
          {house(9, -7, 6, 4, "#b3863a", "h")}
        </g>
      );
    case "docks":
    case "ferry":
      return (
        <g>
          <path d="M-12,4 q3,-2 6,0 t6,0 t6,0 t6,0" fill="none" stroke="#2f5f78" strokeWidth={0.7} />
          <rect x={-2} y={-10} width={4} height={18} fill="#b08a5a" stroke={INK} strokeWidth={0.6} />
          <path d="M6,-4 L12,-4 L10,0 L7,0 Z" fill="#b08a5a" stroke={INK} strokeWidth={0.6} />
          <line x1={9} y1={-4} x2={9} y2={-12} stroke={INK} strokeWidth={0.6} />
          <path d="M9,-12 L13,-6 L9,-6 Z" fill="#efe3c2" stroke={INK} strokeWidth={0.5} />
        </g>
      );
    case "well":
    case "cistern":
    case "square":
      return (
        <g>
          <ellipse cx={0} cy={1} rx={6} ry={3.5} fill="#93bccb" stroke={INK} strokeWidth={0.7} />
          {house(-11, -6, 6, 4, "#9c4f2e", "a")}
          {house(11, -5, 6, 4, "#7d5b3a", "b")}
        </g>
      );
    case "market":
    case "fishmarket":
    case "caravanserai":
      return (
        <g>
          {[-8, 0, 8].map((x, i) => (
            <g key={x}>
              <path d={`M${x - 3.5},${-2 + i % 2} L${x + 3.5},${-2 + i % 2} L${x + 2.5},${-5 + i % 2} L${x - 2.5},${-5 + i % 2} Z`} fill={i % 2 ? "#c9583a" : "#e2c34a"} stroke={INK} strokeWidth={0.5} />
              <line x1={x - 3} y1={-2 + i % 2} x2={x - 3} y2={3 + i % 2} stroke={INK} strokeWidth={0.5} />
              <line x1={x + 3} y1={-2 + i % 2} x2={x + 3} y2={3 + i % 2} stroke={INK} strokeWidth={0.5} />
            </g>
          ))}
        </g>
      );
    default: {
      const n = d.kind === "homes" || d.kind === "slums" ? 4 : 3;
      const roofs = d.kind === "slums" ? ["#7d6b52", "#8a7a5a"] : d.kind === "noble" ? ["#4d6b8a", "#6b4d8a"] : ["#9c4f2e", "#7d5b3a", "#a8663a"];
      const out = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd();
        const dist = 6 + rnd() * 4;
        const w = d.kind === "noble" ? 8 : 6 + rnd() * 2;
        out.push({ x: Math.cos(a) * dist, y: Math.sin(a) * dist * 0.7, w, h: w * 0.65, roof: roofs[i % roofs.length], k: `${i}` });
      }
      return <g>{out.sort((a, b) => a.y - b.y).map((b) => house(b.x, b.y, b.w, b.h, b.roof, b.k))}</g>;
    }
  }
}

/** Edge i of a pointy-top hex faces this neighbour. */
const EDGE_DIR = [
  { dq: 1, dr: 0 }, { dq: 0, dr: 1 }, { dq: -1, dr: 1 }, { dq: -1, dr: 0 }, { dq: 0, dr: -1 }, { dq: 1, dr: -1 },
];

function corner(cx: number, cy: number, i: number, s = SIZE) {
  const a = (Math.PI / 3) * i - Math.PI / 6;
  return { x: cx + s * Math.cos(a), y: cy + s * Math.sin(a) };
}

function px(q: number, r: number) {
  return { x: SIZE * Math.sqrt(3) * (q + r / 2), y: SIZE * 1.5 * r };
}

interface Props {
  view: SettlementViewData;
  canMove: boolean;
  onMove: (q: number, r: number) => void;
  children?: ReactNode;
}

export function SettlementMap({ view, canMove, onMove, children }: Props) {
  const [hover, setHover] = useState<District | null>(null);
  const cells = useMemo(() => new Set(view.districts.map((d) => `${d.q},${d.r}`)), [view.districts]);
  const radius = Math.max(...view.districts.map((d) => hexDistance(0, 0, d.q, d.r)));
  const span = SIZE * Math.sqrt(3) * (radius + 1.2);
  const vb = { x: -span, y: -span * 0.92, w: span * 2, h: span * 1.84 };
  const walled = view.kind !== "village";
  const seed = hexHash(view.q, view.r, 77);

  // The boundary: every edge of a district hex that has no district beyond it.
  const boundary: string[] = [];
  for (const d of view.districts) {
    const c = px(d.q, d.r);
    EDGE_DIR.forEach((dir, i) => {
      if (cells.has(`${d.q + dir.dq},${d.r + dir.dr}`)) return;
      const a = corner(c.x, c.y, i), b = corner(c.x, c.y, (i + 1) % 6);
      boundary.push(`M${a.x.toFixed(1)},${a.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)}`);
    });
  }

  const here = view.at;
  const at = px(here.q, here.r);
  const info = hover ? { title: hover.name, line: DISTRICT_HINT[hover.kind] ?? "" } : null;

  return (
    <div className="relative h-[400px] md:h-[500px] rounded-lg overflow-hidden border-[3px] border-[#5a3e22] shadow-[inset_0_0_40px_rgba(60,35,10,0.55)] bg-[#e9dbb5]" data-testid="settlement-map">
      <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="w-full h-full select-none" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Map of ${view.name}`}>
        <defs>
          <filter id="sm-paper" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} seed={6} result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.33  0 0 0 0 0.18  0 0 0 0.16 0" />
          </filter>
          <filter id="sm-wash" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves={2} seed={3} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={3} />
          </filter>
        </defs>
        <rect x={vb.x - vb.w} y={vb.y - vb.h} width={vb.w * 3} height={vb.h * 3} fill="#ecdfbd" />
        <rect x={vb.x - vb.w} y={vb.y - vb.h} width={vb.w * 3} height={vb.h * 3} filter="url(#sm-paper)" />

        {/* surrounding country */}
        <g filter="url(#sm-wash)" opacity={0.55}>
          <circle cx={0} cy={0} r={span * 0.98} fill={WASH[view.flavor]} />
        </g>

        {/* districts */}
        <g filter="url(#sm-wash)">
          {view.districts.map((d) => {
            const c = px(d.q, d.r);
            return <polygon key={`g${d.q},${d.r}`} points={hexPoints(c.x, c.y, SIZE * 0.98)} fill={GROUND[d.kind] ?? "#d8c9a4"} />;
          })}
        </g>
        <g fill="none" stroke={INK} strokeWidth={0.5} opacity={0.45}>
          {view.districts.map((d) => {
            const c = px(d.q, d.r);
            return <polygon key={`l${d.q},${d.r}`} points={hexPoints(c.x, c.y)} />;
          })}
        </g>
        {view.districts.map((d) => {
          const c = px(d.q, d.r);
          return (
            <g key={`b${d.q},${d.r}`} transform={`translate(${c.x.toFixed(1)},${(c.y - 3).toFixed(1)})`} style={{ pointerEvents: "none" }}>
              <Buildings d={d} seed={seed ^ hexHash(d.q, d.r, 5)} />
            </g>
          );
        })}

        {/* walls or fence */}
        <path d={boundary.join(" ")} fill="none" stroke={INK} strokeWidth={walled ? 3.2 : 1.2} strokeDasharray={walled ? undefined : "3 2"} strokeLinecap="round" opacity={0.85} />

        {/* labels */}
        {view.districts.map((d) => {
          const c = px(d.q, d.r);
          return (
            <g key={`n${d.q},${d.r}`} transform={`translate(${c.x.toFixed(1)},${(c.y + SIZE * 0.55).toFixed(1)})`} style={{ pointerEvents: "none" }}>
              <text textAnchor="middle" fontFamily="Alegreya, serif" fontSize={6.5} fill={INK} stroke="#ecdfbd" strokeWidth={2} paintOrder="stroke">{d.name}</text>
            </g>
          );
        })}

        {/* where you can walk next */}
        {view.districts.filter((d) => hexDistance(here.q, here.r, d.q, d.r) === 1).map((d) => {
          const c = px(d.q, d.r);
          const on = hover?.q === d.q && hover?.r === d.r;
          return (
            <polygon
              key={`a${d.q},${d.r}`}
              points={hexPoints(c.x, c.y, SIZE - 2)}
              fill={on && canMove ? "rgba(155,28,28,0.12)" : "rgba(0,0,0,0)"}
              stroke={on && canMove ? ROUTE : INK}
              strokeWidth={on && canMove ? 1.6 : 0.9}
              strokeDasharray={on && canMove ? undefined : "3 2.5"}
              opacity={canMove ? 0.9 : 0.35}
              style={{ cursor: canMove ? "pointer" : "default" }}
              onMouseEnter={() => setHover(d)}
              onMouseLeave={() => setHover((h) => (h?.q === d.q && h?.r === d.r ? null : h))}
              onClick={() => canMove && onMove(d.q, d.r)}
              data-testid={`district-${d.q}-${d.r}`}
            >
              <title>{`${d.name}: ${DISTRICT_HINT[d.kind] ?? ""}`}</title>
            </polygon>
          );
        })}

        {/* you */}
        <g transform={`translate(${at.x.toFixed(1)},${at.y.toFixed(1)})`} style={{ pointerEvents: "none" }}>
          <polygon points={hexPoints(0, 0, SIZE - 1.5)} fill="none" stroke={ROUTE} strokeWidth={2} />
          <line x1={-1} y1={6} x2={-1} y2={-13} stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
          <path d="M-0.4,-13 L10,-9.8 L-0.4,-6.4 Z" fill={ROUTE} stroke={INK} strokeWidth={0.6} />
        </g>

        <text x={0} y={vb.y + 13} textAnchor="middle" fontFamily="Cinzel, serif" fontWeight={700} fontSize={11} fill={INK}>{view.home ? "Home" : view.name}</text>
      </svg>

      <div className="absolute top-2 right-2 pointer-events-none opacity-90"><CompassRose /></div>

      {info ? (
        <div className="absolute bottom-2 left-2 max-w-[17rem] rounded-md border border-[#5a3e22]/70 bg-[#f3e9cf]/95 px-3 py-2 shadow-md pointer-events-none" data-testid="district-info">
          <p className="font-[Cinzel,serif] text-xs font-bold text-[#3b2a17]">{DISTRICT_INFO[hover!.kind].glyph} {info.title}</p>
          <p className="font-[Alegreya,serif] text-[12px] leading-snug text-[#4a3722]">{info.line}</p>
        </div>
      ) : canMove ? (
        <div className="absolute bottom-2 left-2 rounded-md bg-[#f3e9cf]/85 px-2.5 py-1 pointer-events-none">
          <p className="font-[Alegreya,serif] italic text-[12px] text-[#4a3722]">Walk to a neighbouring district. Leave by the gate.</p>
        </div>
      ) : null}

      {children}
    </div>
  );
}
