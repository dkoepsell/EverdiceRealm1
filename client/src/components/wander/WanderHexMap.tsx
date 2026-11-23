/**
 * WanderHexMap: the Wander exploration map drawn like a classic D&D wilderness
 * hex crawl. Parchment, hand-inked terrain, the party's route in red, a compass
 * rose and a 6-mile scale. Unknown country stays blank; country you can see from
 * where you stand is pencilled in; country you have walked is inked and washed.
 *
 * Hovering a neighbouring hex shows the real travel rules for it (direction,
 * hours at the current pace, the Survival DC to stay on course, foraging), so the
 * map teaches how wilderness travel works at the table.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TERRAIN_TO_BIOME, bearing, hexDistance, hexHash, type WanderTerrain } from "@shared/wander/terrain";
import { HEX_MILES, forageAbundance, hoursPerHex, navigationBaseDC, type Pace } from "@shared/wander/travel";

export interface MapHex {
  q: number;
  r: number;
  explored: boolean;
  isCurrent: boolean;
  isAdjacent: boolean;
  terrain: WanderTerrain;
}

export interface MapGlyph {
  glyph: string;
  title?: string;
  /** Settlements: drawn larger, with their name under the badge. */
  label?: string;
}

interface Props {
  hexes: MapHex[];
  current: { q: number; r: number };
  /** Explored hex keys ("q,r") in the order they were reached. */
  route: string[];
  glyphAt: (hex: MapHex) => MapGlyph | null;
  canMove: boolean;
  onMove: (q: number, r: number) => void;
  pace?: Pace;
  exhaustion?: number;
  /** How far the party can see (in hexes) from where it stands. */
  sight?: number;
  /** How many hexes out from the party the map frames. */
  view?: number;
  /** Scale for badges and the party pennant, so they stay readable when zoomed out. */
  markScale?: number;
  children?: ReactNode;
}

export const SIZE = 28;
export const INK = "#3b2a17";
const PENCIL = "#7d6b52";
export const ROUTE = "#9b1c1c";

export const WASH: Record<WanderTerrain, string> = {
  plains: "#cdd49a",
  forest: "#93ad72",
  mountain: "#c4ad86",
  swamp: "#a3b292",
  desert: "#e8cf93",
  ocean: "#93bccb",
};

export const TERRAIN_LABEL: Record<WanderTerrain, string> = {
  plains: "Plains",
  forest: "Forest",
  mountain: "Mountains",
  swamp: "Swamp",
  desert: "Desert",
  ocean: "Coast & sea",
};

export function axialToPixel(q: number, r: number) {
  return { x: SIZE * Math.sqrt(3) * (q + r / 2), y: SIZE * 1.5 * r };
}

