import * as THREE from "three";

/**
 * Retro first-person view of a Delve run.
 *
 * Every Delve node sits on an axial hex grid and only ever connects to hex
 * neighbours, so the dungeon is drawn as a tiling of hexagonal rooms that share
 * walls. A shared wall gets a doorway when the two nodes are connected, and is
 * solid otherwise. The player stands near the back of the current room, looking
 * across it toward one of its six walls, and turns in 60 degree steps.
 *
 * The look is deliberately early 90s: the scene is rendered at ~200 lines and
 * scaled up with nearest-neighbour filtering, all textures are tiny procedural
 * canvases (no asset files, nothing extra for the CSP to admit), and monsters
 * are pixel sprites. The scene only animates while turning or stepping; between
 * moves it redraws a few times a second for torch flicker.
 *
 * Only the main three build is imported, for the same CSP reason noted in
 * BlockWorldRenderer.
 */

export type RetroNodeType =
  | "entrance" | "encounter" | "trap" | "puzzle" | "lore"
  | "cache" | "safe" | "boss" | "chest";

export interface RetroNode {
  nodeId: string;
  q: number;
  r: number;
  type: RetroNodeType;
  name: string;
  adjacentNodes: string[];
  encounterData?: { enemies?: Array<{ name?: string }> } | null;
}

export type RetroThemeKey =
  | "stone" | "goblin" | "undead" | "underdark" | "dragon" | "cave" | "forest";

interface Theme {
  brick: string;
  mortar: string;
  floor: string;
  floorGap: string;
  ceiling: string;
  moss?: string;
  monster: "goblin" | "skeleton" | "hooded" | "kobold";
}

const THEMES: Record<RetroThemeKey, Theme> = {
  stone:     { brick: "#6b6258", mortar: "#2a2520", floor: "#4d463e", floorGap: "#211d19", ceiling: "#1d1a17", monster: "goblin" },
  goblin:    { brick: "#62604a", mortar: "#26261b", floor: "#4b4636", floorGap: "#1f1d15", ceiling: "#1b1a14", moss: "#3f5a2a", monster: "goblin" },
  undead:    { brick: "#5b6068", mortar: "#22252b", floor: "#45484e", floorGap: "#1b1d21", ceiling: "#17191c", monster: "skeleton" },
  underdark: { brick: "#4d4560", mortar: "#1e1a27", floor: "#3c3649", floorGap: "#18151e", ceiling: "#141119", moss: "#3a6d6a", monster: "hooded" },
  dragon:    { brick: "#6e4a3a", mortar: "#2a1c16", floor: "#523a2f", floorGap: "#22160f", ceiling: "#1d1310", monster: "kobold" },
  cave:      { brick: "#7a6142", mortar: "#2e2418", floor: "#5a4832", floorGap: "#241b11", ceiling: "#1f1810", monster: "goblin" },
  forest:    { brick: "#53603f", mortar: "#202618", floor: "#43492f", floorGap: "#1a1d12", ceiling: "#151a10", moss: "#4c7a2e", monster: "goblin" },
};

export function themeFromTags(tags: string[] | undefined | null): RetroThemeKey {
  const t = (tags || []).map((x) => x.toLowerCase());
  for (const key of ["undead", "underdark", "dragon", "goblin", "cave", "forest"] as RetroThemeKey[]) {
    if (t.includes(key)) return key;
  }
  return "stone";
}

// ── Geometry constants (world units ~ metres) ─────────────────────────────────
const SIZE = 4;                              // hex circumradius
const APOTHEM = SIZE * Math.sqrt(3) / 2;
const WALL_H = 3.2;
const DOOR_W = 1.7;
const DOOR_H = 2.4;
const EYE = 1.55;
const BACK = 2.6;                            // how far behind room centre the camera stands
const TEX_WORLD = 2;                         // one texture tile per 2 units
const RENDER_LINES = 200;                    // vertical resolution of the retro buffer

/** Facing index k looks at angle 60k degrees; these are the axial steps. */
export const HEX_DIRS: Array<{ dq: number; dr: number }> = [
  { dq: 1, dr: 0 }, { dq: 0, dr: 1 }, { dq: -1, dr: 1 },
  { dq: -1, dr: 0 }, { dq: 0, dr: -1 }, { dq: 1, dr: -1 },
];
/** Compass label for each facing, matching the 2D map (north is up). */
export const DIR_LABELS = ["E", "SE", "SW", "W", "NW", "NE"];

