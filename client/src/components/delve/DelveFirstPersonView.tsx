import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ArrowUp, RotateCcw, RotateCw } from "lucide-react";
import {
  DelveRetroRenderer,
  HEX_DIRS,
  DIR_LABELS,
  themeFromTags,
  type RetroNode,
} from "./DelveRetroRenderer";

interface Props {
  nodes: RetroNode[];
  clearedNodes: string[];
  currentQ: number;
  currentR: number;
  lightTicks: number;
  themeTags?: string[] | null;
  /** True while a move request is in flight. */
  isMoving: boolean;
  onMove: (node: RetroNode) => void;
  /** Called if WebGL is unavailable, so the page can fall back to the map. */
  onUnavailable?: () => void;
}

const TYPE_HINT: Record<string, string> = {
  entrance: "the way out",
  encounter: "something stirs",
  trap: "the floor looks wrong",
  puzzle: "a faint glow",
  lore: "carved stone",
  cache: "supplies",
  safe: "warmth",
  boss: "a heavy presence",
  chest: "glinting gold",
};

/**
 * First-person, stepped, retro view of a Delve run. Turn with the arrows or
 * Q/E (A/D), step through the doorway ahead with W or the up arrow. Movement
 * still goes through the normal /api/delve/move call; this view only changes
 * how the dungeon is shown and navigated.
 */