export function hexPoints(cx: number, cy: number, s = SIZE) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${(cx + s * Math.cos(a)).toFixed(2)},${(cy + s * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

/** Deterministic per-hex random numbers, so a hex always looks the same. */
function rng(q: number, r: number) {
  let s = hexHash(q, r, 7) || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Spots inside the hex for scattering symbols, roughly evenly spread. */
function spots(rand: () => number, n: number, spread = 0.55) {
  const out: Array<{ x: number; y: number }> = [];
  const base = rand() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = base + (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.8;
    const d = SIZE * spread * (0.35 + rand() * 0.65);
    out.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.8 });
  }
  if (n >= 4) out.push({ x: (rand() - 0.5) * 4, y: (rand() - 0.5) * 4 });
  return out.sort((a, b) => a.y - b.y);
}

/** The inked terrain symbol for one hex, centred on (0,0). */
export function TerrainInk({ terrain, q, r, ink = INK, wash }: { terrain: WanderTerrain; q: number; r: number; ink?: string; wash?: string }) {
  const rand = rng(q, r);
  const w = 0.75;
  switch (terrain) {
    case "forest": {
      return (
        <g>
          {spots(rand, 5).map((p, i) => {
            const conifer = rand() < 0.4;
            const k = 0.85 + rand() * 0.35;
            const fill = wash ?? WASH.forest;
            return conifer ? (
              <g key={i} transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) scale(${k.toFixed(2)})`}>
                <path d="M0,-7 L3.6,0.5 L1.2,0.5 L1.2,2.4 L-1.2,2.4 L-1.2,0.5 L-3.6,0.5 Z" fill={fill} stroke={ink} strokeWidth={w} strokeLinejoin="round" />
              </g>
            ) : (
              <g key={i} transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) scale(${k.toFixed(2)})`}>
                <line x1={0} y1={0} x2={0} y2={3} stroke={ink} strokeWidth={w} />
                <path d="M-3.6,0.4 C-5.2,-1.6 -3.4,-5.8 -0.6,-5.2 C0.6,-7.4 4.6,-6 3.8,-3 C5.6,-1.4 3.6,1.4 1.6,0.6 C0.6,1.6 -2.4,1.6 -3.6,0.4 Z" fill={fill} stroke={ink} strokeWidth={w} strokeLinejoin="round" />
              </g>
            );
          })}
        </g>
      );
    }
    case "mountain": {
      const peaks = [
        { x: -4 - rand() * 3, h: 13 + rand() * 3, wd: 10 + rand() * 2 },
        { x: 6 + rand() * 3, h: 9 + rand() * 2, wd: 8 + rand() * 2 },
      ].sort((a, b) => a.h - b.h);
      return (
        <g>
          {peaks.map((p, i) => {
            const base = 7;
            const top = base - p.h;
            const l = p.x - p.wd;
            const rr = p.x + p.wd;
            const mid = p.x + 1.5;
            return (
              <g key={i}>
                <path d={`M${l},${base} L${p.x},${top} L${mid},${base} Z`} fill={wash ?? "#e2d3ad"} stroke="none" />
                <path d={`M${p.x},${top} L${rr},${base} L${mid},${base} Z`} fill={wash ? wash : "#a98d63"} opacity={wash ? 1 : 0.9} stroke="none" />
                {[0.3, 0.5, 0.7].map((t) => (
                  <line key={t} x1={p.x + (rr - p.x) * t} y1={top + (base - top) * t} x2={p.x + (mid - p.x) * t + 1} y2={base - 0.5} stroke={ink} strokeWidth={0.45} opacity={0.6} />
                ))}
                <path d={`M${l},${base} L${p.x},${top} L${rr},${base}`} fill="none" stroke={ink} strokeWidth={w + 0.15} strokeLinejoin="round" />
                {i === peaks.length - 1 && !wash && (
                  <path d={`M${p.x - 2.2},${top + 3.4} L${p.x},${top} L${p.x + 2.2},${top + 3.4} L${p.x + 0.8},${top + 2.6} L${p.x - 0.6},${top + 3.6} Z`} fill="#f7f2e4" stroke={ink} strokeWidth={0.4} />
                )}
              </g>
            );
          })}
        </g>
      );
    }
    case "plains": {
      return (
        <g stroke={ink} strokeWidth={w} strokeLinecap="round" fill="none">
          {spots(rand, 5, 0.6).map((p, i) => (
            <path key={i} transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`} d="M-1.8,0 L-0.7,-2.8 M0,0 L0,-3.6 M1.8,0 L0.7,-2.8" />
          ))}
        </g>
      );
    }
    case "swamp": {
      return (
        <g strokeLinecap="round" fill="none">
          {spots(rand, 4, 0.55).map((p, i) => (
            <g key={i} transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`}>
              <path d="M-4,1.2 L4,1.2 M-2.5,2.8 L2.5,2.8" stroke={wash ? ink : "#4c7080"} strokeWidth={w} />
              <path d="M-1.4,0.6 L-2.2,-2.6 M0,0.6 L0,-3.4 M1.4,0.6 L2.2,-2.4" stroke={ink} strokeWidth={w} />
            </g>
          ))}
        </g>
      );
    }
    case "desert": {
      return (
        <g fill="none" stroke={ink} strokeWidth={w} strokeLinecap="round">
          {[-6, 1, 8].map((dy, i) => {
            const dx = (rand() - 0.5) * 8;
            return <path key={i} d={`M${dx - 8},${dy} Q${dx - 3},${dy - 4.5} ${dx + 1},${dy - 1} Q${dx + 4},${dy + 1.5} ${dx + 8},${dy - 0.5}`} />;
          })}
          {Array.from({ length: 7 }, (_, i) => (
            <circle key={`d${i}`} cx={(rand() - 0.5) * SIZE * 1.1} cy={(rand() - 0.5) * SIZE * 0.9} r={0.5} fill={ink} stroke="none" />
          ))}
        </g>
      );
    }
    case "ocean": {
      return (
        <g fill="none" stroke={wash ? ink : "#2f5f78"} strokeWidth={w} strokeLinecap="round">
          {spots(rand, 4, 0.5).map((p, i) => (
            <path key={i} transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`} d="M-5,0 Q-3.75,-1.8 -2.5,0 T0,0 T2.5,0 T5,0" />
          ))}
        </g>
      );
    }
  }
}

export function CompassRose() {
  return (
    <svg viewBox="-30 -30 60 60" className="w-14 h-14 md:w-16 md:h-16" aria-hidden>
      <circle r={20} fill="none" stroke={INK} strokeWidth={0.8} opacity={0.6} />
      <circle r={17} fill="none" stroke={INK} strokeWidth={0.4} opacity={0.5} />
      {[0, 90, 180, 270].map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <path d="M0,-22 L4,0 L0,0 Z" fill={INK} />
          <path d="M0,-22 L-4,0 L0,0 Z" fill="#efe3c2" stroke={INK} strokeWidth={0.5} />
        </g>
      ))}
      {[45, 135, 225, 315].map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <path d="M0,-13 L2.4,0 L-2.4,0 Z" fill={INK} opacity={0.65} />
        </g>
      ))}
      <circle r={2} fill={ROUTE} stroke={INK} strokeWidth={0.5} />
      <text y={-23.5} textAnchor="middle" fontFamily="Cinzel, serif" fontWeight={700} fontSize={7} fill={ROUTE}>N</text>
    </svg>
  );
}

export function WanderHexMap({ hexes, current, route, glyphAt, canMove, onMove, pace = "normal", exhaustion = 0, sight = 3, view: viewProp, markScale = 1, children }: Props) {
  const [hover, setHover] = useState<MapHex | null>(null);
  // Phones get a tighter frame so the hexes stay big enough to tap.
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const view = viewProp ?? (narrow ? 3 : 4.5);

  // Frame the map on the party, a few hexes out, rather than the whole loaded grid.
  const bounds = useMemo(() => {
    const c = axialToPixel(current.q, current.r);
    const rx = SIZE * Math.sqrt(3) * (view + 0.6);
    const ry = SIZE * 1.5 * (view + 0.4);
    return { x: c.x - rx, y: c.y - ry, w: rx * 2, h: ry * 2 };
  }, [current.q, current.r, view]);

  const centre = axialToPixel(current.q, current.r);

  // The route: consecutive explored hexes that are neighbours, inside the view.
  const routeSegments = useMemo(() => {
    const visible = new Set(hexes.map((h) => `${h.q},${h.r}`));
    const segs: string[] = [];
    let path = "";
    let prev: { q: number; r: number } | null = null;
    for (const key of route) {
      const [q, r] = key.split(",").map(Number);
      const p = axialToPixel(q, r);
      const joins = prev && hexDistance(prev.q, prev.r, q, r) === 1 && visible.has(key);
      if (joins) path += ` L${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      else {
        if (path.includes("L")) segs.push(path);
        path = visible.has(key) ? `M${p.x.toFixed(1)},${p.y.toFixed(1)}` : "";
      }
      prev = { q, r };
    }
    if (path.includes("L")) segs.push(path);
    return segs;
  }, [route, hexes]);

  const info = hover && hover.isAdjacent && !hover.isCurrent ? (() => {
    const biome = TERRAIN_TO_BIOME[hover.terrain];
    const dc = navigationBaseDC(biome);
    const hours = hoursPerHex(pace, exhaustion);
    return {
      title: `${TERRAIN_LABEL[hover.terrain]} to the ${bearing(current.q, current.r, hover.q, hover.r)}`,
      lines: [
        `About ${hours % 1 ? hours.toFixed(1) : hours} hours at a ${pace} pace (${HEX_MILES} miles)`,
        dc == null ? "Follow the shore: no Survival check to stay on course" : `Survival DC ${dc} to keep your bearings`,
        `Foraging: ${forageAbundance(biome)}`,
        ...(glyphAt(hover)?.title ? [`There: ${glyphAt(hover)!.title}`] : []),
      ],
    };
  })() : null;

  const sorted = useMemo(() => [...hexes].sort((a, b) => a.r - b.r || a.q - b.q), [hexes]);

  return (
    <div className="relative h-[400px] md:h-[500px] rounded-lg overflow-hidden border-[3px] border-[#5a3e22] shadow-[inset_0_0_40px_rgba(60,35,10,0.55)] bg-[#e9dbb5]" data-testid="wander-hex-map">
      <svg
        viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
        className="w-full h-full select-none"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Wilderness map"
      >
        <defs>
          <filter id="wm-paper" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} seed={4} result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.33  0 0 0 0 0.18  0 0 0 0.16 0" />
          </filter>
          <filter id="wm-blot" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves={2} seed={9} result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.36  0 0 0 0 0.16  0 0 0 0.5 -0.12" />
          </filter>
          <filter id="wm-wash" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves={2} seed={2} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={3.2} />
          </filter>
          <radialGradient id="wm-fog" cx={centre.x} cy={centre.y} r={SIZE * (view + 3.5)} gradientUnits="userSpaceOnUse">
            <stop offset="0.45" stopColor="#e9dbb5" stopOpacity={0} />
            <stop offset="0.85" stopColor="#dcc89c" stopOpacity={0.45} />
            <stop offset="1" stopColor="#8a6a3e" stopOpacity={0.4} />
          </radialGradient>
        </defs>

        {/* parchment */}
        <rect x={bounds.x - bounds.w} y={bounds.y - bounds.h} width={bounds.w * 3} height={bounds.h * 3} fill="#ecdfbd" />
        <rect x={bounds.x - bounds.w} y={bounds.y - bounds.h} width={bounds.w * 3} height={bounds.h * 3} filter="url(#wm-blot)" />
        <rect x={bounds.x - bounds.w} y={bounds.y - bounds.h} width={bounds.w * 3} height={bounds.h * 3} filter="url(#wm-paper)" />

        {/* watercolour washes for known and sighted country */}
        <g filter="url(#wm-wash)">
          {sorted.map((h) => {
            const d = hexDistance(h.q, h.r, current.q, current.r);
            const known = h.explored || h.isCurrent;
            if (!known && d > sight) return null;
            const { x, y } = axialToPixel(h.q, h.r);
            return (
              <polygon key={`w${h.q},${h.r}`} points={hexPoints(x, y, SIZE * 0.98)} fill={WASH[h.terrain]} opacity={known ? 0.95 : Math.max(0.18, 0.55 - d * 0.1)} />
            );
          })}
        </g>

        {/* grid */}
        <g fill="none">
          {sorted.map((h) => {
            const { x, y } = axialToPixel(h.q, h.r);
            const d = hexDistance(h.q, h.r, current.q, current.r);
            const known = h.explored || h.isCurrent;
            return (
              <polygon key={`g${h.q},${h.r}`} points={hexPoints(x, y)} stroke={INK} strokeWidth={known ? 0.6 : 0.4} opacity={known ? 0.55 : d <= sight ? 0.32 : 0.16} />
            );
          })}
        </g>

        {/* terrain: inked where walked, pencilled where only seen */}
        {sorted.map((h) => {
          const d = hexDistance(h.q, h.r, current.q, current.r);
          const known = h.explored || h.isCurrent;
          if (!known && d > sight) return null;
          const g = glyphAt(h);
          if (g && known) return null;
          const { x, y } = axialToPixel(h.q, h.r);
          return (
            <g key={`t${h.q},${h.r}`} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} opacity={known ? 1 : Math.max(0.35, 0.85 - d * 0.15)} style={{ pointerEvents: "none" }}>
              <g transform="scale(1.22)"><TerrainInk terrain={h.terrain} q={h.q} r={h.r} ink={known ? INK : PENCIL} wash={known ? undefined : "none"} /></g>
            </g>
          );
        })}

        <rect x={bounds.x - bounds.w} y={bounds.y - bounds.h} width={bounds.w * 3} height={bounds.h * 3} fill="url(#wm-fog)" style={{ pointerEvents: "none" }} />

        {/* the party's route */}
        <g fill="none" stroke={ROUTE} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.1 4.4" opacity={0.9} style={{ pointerEvents: "none" }}>
          {routeSegments.map((d, i) => <path key={i} d={d} />)}
        </g>

        {/* landmarks, markers and signs */}
        {sorted.map((h) => {
          if (h.isCurrent) return null;
          const g = glyphAt(h);
          if (!g) return null;
          const { x, y } = axialToPixel(h.q, h.r);
          return (
            <g key={`m${h.q},${h.r}`} transform={`translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${markScale})`}>
              {g.title && <title>{g.title}</title>}
              <circle r={g.label ? 11 : 8.5} fill="#f3e9cf" stroke={INK} strokeWidth={g.label ? 1.2 : 0.8} />
              <circle r={g.label ? 9.3 : 7} fill="none" stroke={INK} strokeWidth={0.3} opacity={0.6} />
              <text textAnchor="middle" dominantBaseline="central" style={{ fontSize: g.label ? 13 : 10, pointerEvents: "none" }}>{g.glyph}</text>
              {g.label && (
                <text y={19} textAnchor="middle" fontFamily="Cinzel, serif" fontWeight={700} fontSize={7} fill={INK} stroke="#ecdfbd" strokeWidth={2.2} paintOrder="stroke" style={{ pointerEvents: "none" }}>{g.label}</text>
              )}
            </g>
          );
        })}

        {/* where you can go next */}
        {sorted.filter((h) => h.isAdjacent && !h.isCurrent).map((h) => {
          const { x, y } = axialToPixel(h.q, h.r);
          const on = hover?.q === h.q && hover?.r === h.r;
          return (
            <polygon
              key={`a${h.q},${h.r}`}
              points={hexPoints(x, y, SIZE - 2)}
              fill={on && canMove ? "rgba(155,28,28,0.12)" : "rgba(0,0,0,0)"}
              stroke={on && canMove ? ROUTE : INK}
              strokeWidth={on && canMove ? 1.6 : 0.9}
              strokeDasharray={on && canMove ? undefined : "3 2.5"}
              opacity={canMove ? 0.9 : 0.35}
              style={{ cursor: canMove ? "pointer" : "default", transition: "fill 0.15s" }}
              onMouseEnter={() => setHover(h)}
              onMouseLeave={() => setHover((c) => (c?.q === h.q && c?.r === h.r ? null : c))}
              onClick={() => canMove && onMove(h.q, h.r)}
              data-testid={`map-hex-${h.q}-${h.r}`}
            >
              <title>{`Travel ${bearing(current.q, current.r, h.q, h.r)} into the ${TERRAIN_LABEL[h.terrain].toLowerCase()}`}</title>
            </polygon>
          );
        })}

        {/* the party: a pennant planted in the current hex */}
        <g transform={`translate(${centre.x.toFixed(1)},${centre.y.toFixed(1)})`} style={{ pointerEvents: "none" }}>
          {markScale > 1 && <circle r={SIZE * 1.6} fill="none" stroke={ROUTE} strokeWidth={2.5} strokeDasharray="5 4" opacity={0.8} />}
          <g transform={`scale(${markScale})`}>
          <polygon points={hexPoints(0, 0, SIZE - 1.5)} fill="none" stroke={ROUTE} strokeWidth={2} opacity={0.9} />
          <ellipse cx={0} cy={8} rx={6} ry={2} fill={INK} opacity={0.3} />
          <line x1={-1} y1={8} x2={-1} y2={-13} stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
          <path d="M-0.4,-13 L11,-9.5 L-0.4,-5.5 Z" fill={ROUTE} stroke={INK} strokeWidth={0.6}>
            <animate attributeName="d" dur="2.4s" repeatCount="indefinite"
              values="M-0.4,-13 L11,-9.5 L-0.4,-5.5 Z;M-0.4,-13 Q5,-10.5 10,-8.5 L-0.4,-5.5 Z;M-0.4,-13 L11,-9.5 L-0.4,-5.5 Z" />
          </path>
          <circle cx={-1} cy={-13.5} r={1.2} fill="#d4a017" stroke={INK} strokeWidth={0.4} />
          </g>
        </g>

        {!narrow && <text x={bounds.x + 14} y={bounds.y + 22} textAnchor="start" fontFamily="Alegreya, serif" fontStyle="italic" fontSize={11} fill={INK} opacity={0.45} transform={`rotate(-4 ${bounds.x + 14} ${bounds.y + 22})`}>
          Terra incognita
        </text>}
      </svg>

      <div className="absolute top-2 right-2 pointer-events-none opacity-90"><CompassRose /></div>

      <div className="absolute bottom-2 right-3 pointer-events-none flex flex-col items-end gap-0.5" aria-hidden>
        <div className="flex h-1.5 w-24 border border-[#3b2a17]">
          <div className="flex-1 bg-[#3b2a17]" /><div className="flex-1" /><div className="flex-1 bg-[#3b2a17]" /><div className="flex-1" />
        </div>
        <span className="font-[Alegreya,serif] italic text-[11px] text-[#3b2a17]">1 hex = {HEX_MILES} miles</span>
      </div>

      {info ? (
        <div className="absolute bottom-2 left-2 max-w-[17rem] rounded-md border border-[#5a3e22]/70 bg-[#f3e9cf]/95 px-3 py-2 shadow-md pointer-events-none" data-testid="map-hex-info">
          <p className="font-[Cinzel,serif] text-xs font-bold text-[#3b2a17]">{info.title}</p>
          {info.lines.map((l) => <p key={l} className="font-[Alegreya,serif] text-[12px] leading-snug text-[#4a3722]">{l}</p>)}
        </div>
      ) : canMove ? (
        <div className="absolute bottom-2 left-2 rounded-md bg-[#f3e9cf]/85 px-2.5 py-1 pointer-events-none">
          <p className="font-[Alegreya,serif] italic text-[12px] text-[#4a3722]">Choose a neighbouring hex to travel there.</p>
        </div>
      ) : null}

      {children}
    </div>
  );
}