function roomCenter(q: number, r: number) {
  return { x: SIZE * Math.sqrt(3) * (q + r / 2), z: SIZE * 1.5 * r };
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return `#${c.getHexString()}`;
}

// ── Procedural pixel textures ─────────────────────────────────────────────────

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

function toTexture(c: HTMLCanvasElement, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  return t;
}

function brickTexture(theme: Theme, seed: number) {
  const rnd = mulberry32(seed);
  const { c, ctx } = makeCanvas(32, 32);
  ctx.fillStyle = theme.mortar; ctx.fillRect(0, 0, 32, 32);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 4 : 0;
    for (let col = -1; col < 4; col++) {
      const x = col * 8 + off;
      ctx.fillStyle = shade(theme.brick, (rnd() - 0.5) * 0.08);
      ctx.fillRect(x + 1, row * 8 + 1, 7, 7);
      // a highlight on top, a shadow under, like hand-pixelled bricks
      ctx.fillStyle = shade(theme.brick, 0.06); ctx.fillRect(x + 1, row * 8 + 1, 7, 1);
      ctx.fillStyle = shade(theme.brick, -0.1); ctx.fillRect(x + 1, row * 8 + 7, 7, 1);
    }
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = shade(theme.brick, (rnd() - 0.5) * 0.2);
    ctx.fillRect(Math.floor(rnd() * 32), Math.floor(rnd() * 32), 1, 1);
  }
  if (theme.moss) {
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = shade(theme.moss, (rnd() - 0.5) * 0.1);
      ctx.fillRect(Math.floor(rnd() * 32), 24 + Math.floor(rnd() * 8), 1 + Math.floor(rnd() * 2), 1);
    }
  }
  return toTexture(c);
}

function floorTexture(theme: Theme, seed: number) {
  const rnd = mulberry32(seed);
  const { c, ctx } = makeCanvas(32, 32);
  ctx.fillStyle = theme.floorGap; ctx.fillRect(0, 0, 32, 32);
  const tiles = [[0, 0, 16, 16], [16, 0, 16, 10], [16, 10, 16, 22], [0, 16, 9, 16], [9, 16, 7, 16]];
  for (const [x, y, w, h] of tiles) {
    ctx.fillStyle = shade(theme.floor, (rnd() - 0.5) * 0.08);
    ctx.fillRect(x + 1, y + 1, w - 1, h - 1);
  }
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = shade(theme.floor, (rnd() - 0.5) * 0.14);
    ctx.fillRect(Math.floor(rnd() * 32), Math.floor(rnd() * 32), 1, 1);
  }
  return toTexture(c);
}

function noiseTexture(base: string, seed: number, spread = 0.08) {
  const rnd = mulberry32(seed);
  const { c, ctx } = makeCanvas(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = shade(base, (rnd() - 0.5) * spread);
    ctx.fillRect(x, y, 1, 1);
  }
  return toTexture(c);
}

function woodTexture(seed: number) {
  const rnd = mulberry32(seed);
  const { c, ctx } = makeCanvas(16, 16);
  ctx.fillStyle = "#5a3b22"; ctx.fillRect(0, 0, 16, 16);
  for (let x = 0; x < 16; x += 4) {
    ctx.fillStyle = "#2e1d10"; ctx.fillRect(x, 0, 1, 16);
  }
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = rnd() > 0.5 ? "#6b4a2c" : "#47301b";
    ctx.fillRect(Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 2);
  }
  return toTexture(c);
}

function runeTexture(seed: number) {
  const rnd = mulberry32(seed);
  const { c, ctx } = makeCanvas(16, 24);
  ctx.clearRect(0, 0, 16, 24);
  ctx.fillStyle = "#7fb4ff";
  for (let row = 0; row < 5; row++) {
    for (let g = 0; g < 3; g++) {
      const gx = 2 + g * 5, gy = 2 + row * 4;
      for (let i = 0; i < 4; i++) {
        if (rnd() > 0.45) ctx.fillRect(gx + Math.floor(rnd() * 3), gy + Math.floor(rnd() * 3), 1, 1);
      }
    }
  }
  return toTexture(c, false);
}