export function DelveFirstPersonView({
  nodes, clearedNodes, currentQ, currentR, lightTicks, themeTags, isMoving, onMove, onUnavailable,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<DelveRetroRenderer | null>(null);
  const [facing, setFacing] = useState(0);
  const stepRef = useRef<{ fromQ: number; fromR: number; timer?: number } | null>(null);
  const placedRef = useRef(false);

  const current = useMemo(
    () => nodes.find((n) => n.q === currentQ && n.r === currentR) || null,
    [nodes, currentQ, currentR],
  );

  const exits = useMemo(() => {
    return HEX_DIRS.map((d) => {
      if (!current) return null;
      const n = nodes.find((x) => x.q === current.q + d.dq && x.r === current.r + d.dr);
      if (!n) return null;
      const linked = current.adjacentNodes.includes(n.nodeId) || n.adjacentNodes.includes(current.nodeId);
      return linked ? n : null;
    });
  }, [nodes, current]);

  // ── renderer lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || !wrapRef.current) return;
    let r: DelveRetroRenderer;
    try {
      r = new DelveRetroRenderer(canvasRef.current, themeFromTags(themeTags));
    } catch {
      onUnavailable?.();
      return;
    }
    rendererRef.current = r;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      r.resize(width, height);
    });
    ro.observe(wrapRef.current);
    return () => {
      ro.disconnect();
      r.dispose();
      rendererRef.current = null;
      placedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { rendererRef.current?.setTheme(themeFromTags(themeTags)); }, [themeTags]);
  useEffect(() => { rendererRef.current?.setDungeon(nodes, clearedNodes); }, [nodes, clearedNodes]);
  useEffect(() => { rendererRef.current?.setLight(lightTicks); }, [lightTicks]);

  // ── position: first placement, completed steps, refused steps ───────────────
  useEffect(() => {
    const r = rendererRef.current;
    if (!r || !current) return;
    const step = stepRef.current;

    if (!placedRef.current) {
      // Face an unexplored exit if there is one, otherwise any exit.
      const firstOpen = exits.findIndex((e) => e && !clearedNodes.includes(e.nodeId));
      const anyOpen = exits.findIndex((e) => !!e);
      const k = firstOpen >= 0 ? firstOpen : Math.max(0, anyOpen);
      setFacing(k);
      r.snapTo(currentQ, currentR, k);
      placedRef.current = true;
      return;
    }

    if (step) {
      if (step.fromQ !== currentQ || step.fromR !== currentR) {
        window.clearTimeout(step.timer);
        stepRef.current = null;
        r.completeStep(currentQ, currentR);
      } else if (!isMoving) {
        window.clearTimeout(step.timer);
        stepRef.current = null;
        r.cancelStep(currentQ, currentR);
      }
      return;
    }

    // Position changed from elsewhere (e.g. a click on the 2D map): snap.
    r.snapTo(currentQ, currentR, facing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ, currentR, isMoving, current?.nodeId]);

  // ── controls ────────────────────────────────────────────────────────────────
  const turn = useCallback((delta: number) => {
    if (stepRef.current) return;
    setFacing((f) => {
      const k = (f + delta + 6) % 6;
      rendererRef.current?.turnTo(k);
      return k;
    });
  }, []);

  const faceAndStep = useCallback((k: number) => {
    const r = rendererRef.current;
    const target = exits[k];
    if (!r || !current || !target || stepRef.current || isMoving) return;
    if (k !== facing) {
      setFacing(k);
      r.turnTo(k, 200);
    }
    const fromQ = current.q, fromR = current.r;
    window.setTimeout(() => {
      r.beginStep(current.nodeId);
      // Safety net: if the request never resolves, step back after a while.
      const timer = window.setTimeout(() => {
        if (stepRef.current) { stepRef.current = null; r.cancelStep(fromQ, fromR); }
      }, 10000);
      stepRef.current = { fromQ, fromR, timer };
      onMove(target);
    }, k !== facing ? 210 : 0);
  }, [exits, current, facing, isMoving, onMove]);

  const forward = useCallback(() => faceAndStep(facing), [faceAndStep, facing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a" || k === "q") { e.preventDefault(); turn(-1); }
      else if (k === "arrowright" || k === "d" || k === "e") { e.preventDefault(); turn(1); }
      else if (k === "arrowup" || k === "w") { e.preventDefault(); forward(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn, forward]);

  const ahead = exits[facing];
  const aheadText = ahead
    ? (clearedNodes.includes(ahead.nodeId) ? `${ahead.name || "A passage"} (explored)` : (ahead.name || TYPE_HINT[ahead.type] || "a passage"))
    : "solid wall";

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none" data-testid="delve-first-person">
      <div ref={wrapRef} className="absolute inset-0">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ imageRendering: "pixelated" }}
          onClick={forward}
        />
      </div>

      {/* faint scanlines for the CRT feel */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25 mix-blend-multiply"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.6) 0px, rgba(0,0,0,0.6) 1px, transparent 1px, transparent 3px)" }}
      />

      {/* compass and what's ahead */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest">
        <span className="px-2 py-0.5 bg-black/70 border border-amber-700/60 text-amber-300">{DIR_LABELS[facing]}</span>
        <span className="px-2 py-0.5 bg-black/70 border border-stone-700 text-stone-300 normal-case tracking-normal">
          Ahead: {aheadText}
        </span>
      </div>

      {/* hex exit indicator: click a lit side to go that way */}
      <svg className="absolute top-2 right-2 w-16 h-16" viewBox="-34 -34 68 68" aria-label="Exits">
        {HEX_DIRS.map((_, k) => {
          const a0 = ((60 * k - 30) * Math.PI) / 180;
          const a1 = ((60 * k + 30) * Math.PI) / 180;
          const R = 28;
          const exit = exits[k];
          const explored = exit && clearedNodes.includes(exit.nodeId);
          return (
            <line
              key={k}
              x1={R * Math.cos(a0)} y1={R * Math.sin(a0)} x2={R * Math.cos(a1)} y2={R * Math.sin(a1)}
              stroke={exit ? (explored ? "#78716c" : "#f59e0b") : "#292524"}
              strokeWidth={k === facing ? 7 : 4}
              strokeLinecap="round"
              style={{ cursor: exit ? "pointer" : "default" }}
              onClick={() => exit && faceAndStep(k)}
            >
              <title>{exit ? `${DIR_LABELS[k]}: ${exit.name || exit.type}` : `${DIR_LABELS[k]}: wall`}</title>
            </line>
          );
        })}
        <circle r="3" fill="#fbbf24" />
      </svg>

      {/* movement pad */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <button
          onClick={() => turn(-1)}
          className="w-10 h-10 bg-black/70 border border-stone-600 text-stone-200 hover:bg-stone-800 flex items-center justify-center"
          title="Turn left (Q / A / ←)"
          data-testid="delve-turn-left"
        ><RotateCcw className="h-4 w-4" /></button>
        <button
          onClick={forward}
          disabled={!ahead || isMoving}
          className="w-12 h-12 bg-black/70 border border-amber-600 text-amber-300 hover:bg-amber-950 disabled:opacity-30 disabled:border-stone-700 disabled:text-stone-500 flex items-center justify-center"
          title="Step forward (W / ↑)"
          data-testid="delve-step-forward"
        ><ArrowUp className="h-5 w-5" /></button>
        <button
          onClick={() => turn(1)}
          className="w-10 h-10 bg-black/70 border border-stone-600 text-stone-200 hover:bg-stone-800 flex items-center justify-center"
          title="Turn right (E / D / →)"
          data-testid="delve-turn-right"
        ><RotateCw className="h-4 w-4" /></button>
      </div>

      <div className="absolute bottom-2 left-2 font-mono text-[10px] text-stone-500 bg-black/60 px-1.5 py-0.5 hidden sm:block">
        Q/E turn · W step
      </div>
    </div>
  );
}

export default DelveFirstPersonView;