/** Small legend: the same inked symbols as the map. */
export function WanderMapLegend() {
  const terrains: WanderTerrain[] = ["plains", "forest", "mountain", "swamp", "desert", "ocean"];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-2 pb-2" data-testid="wander-map-legend">
      {terrains.map((t) => (
        <div key={t} className="flex items-center gap-1.5 text-[11px] text-slate-300">
          <svg viewBox="-16 -14 32 28" className="w-7 h-6 rounded-sm" style={{ background: "#ecdfbd" }} aria-hidden>
            <polygon points={hexPoints(0, 0, 14)} fill={WASH[t]} opacity={0.85} />
            <g transform="scale(0.7)"><TerrainInk terrain={t} q={3} r={5} /></g>
          </svg>
          <span>{TERRAIN_LABEL[t]}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
        <svg viewBox="0 0 24 10" className="w-6 h-3" aria-hidden><path d="M2,5 L22,5" stroke={ROUTE} strokeWidth={2} strokeDasharray="0.1 4" strokeLinecap="round" /></svg>
        <span>Your route</span>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-slate-300"><span>🏘️</span><span>Village, town or city (enter it)</span></div>
      <div className="flex items-center gap-1.5 text-[11px] text-slate-300"><span>🕳️</span><span>Dungeon entrance (go down)</span></div>
    </div>
  );
}
