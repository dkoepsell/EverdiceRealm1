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
  // Tumbling die: wooden clacks with a little low body so they don't sound tinny.
  dice: (ctx, out) => {
    const t = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const s = t + i * 0.05 + Math.random() * 0.012;
      noise(ctx, out, { dur: 0.045, peak: 0.28, type: "bandpass", freq: 700 + Math.random() * 700, q: 1.8, start: s });
      tone(ctx, out, { freq: 140 + Math.random() * 60, type: "sine", peak: 0.12, attack: 0.002, decay: 0.04, start: s });
    }
    noise(ctx, out, { dur: 0.07, peak: 0.22, type: "bandpass", freq: 600, q: 1.6, start: t + 0.23 });
  },

  // Natural 20 — bright rising chime.
  diceCrit: (ctx, out) => arpeggio(ctx, out, [523.25, 659.25, 783.99, 1046.5], { type: "triangle", peak: 0.3, decay: 0.5, step: 0.08 }),

  // Natural 1 — a deflating downward slide.
  diceFumble: (ctx, out) => {
    tone(ctx, out, { freq: 330, freqEnd: 110, type: "sawtooth", peak: 0.24, attack: 0.02, decay: 0.55, start: ctx.currentTime });
  },

  // Weapon connects — layered thwack: sharp transient + meaty smack + low thump.
  hit: (ctx, out) => {
    const t = ctx.currentTime;
    noise(ctx, out, { dur: 0.02, peak: 0.5, type: "highpass", freq: 2500, start: t }); // crack of contact
    noise(ctx, out, { dur: 0.14, peak: 0.55, type: "lowpass", freq: 900, freqEnd: 220, start: t }); // body
    tone(ctx, out, { freq: 200, freqEnd: 70, type: "sine", peak: 0.7, attack: 0.004, decay: 0.22, start: t }); // low thump
    tone(ctx, out, { freq: 320, freqEnd: 120, type: "triangle", peak: 0.38, attack: 0.004, decay: 0.12, start: t }); // mid punch
  },

  // Critical hit — heavy boom, crunch, and a ringing metallic overtone.
  crit: (ctx, out) => {
    const t = ctx.currentTime;
    noise(ctx, out, { dur: 0.03, peak: 0.6, type: "highpass", freq: 2000, start: t });
    noise(ctx, out, { dur: 0.26, peak: 0.6, type: "lowpass", freq: 1400, freqEnd: 180, start: t }); // crunch
    tone(ctx, out, { freq: 180, freqEnd: 45, type: "sine", peak: 0.85, attack: 0.004, decay: 0.42, start: t }); // boom
    tone(ctx, out, { freq: 110, freqEnd: 50, type: "square", peak: 0.4, attack: 0.004, decay: 0.3, start: t });
    tone(ctx, out, { freq: 1318, type: "triangle", peak: 0.22, attack: 0.004, decay: 0.55, start: t + 0.02 }); // ring
    tone(ctx, out, { freq: 1567, type: "triangle", peak: 0.15, attack: 0.004, decay: 0.5, start: t + 0.03 });
  },

  // Swing and a miss — fuller whoosh with a low body, not just hiss.
  miss: (ctx, out) => {
    const t = ctx.currentTime;
    noise(ctx, out, { dur: 0.32, peak: 0.28, type: "bandpass", freq: 350, freqEnd: 2200, q: 0.6, start: t });
    tone(ctx, out, { freq: 420, freqEnd: 170, type: "sawtooth", peak: 0.12, attack: 0.02, decay: 0.28, start: t });
  },

  // Combat begins — cinematic stinger: deep drum hit, low brass stab stack, rising swell.
  combatStart: (ctx, out) => {
    const t = ctx.currentTime;
    tone(ctx, out, { freq: 150, freqEnd: 45, type: "sine", peak: 0.8, attack: 0.004, decay: 0.35, start: t }); // drum
    noise(ctx, out, { dur: 0.2, peak: 0.3, type: "lowpass", freq: 500, start: t });
    tone(ctx, out, { freq: 55, type: "sawtooth", peak: 0.4, attack: 0.03, decay: 0.9, start: t }); // brass stack A1/E2/A2
    tone(ctx, out, { freq: 82.41, type: "sawtooth", peak: 0.34, attack: 0.03, decay: 0.9, start: t });
    tone(ctx, out, { freq: 110, type: "sawtooth", peak: 0.26, attack: 0.03, decay: 0.9, start: t });
    tone(ctx, out, { freq: 220, freqEnd: 440, type: "triangle", peak: 0.18, attack: 0.5, decay: 0.5, start: t + 0.1 }); // tense rise
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
