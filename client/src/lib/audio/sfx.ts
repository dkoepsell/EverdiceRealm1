/**
 * Procedurally synthesized sound effects (Web Audio API).
 *
 * These are authored from oscillators/noise rather than sampled audio files, so
 * they carry zero licensing/provenance risk and add no binary weight to the repo.
 * Each synth schedules its own nodes against the shared SFX gain bus and lets them
 * stop/GC on their own. The engine (see engine.ts) owns the AudioContext lifecycle.
 */

export type SfxName =
  | "dice"
  | "diceCrit"
  | "diceFumble"
  | "hit"
  | "crit"
  | "miss"
  | "combatStart"
  | "victory"
  | "defeat"
  | "reward"
  | "narrate";

type Synth = (ctx: AudioContext, out: AudioNode) => void;

const MIN_GAIN = 0.0001;

interface ToneOpts {
  freq: number;
  type?: OscillatorType;
  peak?: number;
  attack?: number;
  decay?: number;
  start: number;
  freqEnd?: number;
}

/** A single enveloped oscillator tone, optionally sweeping in frequency. */
function tone(ctx: AudioContext, out: AudioNode, o: ToneOpts) {
  const { freq, type = "sine", peak = 0.3, attack = 0.005, decay = 0.2, start, freqEnd } = o;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, MIN_GAIN), start + attack + decay);

  const g = ctx.createGain();
  g.gain.setValueAtTime(MIN_GAIN, start);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, MIN_GAIN), start + attack);
  g.gain.exponentialRampToValueAtTime(MIN_GAIN, start + attack + decay);

  osc.connect(g);
  g.connect(out);
  osc.start(start);
  osc.stop(start + attack + decay + 0.05);
}

interface NoiseOpts {
  dur?: number;
  peak?: number;
  type?: BiquadFilterType;
  freq?: number;
  freqEnd?: number;
  q?: number;
  start: number;
}

/** A filtered burst of white noise — the basis for clacks, impacts and whooshes. */
function noise(ctx: AudioContext, out: AudioNode, o: NoiseOpts) {
  const { dur = 0.2, peak = 0.3, type = "lowpass", freq = 2000, freqEnd, q = 1, start } = o;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.frequency.setValueAtTime(freq, start);
  if (freqEnd) filt.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, MIN_GAIN), start + dur);
  filt.Q.value = q;

  const g = ctx.createGain();
  g.gain.setValueAtTime(Math.max(peak, MIN_GAIN), start);
  g.gain.exponentialRampToValueAtTime(MIN_GAIN, start + dur);

  src.connect(filt);
  filt.connect(g);
  g.connect(out);
  src.start(start);
  src.stop(start + dur + 0.05);
}

/** Play an ascending/descending sequence of tones (fanfares, stingers). */
function arpeggio(ctx: AudioContext, out: AudioNode, freqs: number[], opts: { type?: OscillatorType; peak?: number; decay?: number; step?: number } = {}) {
  const { type = "triangle", peak = 0.28, decay = 0.4, step = 0.09 } = opts;
  const t0 = ctx.currentTime;
  freqs.forEach((freq, i) => tone(ctx, out, { freq, type, peak, attack: 0.008, decay, start: t0 + i * step }));
}

export const SFX_SYNTHS: Record<SfxName, Synth> = {
  // Tumbling die: a few quick filtered clacks that settle.
  dice: (ctx, out) => {
    const t = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      noise(ctx, out, { dur: 0.04, peak: 0.22, type: "bandpass", freq: 1100 + Math.random() * 900, q: 2.5, start: t + i * 0.05 + Math.random() * 0.012 });
    }
    noise(ctx, out, { dur: 0.06, peak: 0.18, type: "bandpass", freq: 850, q: 2, start: t + 0.23 });
  },

  // Natural 20 — bright rising chime.
  diceCrit: (ctx, out) => arpeggio(ctx, out, [523.25, 659.25, 783.99, 1046.5], { type: "triangle", peak: 0.3, decay: 0.5, step: 0.08 }),

  // Natural 1 — a deflating downward slide.
  diceFumble: (ctx, out) => {
    tone(ctx, out, { freq: 330, freqEnd: 110, type: "sawtooth", peak: 0.24, attack: 0.02, decay: 0.55, start: ctx.currentTime });
  },

  // Weapon connects.
  hit: (ctx, out) => {
    const t = ctx.currentTime;
    noise(ctx, out, { dur: 0.12, peak: 0.4, type: "lowpass", freq: 1800, freqEnd: 320, start: t });
    tone(ctx, out, { freq: 160, freqEnd: 60, type: "sine", peak: 0.4, attack: 0.004, decay: 0.18, start: t });
  },

  // Critical hit — heavier impact with a metallic ring.
  crit: (ctx, out) => {
    const t = ctx.currentTime;
    noise(ctx, out, { dur: 0.18, peak: 0.5, type: "lowpass", freq: 2600, freqEnd: 300, start: t });
    tone(ctx, out, { freq: 120, freqEnd: 48, type: "square", peak: 0.38, attack: 0.004, decay: 0.28, start: t });
    tone(ctx, out, { freq: 1280, type: "triangle", peak: 0.2, attack: 0.004, decay: 0.45, start: t + 0.02 });
  },

  // Swing and a miss — airy whoosh.
  miss: (ctx, out) => {
    noise(ctx, out, { dur: 0.3, peak: 0.16, type: "bandpass", freq: 500, freqEnd: 2600, q: 0.7, start: ctx.currentTime });
  },

  // Combat begins — low tense drone hit.
  combatStart: (ctx, out) => {
    const t = ctx.currentTime;
    tone(ctx, out, { freq: 110, type: "sawtooth", peak: 0.32, attack: 0.02, decay: 0.7, start: t });
    tone(ctx, out, { freq: 164.81, type: "sawtooth", peak: 0.26, attack: 0.02, decay: 0.7, start: t });
    noise(ctx, out, { dur: 0.5, peak: 0.14, type: "lowpass", freq: 420, start: t });
  },

  // Encounter won.
  victory: (ctx, out) => arpeggio(ctx, out, [523.25, 659.25, 783.99, 1046.5], { type: "triangle", peak: 0.3, decay: 0.45, step: 0.12 }),

  // Party defeated / downed.
  defeat: (ctx, out) => arpeggio(ctx, out, [392, 329.63, 261.63, 196], { type: "sawtooth", peak: 0.26, decay: 0.5, step: 0.14 }),

  // Loot / XP / level-up sparkle.
  reward: (ctx, out) => arpeggio(ctx, out, [659.25, 783.99, 987.77, 1318.5], { type: "sine", peak: 0.24, decay: 0.35, step: 0.07 }),

  // Subtle page-turn cue when fresh narration arrives.
  narrate: (ctx, out) => {
    noise(ctx, out, { dur: 0.25, peak: 0.07, type: "highpass", freq: 3000, start: ctx.currentTime });
  },
};
