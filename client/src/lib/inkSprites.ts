/**
 * Ink sprites: the same hand-inked terrain symbols the SVG maps use
 * (CampaignTerrainInk / Wander's TerrainInk), rendered once to images so the
 * canvas maps (World Map, Capital) can draw them and every map looks alike.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CampaignTerrainInk, type TerrainCategory } from "@/components/dungeon/CampaignTerrainInk";

export const PARCHMENT = "#ecdfbd";
export const INK = "#3b2a17";
export const ROUTE = "#9b1c1c";
export const BADGE = "#f3e9cf";

const cache = new Map<string, HTMLImageElement>();
const waiting = new Set<() => void>();

/** Symbol variants per category, so neighbouring hexes don't look stamped. */
export const SPRITE_VARIANTS = 4;

/**
 * The image for a category and variant, or null while it loads. `onReady` is
 * called (once per load batch) when any pending sprite finishes, so the caller can redraw.
 */
export function inkSprite(category: TerrainCategory, variant: number, onReady?: () => void): HTMLImageElement | null {
  const key = `${category}:${variant % SPRITE_VARIANTS}`;
  let img = cache.get(key);
  if (!img) {
    const v = variant % SPRITE_VARIANTS;
    const inner = renderToStaticMarkup(createElement(CampaignTerrainInk, { category, q: v * 7 + 3, r: v * 13 + 5 }));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-26 -26 52 52" width="104" height="104">${inner}</svg>`;
    img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const cbs = Array.from(waiting);
      waiting.clear();
      cbs.forEach((cb) => cb());
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    cache.set(key, img);
  }
  if (img.complete && img.naturalWidth > 0) return img;
  if (onReady) waiting.add(onReady);
  return null;
}

/** A paper-grain pattern for canvas backgrounds (made once). */
let grain: HTMLCanvasElement | null = null;
export function parchmentGrain(): HTMLCanvasElement {
  if (grain) return grain;
  const c = document.createElement("canvas");
  c.width = c.height = 160;
  const g = c.getContext("2d")!;
  g.fillStyle = PARCHMENT;
  g.fillRect(0, 0, 160, 160);
  let s = 12345;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    const a = rnd() * 0.07;
    g.fillStyle = rnd() < 0.5 ? `rgba(110,80,40,${a})` : `rgba(255,250,235,${a})`;
    g.fillRect(rnd() * 160, rnd() * 160, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
  grain = c;
  return c;
}

/** Parchment background with a soft darker edge, like an old map. */
export function paintParchment(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const pat = ctx.createPattern(parchmentGrain(), "repeat");
  ctx.fillStyle = pat ?? PARCHMENT;
  ctx.fillRect(0, 0, w, h);
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, "rgba(122,90,50,0)");
  v.addColorStop(1, "rgba(122,90,50,0.28)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

/** A round parchment badge with an ink ring and an emoji, as on the Wander map. */
export function drawBadge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, glyph: string, strong = false) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = BADGE;
  ctx.fill();
  ctx.lineWidth = strong ? r * 0.16 : r * 0.1;
  ctx.strokeStyle = INK;
  ctx.stroke();
  if (strong) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
    ctx.lineWidth = r * 0.05;
    ctx.stroke();
  }
  ctx.font = `${r * 1.15}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, x, y + r * 0.06);
  ctx.restore();
}

/** The party's red pennant on a pole. */
export function drawPennant(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color = ROUTE) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 20, s / 20);
  ctx.fillStyle = "rgba(59,42,23,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 6, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-1, 8);
  ctx.lineTo(-1, -13);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-0.4, -13);
  ctx.lineTo(11, -9.5);
  ctx.lineTo(-0.4, -5.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#d4a017";
  ctx.beginPath();
  ctx.arc(-1, -13.5, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Ink text with a parchment halo (Cinzel for names). */
export function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, opts: { bold?: boolean; italic?: boolean; alpha?: number; color?: string; spacing?: number } = {}) {
  ctx.save();
  ctx.font = `${opts.italic ? "italic " : ""}${opts.bold === false ? "" : "700 "}${size}px Cinzel, Georgia, serif`;
  if ("letterSpacing" in ctx && opts.spacing) (ctx as any).letterSpacing = `${opts.spacing}px`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.strokeStyle = PARCHMENT;
  ctx.lineWidth = Math.max(2, size * 0.32);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = opts.color ?? INK;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** One emoji per kind of town building, shared by the capital and city maps. */
export const BUILDING_GLYPH: Record<string, string> = {
  tavern: "🍺", blacksmith: "⚒️", magic_shop: "✨", general_store: "🧺", temple: "🕯️", guild: "🏛️",
  library: "📚", stables: "🐴", barracks: "⚔️", apothecary: "⚗️", jeweler: "💎", arena: "🏟️",
  underworld: "🗝️", cartographer: "🗺️", palace: "👑", bank: "🏦", real_estate: "🏠", dark_temple: "💀",
  information_broker: "🕵️", auction: "🔨", academy: "🎓", dungeon_entrance: "🕳️", tailor: "🧵",
  shop: "🧺", market: "🧺", inn: "🛏️", shrine: "🕯️", smithy: "⚒️", well: "🪣", town_hall: "🏛️", docks: "⚓",
};