type MonsterKind = Theme["monster"];

/** 16x24 pixel creature, drawn from rectangles so it reads as hand-pixelled. */
function monsterTexture(kind: MonsterKind, boss: boolean, seed: number) {
  const rnd = mulberry32(seed);
  const { c, ctx } = makeCanvas(16, 24);
  const px = (x: number, y: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
  };
  const eye = boss ? "#ffdd33" : "#ff2a1a";
  const dark = "#140e0a";

  if (kind === "skeleton") {
    const bone = boss ? "#e8dcc0" : "#d6cfbd";
    px(5, 3, 6, 6, bone); px(6, 5, 1, 2, dark); px(9, 5, 1, 2, dark);
    px(6, 5, 1, 1, eye); px(9, 5, 1, 1, eye); px(6, 8, 4, 1, dark);
    px(7, 9, 2, 9, bone);
    for (let y = 11; y < 17; y += 2) px(4, y, 8, 1, bone);
    px(3, 10, 1, 7, bone); px(12, 10, 1, 7, bone);
    px(5, 17, 6, 2, bone); px(5, 19, 1, 5, bone); px(10, 19, 1, 5, bone);
    px(13, 5, 1, 10, "#a9b3bd"); px(12, 13, 3, 1, "#6b5030");
  } else if (kind === "hooded") {
    const robe = boss ? "#4a2a6a" : "#3a3346";
    for (let y = 2; y < 24; y++) {
      const half = Math.min(7, 2 + Math.floor(y / 3));
      px(8 - half, y, half * 2, 1, shade(robe, (rnd() - 0.5) * 0.05));
    }
    px(6, 5, 4, 4, dark); px(6, 6, 1, 1, eye); px(9, 6, 1, 1, eye);
    px(3, 12, 2, 5, "#8a7fa0"); px(1, 8, 1, 12, "#6b5030"); px(0, 7, 3, 2, "#a080ff");
  } else {
    // goblin and kobold share a frame; kobold swaps ears for horns and a tail
    const skin = kind === "kobold" ? (boss ? "#b8452a" : "#9c4a2e") : (boss ? "#5f8a3a" : "#6e8b3d");
    const skinD = shade(skin, -0.12);
    const cloth = kind === "kobold" ? "#4a3a2a" : "#5b4226";
    if (kind === "goblin") {
      px(2, 6, 2, 1, skin); px(3, 7, 2, 1, skin); px(12, 6, 2, 1, skin); px(11, 7, 2, 1, skin);
    } else {
      px(5, 2, 1, 2, "#d8c8a0"); px(10, 2, 1, 2, "#d8c8a0");
      px(11, 19, 4, 1, skin); px(14, 18, 1, 1, skin);
    }
    px(5, 4, 6, 6, skin); px(6, 6, 1, 1, eye); px(9, 6, 1, 1, eye); px(7, 8, 2, 1, dark);
    px(4, 10, 8, 7, cloth); px(4, 14, 8, 1, dark);
    px(2, 10, 2, 6, skin); px(12, 10, 2, 6, skin);
    px(5, 17, 2, 6, skinD); px(9, 17, 2, 6, skinD);
    px(4, 23, 3, 1, dark); px(9, 23, 3, 1, dark);
    px(13, 3, 2, 8, "#6b4a2a"); px(13, 3, 2, 2, "#4a3018");
  }
  if (boss) {
    // crown and a bit of menace for the boss
    px(5, 0, 6, 2, "#d4a017"); px(5, 0, 1, 1, "#000"); px(7, 0, 2, 1, "#000"); px(10, 0, 1, 1, "#000");
    px(4, 2, 1, 2, "#e0d0a0"); px(11, 2, 1, 2, "#e0d0a0");
  }
  return toTexture(c, false);
}

function scaleUVs(geo: THREE.BufferGeometry, su: number, sv: number) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
}

interface CamState { cx: number; cz: number; angle: number }

interface Tween {
  from: CamState;
  to: CamState;
  t0: number;
  dur: number;
  done?: () => void;
}

