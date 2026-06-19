/**
 * AdventureCoverArt — always renders something visual for a Trading Post adventure.
 *
 * If a real (AI-generated / uploaded) cover image exists it is shown. Otherwise a
 * deterministic, genre-themed procedural SVG is generated from a stable seed, so every
 * campaign in the Trading Post always displays cover art rather than a bare placeholder.
 * The server lazily backfills real AI art on view; until then this fills the gap and it
 * stays stable per-adventure (same seed → same art).
 */

interface AdventureCoverArtProps {
  coverImageUrl?: string | null;
  title: string;
  /** Stable seed (adventure id). Falls back to the title when absent. */
  seed?: string | number;
  genre?: string | null;
  className?: string;
}

type Palette = {
  sky: [string, string];
  hills: [string, string, string];
  body: string;
  particle: string;
};

const PALETTES: Record<string, Palette> = {
  fantasy: { sky: ["#3b1d63", "#7c2d12"], hills: ["#1e1b4b", "#312e81", "#4c1d95"], body: "#fbbf24", particle: "#fde68a" },
  horror: { sky: ["#1a0606", "#450a0a"], hills: ["#0c0a09", "#1c1917", "#3f0a0a"], body: "#ef4444", particle: "#fca5a5" },
  mystery: { sky: ["#0f172a", "#1e1b4b"], hills: ["#020617", "#0f172a", "#312e81"], body: "#818cf8", particle: "#c7d2fe" },
  "sci-fi": { sky: ["#042f2e", "#083344"], hills: ["#022c22", "#064e3b", "#0e7490"], body: "#22d3ee", particle: "#a5f3fc" },
  comedy: { sky: ["#7c2d12", "#a16207"], hills: ["#9a3412", "#c2410c", "#ca8a04"], body: "#fde047", particle: "#fef9c3" },
};

const DEFAULT_PALETTE: Palette = PALETTES.fantasy;

/** Deterministic string → seeded PRNG (mulberry32 with an xmur3-style hash). */
function makePRNG(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 400;
const H = 240;

/** Build a jagged horizon polygon spanning the full width at a given base height. */
function hillPath(rng: () => number, baseY: number, jitter: number): string {
  const points: string[] = [`0,${H}`];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const x = (W / steps) * i;
    const y = baseY + (rng() - 0.5) * jitter;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  points.push(`${W},${H}`);
  return points.join(" ");
}

function ProceduralCover({ seed, genre, className }: { seed: string; genre?: string | null; className?: string }) {
  const palette = (genre && PALETTES[genre]) || DEFAULT_PALETTE;
  const rng = makePRNG(seed);
  const gradId = `cover-sky-${seed.replace(/[^a-z0-9]/gi, "")}`;

  const bodyX = 60 + rng() * 280;
  const bodyY = 40 + rng() * 50;
  const bodyR = 22 + rng() * 18;

  const stars = Array.from({ length: 18 }, () => ({
    x: rng() * W,
    y: rng() * (H * 0.6),
    r: 0.6 + rng() * 1.4,
    o: 0.3 + rng() * 0.6,
  }));

  const hills = [
    { d: hillPath(rng, H * 0.62, 36), fill: palette.hills[0] },
    { d: hillPath(rng, H * 0.74, 30), fill: palette.hills[1] },
    { d: hillPath(rng, H * 0.86, 24), fill: palette.hills[2] },
  ];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label="Procedurally generated adventure cover art"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.sky[0]} />
          <stop offset="100%" stopColor={palette.sky[1]} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${gradId})`} />
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={palette.particle} opacity={s.o} />
      ))}
      <circle cx={bodyX} cy={bodyY} r={bodyR * 1.8} fill={palette.body} opacity={0.12} />
      <circle cx={bodyX} cy={bodyY} r={bodyR} fill={palette.body} opacity={0.85} />
      {hills.map((h, i) => (
        <polygon key={i} points={h.d} fill={h.fill} />
      ))}
    </svg>
  );
}

export function AdventureCoverArt({ coverImageUrl, title, seed, genre, className }: AdventureCoverArtProps) {
  if (coverImageUrl) {
    return <img src={coverImageUrl} alt={title} className={className ?? "w-full h-full object-cover"} />;
  }
  return (
    <ProceduralCover
      seed={String(seed ?? title ?? "everdice")}
      genre={genre}
      className={className ?? "w-full h-full object-cover"}
    />
  );
}