export class DelveRetroRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(70, 1.6, 0.05, 60);
  private world = new THREE.Group();
  private torch: THREE.PointLight;
  private ambient: THREE.AmbientLight;
  private raf = 0;
  private disposed = false;
  private lastDraw = 0;
  private dirty = true;

  private themeKey: RetroThemeKey = "stone";
  private mats: Record<string, THREE.Material> = {};
  private textures: THREE.Texture[] = [];
  private worldTextures: THREE.Texture[] = [];
  private signature = "";
  private roomProps = new Map<string, THREE.Group>();
  private flickers: Array<{ light: THREE.PointLight; base: number; obj?: THREE.Object3D }> = [];

  private cam: CamState = { cx: 0, cz: 0, angle: 0 };
  private tween: Tween | null = null;
  private torchRadius = 14;

  constructor(private canvas: HTMLCanvasElement, theme: RetroThemeKey = "stone") {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "low-power" });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.Fog(0x000000, 3, 16);

    this.ambient = new THREE.AmbientLight(0x6a5a4a, 0.6);
    this.scene.add(this.ambient);
    this.torch = new THREE.PointLight(0xffb066, 2.6, 16, 1.1);
    this.scene.add(this.torch);
    this.scene.add(this.world);

    this.setTheme(theme);
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  setTheme(theme: RetroThemeKey) {
    if (theme === this.themeKey && Object.keys(this.mats).length) return;
    this.themeKey = theme;
    this.disposeMaterials();
    const t = THEMES[theme];
    const seed = hashString(theme);
    const tex = (x: THREE.Texture) => { this.textures.push(x); return x; };
    this.mats.wall = new THREE.MeshLambertMaterial({ map: tex(brickTexture(t, seed)), side: THREE.DoubleSide });
    this.mats.floor = new THREE.MeshLambertMaterial({ map: tex(floorTexture(t, seed + 1)) });
    this.mats.ceiling = new THREE.MeshLambertMaterial({ map: tex(noiseTexture(t.ceiling, seed + 2, 0.06)) });
    this.mats.wood = new THREE.MeshLambertMaterial({ map: tex(woodTexture(seed + 3)) });
    this.mats.stone = new THREE.MeshLambertMaterial({ map: tex(noiseTexture(shade(t.brick, -0.06), seed + 4, 0.05)) });
    this.mats.metal = new THREE.MeshLambertMaterial({ color: 0x777b80 });
    this.mats.gold = new THREE.MeshLambertMaterial({ color: 0xc9a227, emissive: 0x3a2a00 });
    this.mats.bone = new THREE.MeshLambertMaterial({ color: 0xd8d0bc });
    this.mats.plate = new THREE.MeshLambertMaterial({ map: tex(noiseTexture(shade(t.floor, -0.08), seed + 5, 0.1)) });
    this.signature = "";
  }

  /** Rebuild the dungeon geometry when the set of revealed or cleared rooms changes. */
  setDungeon(nodes: RetroNode[], clearedIds: string[]) {
    const sig = nodes.map((n) => n.nodeId).sort().join(",") + "|" + [...clearedIds].sort().join(",") + "|" + this.themeKey;
    if (sig === this.signature) return;
    this.signature = sig;
    this.clearWorld();

    const byCoord = new Map<string, RetroNode>();
    for (const n of nodes) byCoord.set(`${n.q},${n.r}`, n);
    const cleared = new Set(clearedIds);
    const drawnEdges = new Set<string>();

    const floorGeo = new THREE.CircleGeometry(SIZE, 6);
    floorGeo.rotateZ(Math.PI / 6);
    scaleUVs(floorGeo, (SIZE * 2) / TEX_WORLD, (SIZE * 2) / TEX_WORLD);
    const floorGeoDown = floorGeo.clone();
    floorGeo.rotateX(-Math.PI / 2);
    floorGeoDown.rotateX(Math.PI / 2);

    for (const n of nodes) {
      const c = roomCenter(n.q, n.r);
      const floor = new THREE.Mesh(floorGeo, this.mats.floor);
      floor.position.set(c.x, 0, c.z);
      const ceil = new THREE.Mesh(floorGeoDown, this.mats.ceiling);
      ceil.position.set(c.x, WALL_H, c.z);
      this.world.add(floor, ceil);

      for (let k = 0; k < 6; k++) {
        const d = HEX_DIRS[k];
        const nq = n.q + d.dq, nr = n.r + d.dr;
        const edgeKey = [`${n.q},${n.r}`, `${nq},${nr}`].sort().join("|");
        if (drawnEdges.has(edgeKey)) continue;
        drawnEdges.add(edgeKey);
        const other = byCoord.get(`${nq},${nr}`);
        const open = !!other && (n.adjacentNodes.includes(other.nodeId) || other.adjacentNodes.includes(n.nodeId));
        const a0 = ((60 * k - 30) * Math.PI) / 180;
        const a1 = ((60 * k + 30) * Math.PI) / 180;
        this.addWall(
          { x: c.x + SIZE * Math.cos(a0), z: c.z + SIZE * Math.sin(a0) },
          { x: c.x + SIZE * Math.cos(a1), z: c.z + SIZE * Math.sin(a1) },
          open,
        );
      }

      const props = this.buildProps(n, cleared.has(n.nodeId));
      props.position.set(c.x, 0, c.z);
      this.world.add(props);
      this.roomProps.set(n.nodeId, props);
    }
    this.dirty = true;
  }

  /** Torch strength follows the run's light ticks (20 is a fresh torch). */
  setLight(ticks: number) {
    const f = Math.max(0, Math.min(1, ticks / 20));
    this.torchRadius = 7 + 9 * f;
    const fog = this.scene.fog as THREE.Fog;
    fog.near = 1.5 + 2 * f;
    fog.far = 8 + 9 * f;
    this.torch.distance = this.torchRadius;
    this.ambient.intensity = 0.35 + 0.3 * f;
    this.dirty = true;
  }

  /** Put the camera in a room facing direction k, with no animation. */
  snapTo(q: number, r: number, k: number) {
    const c = roomCenter(q, r);
    this.tween = null;
    this.cam = { cx: c.x, cz: c.z, angle: (k * Math.PI) / 3 };
    this.showAllProps();
    this.dirty = true;
  }

  /** Turn to face direction k, the short way round. */
  turnTo(k: number, dur = 220) {
    const base = this.tween ? this.tween.to : this.cam;
    const target = (k * Math.PI) / 3;
    let delta = target - (((base.angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    this.startTween({ ...base, angle: base.angle + delta }, dur);
  }

  /** Walk toward the doorway ahead while the server decides whether the move is allowed. */
  beginStep(currentNodeId: string) {
    const base = this.tween ? this.tween.to : this.cam;
    const dist = BACK + APOTHEM * 0.75;
    this.startTween({ cx: base.cx + Math.cos(base.angle) * dist, cz: base.cz + Math.sin(base.angle) * dist, angle: base.angle }, 260);
    const props = this.roomProps.get(currentNodeId);
    if (props) props.visible = false;   // don't walk through the room's own furniture
  }

  /** Finish a step into the room at q,r. */
  completeStep(q: number, r: number) {
    const c = roomCenter(q, r);
    const angle = this.tween ? this.tween.to.angle : this.cam.angle;
    this.startTween({ cx: c.x, cz: c.z, angle }, 260, () => this.showAllProps());
  }

  /** The move was refused: back away from the doorway. */
  cancelStep(q: number, r: number) {
    const c = roomCenter(q, r);
    const angle = this.tween ? this.tween.to.angle : this.cam.angle;
    this.startTween({ cx: c.x, cz: c.z, angle }, 200, () => this.showAllProps());
  }

  resize(width: number, height: number) {
    if (width <= 0 || height <= 0) return;
    const aspect = width / height;
    const h = RENDER_LINES;
    const w = Math.max(160, Math.round(h * aspect));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.clearWorld();
    this.disposeMaterials();
    this.renderer.dispose();
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private startTween(to: CamState, dur: number, done?: () => void) {
    const prev = this.tween;
    this.tween = { from: { ...this.cam }, to, t0: performance.now(), dur, done };
    if (prev?.done && prev.done !== done) prev.done();
  }

  private showAllProps() {
    this.roomProps.forEach((g) => { g.visible = true; });
    this.dirty = true;
  }

  private loop(now: number) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);

    let moving = false;
    if (this.tween) {
      const t = Math.min(1, (now - this.tween.t0) / this.tween.dur);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const { from, to } = this.tween;
      this.cam = {
        cx: from.cx + (to.cx - from.cx) * e,
        cz: from.cz + (to.cz - from.cz) * e,
        angle: from.angle + (to.angle - from.angle) * e,
      };
      moving = true;
      if (t >= 1) {
        const done = this.tween.done;
        this.tween = null;
        done?.();
      }
    }

    // Between moves, redraw about 8 times a second for flicker: cheap at 200 lines
    // and it keeps the "static" feel of a stepped crawler.
    if (!moving && !this.dirty && now - this.lastDraw < 120) return;
    this.lastDraw = now;
    this.dirty = false;

    const flick = 0.88 + 0.12 * Math.sin(now * 0.013) * Math.sin(now * 0.0071 + 1.3);
    this.torch.intensity = 2.6 * flick;
    for (const f of this.flickers) {
      const s = 0.8 + 0.2 * Math.sin(now * 0.017 + f.base * 7) * Math.sin(now * 0.009 + f.base);
      f.light.intensity = f.base * s;
      if (f.obj) f.obj.scale.y = 0.85 + 0.25 * s;
    }

    const dx = Math.cos(this.cam.angle), dz = Math.sin(this.cam.angle);
    const bob = moving ? Math.abs(Math.sin(now * 0.025)) * 0.04 : 0;
    this.camera.position.set(this.cam.cx - dx * BACK, EYE + bob, this.cam.cz - dz * BACK);
    this.camera.lookAt(this.cam.cx + dx * 4, EYE - 0.15, this.cam.cz + dz * 4);
    this.torch.position.set(this.camera.position.x + dx * 0.3, EYE + 0.4, this.camera.position.z + dz * 0.3);

    this.renderer.render(this.scene, this.camera);
  }

  private addWall(p0: { x: number; z: number }, p1: { x: number; z: number }, door: boolean) {
    const len = Math.hypot(p1.x - p0.x, p1.z - p0.z);
    const g = new THREE.Group();
    g.position.set((p0.x + p1.x) / 2, 0, (p0.z + p1.z) / 2);
    g.rotation.y = -Math.atan2(p1.z - p0.z, p1.x - p0.x);

    const panel = (w: number, h: number, x: number, y: number) => {
      const geo = new THREE.PlaneGeometry(w, h);
      scaleUVs(geo, w / TEX_WORLD, h / TEX_WORLD);
      const m = new THREE.Mesh(geo, this.mats.wall);
      m.position.set(x, y, 0);
      g.add(m);
    };

    if (!door) {
      panel(len, WALL_H, 0, WALL_H / 2);
    } else {
      const side = (len - DOOR_W) / 2;
      panel(side, WALL_H, -(DOOR_W + side) / 2, WALL_H / 2);
      panel(side, WALL_H, (DOOR_W + side) / 2, WALL_H / 2);
      panel(DOOR_W, WALL_H - DOOR_H, 0, (WALL_H + DOOR_H) / 2);
      // timber frame gives the doorway some depth
      const post = new THREE.BoxGeometry(0.2, DOOR_H, 0.5);
      const l = new THREE.Mesh(post, this.mats.wood); l.position.set(-DOOR_W / 2, DOOR_H / 2, 0);
      const r = new THREE.Mesh(post, this.mats.wood); r.position.set(DOOR_W / 2, DOOR_H / 2, 0);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W + 0.4, 0.22, 0.5), this.mats.wood);
      beam.position.set(0, DOOR_H + 0.11, 0);
      g.add(l, r, beam);
    }
    this.world.add(g);
  }

  private sprite(kind: MonsterKind, boss: boolean, seed: number) {
    const tex = monsterTexture(kind, boss, seed);
    this.worldTextures.push(tex);
    const mat = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5, color: 0xb8b0a8, fog: true });
    const s = new THREE.Sprite(mat);
    const h = boss ? 2.2 : 1.35;
    s.scale.set(h * (16 / 24), h, 1);
    s.position.y = h / 2;
    return s;
  }

  private addLight(group: THREE.Group, color: number, intensity: number, dist: number, y: number, flickerObj?: THREE.Object3D) {
    const l = new THREE.PointLight(color, intensity, dist, 1.4);
    l.position.y = y;
    group.add(l);
    this.flickers.push({ light: l, base: intensity, obj: flickerObj });
    return l;
  }

  private buildProps(n: RetroNode, cleared: boolean): THREE.Group {
    const g = new THREE.Group();
    const rnd = mulberry32(hashString(n.nodeId));
    const theme = THEMES[this.themeKey];
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };

    switch (n.type) {
      case "encounter": {
        if (cleared) {
          for (let i = 0; i < 6; i++) {
            const b = box(0.35, 0.06, 0.08, this.mats.bone, (rnd() - 0.5) * 1.6, 0.03, (rnd() - 0.5) * 1.6);
            b.rotation.y = rnd() * Math.PI;
          }
        } else {
          const count = Math.max(1, Math.min(3, n.encounterData?.enemies?.length || 1 + Math.floor(rnd() * 2)));
          for (let i = 0; i < count; i++) {
            const s = this.sprite(theme.monster, false, hashString(n.nodeId) + i);
            const a = (i / count) * Math.PI * 2 + rnd();
            const rad = count === 1 ? 0 : 0.55;
            s.position.x = Math.cos(a) * rad;
            s.position.z = Math.sin(a) * rad;
            g.add(s);
          }
        }
        break;
      }
      case "boss": {
        // a low hex dais flanked by braziers; the boss stands on it
        const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.25, 6), this.mats.stone);
        dais.position.y = 0.125; dais.rotation.y = Math.PI / 6; g.add(dais);
        for (const side of [-1, 1]) {
          const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.1, 5), this.mats.metal);
          stand.position.set(side * 1.7, 0.55, 0.4); g.add(stand);
          const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.12, 0.2, 6), this.mats.metal);
          bowl.position.set(side * 1.7, 1.15, 0.4); g.add(bowl);
          if (!cleared) {
            const fl = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 5), new THREE.MeshBasicMaterial({ color: 0xff5a20 }));
            fl.position.set(side * 1.7, 1.42, 0.4); g.add(fl);
          }
        }
        if (!cleared) {
          const s = this.sprite(theme.monster, true, hashString(n.nodeId));
          s.position.y += 0.25;
          g.add(s);
          this.addLight(g, 0xff3a1a, 2.2, 7, 2.2);
        } else {
          this.addLight(g, 0x884422, 0.6, 5, 2.2);
        }
        break;
      }
      case "trap": {
        for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
          box(0.7, 0.05, 0.7, this.mats.plate, x * 0.78, 0.025, z * 0.78);
          if (!cleared && (x + z) % 2 === 0) {
            for (let i = 0; i < 4; i++) {
              const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.35, 4), this.mats.metal);
              spike.position.set(x * 0.78 + (i % 2 ? 0.15 : -0.15), 0.2, z * 0.78 + (i < 2 ? 0.15 : -0.15));
              g.add(spike);
            }
          }
        }
        break;
      }
      case "puzzle": {
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.0, 6), this.mats.stone);
        ped.position.y = 0.5; g.add(ped);
        const orbMat = new THREE.MeshLambertMaterial({ color: 0x9a6bff, emissive: cleared ? 0x1a0f33 : 0x6a3bff });
        const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), orbMat);
        orb.position.y = 1.3; g.add(orb);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(1.2, 1.35, 6),
          new THREE.MeshBasicMaterial({ color: cleared ? 0x2a1a44 : 0x8a5cff, side: THREE.DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
        if (!cleared) this.addLight(g, 0x8a5cff, 1.8, 6, 1.3);
        break;
      }
      case "lore": {
        // a six-sided standing stone, runes glowing on every face, so it reads from any angle
        const rt = runeTexture(hashString(n.nodeId));
        rt.wrapS = THREE.RepeatWrapping; rt.wrapT = THREE.RepeatWrapping; rt.repeat.set(3, 1);
        this.worldTextures.push(rt);
        const stoneMap = (this.mats.stone as THREE.MeshLambertMaterial).map;
        const obelisk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.4, 0.55, 2.1, 6),
          new THREE.MeshLambertMaterial({ map: stoneMap, emissive: 0x5a8cff, emissiveMap: rt }),
        );
        obelisk.position.y = 1.05;
        g.add(obelisk);
        this.addLight(g, 0x4f86ff, 1.0, 4.5, 1.4);
        break;
      }
      case "cache": {
        const a = box(0.7, 0.7, 0.7, this.mats.wood, -0.4, 0.35, 0.1); a.rotation.y = 0.3;
        const b = box(0.55, 0.55, 0.55, this.mats.wood, 0.45, 0.275, -0.2); b.rotation.y = -0.5;
        const c = box(0.5, 0.5, 0.5, this.mats.wood, -0.3, 0.95, 0.1); c.rotation.y = 0.8;
        const sack = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3, 0), new THREE.MeshLambertMaterial({ color: 0x8a7a55 }));
        sack.scale.set(1, 1.2, 1); sack.position.set(0.4, 0.33, 0.55); g.add(sack);
        break;
      }
      case "safe": {
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13, 0), this.mats.stone);
          st.position.set(Math.cos(a) * 0.45, 0.08, Math.sin(a) * 0.45); g.add(st);
        }
        for (let i = 0; i < 3; i++) {
          const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 5), this.mats.wood);
          log.rotation.z = Math.PI / 2; log.rotation.y = (i / 3) * Math.PI; log.position.y = 0.1; g.add(log);
        }
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 5), new THREE.MeshBasicMaterial({ color: 0xffa030 }));
        flame.position.y = 0.4; g.add(flame);
        const inner = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.4, 5), new THREE.MeshBasicMaterial({ color: 0xfff0a0 }));
        inner.position.y = 0.33; g.add(inner);
        this.addLight(g, 0xff9030, 3.0, 9, 0.8, flame);
        // bedroll
        box(0.6, 0.08, 1.4, new THREE.MeshLambertMaterial({ color: 0x5a3030 }), 1.2, 0.04, 0.4).rotation.y = 0.4;
        break;
      }
      case "entrance": {
        for (let i = 0; i < 4; i++) box(1.6, 0.25, 0.5, this.mats.stone, 0, 0.125 + i * 0.25, -0.6 + i * 0.5);
        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.6, 0.9, WALL_H, 6, 1, true),
          new THREE.MeshBasicMaterial({ color: 0x8fb0d0, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide }),
        );
        shaft.position.set(0, WALL_H / 2, 0.9); g.add(shaft);
        this.addLight(g, 0xa0c0ff, 1.4, 7, 2.6);
        g.rotation.y = rnd() * Math.PI * 2;
        break;
      }
      case "chest": {
        box(1.0, 0.55, 0.65, this.mats.wood, 0, 0.275, 0);
        box(1.04, 0.08, 0.69, this.mats.gold, 0, 0.5, 0);
        box(0.12, 0.2, 0.05, this.mats.gold, 0, 0.42, 0.34);
        const lid = new THREE.Group();
        lid.position.set(0, 0.55, -0.33);
        const lidBox = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 0.65), this.mats.wood);
        lidBox.position.set(0, 0.1, 0.325);
        lid.add(lidBox);
        if (cleared) lid.rotation.x = -1.2;
        g.add(lid);
        if (!cleared) this.addLight(g, 0xffd040, 1.2, 4, 1.0);
        g.rotation.y = rnd() * Math.PI * 2;
        break;
      }
    }
    return g;
  }

  private clearWorld() {
    this.flickers = [];
    this.roomProps.clear();
    const geos = new Set<THREE.BufferGeometry>();
    const own = new Set<THREE.Material>();
    const shared = new Set(Object.values(this.mats));
    this.world.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) geos.add(mesh.geometry);
      const m = (mesh as any).material as THREE.Material | THREE.Material[] | undefined;
      if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { if (!shared.has(x)) own.add(x); });
    });
    geos.forEach((g) => g.dispose());
    own.forEach((m) => m.dispose());
    this.worldTextures.forEach((t) => t.dispose());
    this.worldTextures = [];
    this.world.clear();
  }

  private disposeMaterials() {
    Object.values(this.mats).forEach((m) => m.dispose());
    this.mats = {};
    this.textures.forEach((t) => t.dispose());
    this.textures = [];
  }
}
