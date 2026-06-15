/**
 * Procedurally-synthesized ambient music beds (Web Audio API).
 *
 * Rather than ship licensed audio files, each "mood" is an evolving pad. Each chord
 * tone (plus a quieter octave partial) runs through its OWN slow swell LFO at a
 * slightly different rate, so the audible blend of tones constantly shifts in and
 * out — overlapping, drifting harmony rather than a static chord. A slow lowpass
 * sweep adds timbral movement. Routed through the engine's music bus so the
 * music-volume slider and mute apply. Subtle by design; the engine crossfades
 * between beds when the scene mood changes.
 *
 * To use real CC0 tracks later, the engine can resolve a mood to a file URL and play
 * that through the music bus instead of buildBed().
 */
export type MoodKey = "explore" | "combat" | "tension" | "calm";

interface BedSpec {
  freqs: number[]; // chord, in Hz
  type: OscillatorType;
  cutoff: number; // lowpass cutoff (Hz)
  detune: number; // ± cents per note, for warmth
  lfoRate: number; // base Hz for the per-tone swell (varied ±50% per voice)
  pulse?: number; // optional low pulse rate (Hz) — combat tension
  shimmer?: boolean; // faint high partial — eerie/mysterious
}

const MOOD_BEDS: Record<MoodKey, BedSpec> = {
  // Open, neutral, gently moving — default exploration.
  explore: { freqs: [130.81, 196.0, 261.63], type: "sine", cutoff: 900, detune: 6, lfoRate: 0.08 },
  // Warm, consonant — towns, downtime, social scenes.
  calm: { freqs: [146.83, 220.0, 293.66, 369.99], type: "sine", cutoff: 1100, detune: 5, lfoRate: 0.07 },
  // Minor, eerie, with a faint shimmer — puzzles, discoveries, dread.
  tension: { freqs: [123.47, 185.0, 246.94, 329.63], type: "triangle", cutoff: 700, detune: 10, lfoRate: 0.13, shimmer: true },
  // Low, dissonant, slow pulse — combat.
  combat: { freqs: [98.0, 130.81, 146.83, 196.0], type: "sawtooth", cutoff: 600, detune: 8, lfoRate: 0.18, pulse: 1.2 },
};

export interface BedHandle {
  gain: GainNode; // bed master gain — engine ramps this for crossfades
  stop: (at: number) => void; // stop all oscillators at the given context time
}

/** Build a playing ambient bed for a mood, connected to `out`. Starts near-silent;
 *  the engine ramps `gain` up. */
export function buildBed(ctx: AudioContext, out: AudioNode, mood: MoodKey): BedHandle {
  const spec = MOOD_BEDS[mood];
  const now = ctx.currentTime;

  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  gain.connect(out);

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = spec.cutoff;
  lp.connect(gain);

  const stoppers: Array<(t: number) => void> = [];

  // Slow lowpass sweep — timbral movement so the pad doesn't sit still.
  const filtLfo = ctx.createOscillator();
  filtLfo.frequency.value = 0.035 + Math.random() * 0.03;
  const filtAmt = ctx.createGain();
  filtAmt.gain.value = spec.cutoff * 0.35;
  filtLfo.connect(filtAmt);
  filtAmt.connect(lp.frequency);
  filtLfo.start(now);
  stoppers.push((t) => { try { filtLfo.stop(t); } catch { /* */ } });

  // Voices = chord tones + a quieter octave-up partial each → more tones to overlap.
  const voices: Array<{ freq: number; weight: number }> = [];
  spec.freqs.forEach((f) => {
    voices.push({ freq: f, weight: 1 });
    voices.push({ freq: f * 2, weight: 0.5 });
  });
  const vCount = voices.length;

  voices.forEach((v) => {
    // Two detuned oscillators per voice for a warm, chorused tone.
    [-spec.detune, spec.detune].forEach((d) => {
      const osc = ctx.createOscillator();
      osc.type = spec.type;
      osc.frequency.value = v.freq;
      osc.detune.value = d;

      const og = ctx.createGain();
      const base = (0.13 / vCount) * v.weight;
      og.gain.value = base;

      // Independent slow swell at a varied rate so this tone fades in/out on its own
      // cycle — depth ≈ base means it nearly disappears at the trough, so the chord's
      // audible voicing keeps changing (overlapping, evolving).
      const lfo = ctx.createOscillator();
      lfo.frequency.value = spec.lfoRate * (0.5 + Math.random());
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = base * 0.95;
      lfo.connect(lfoGain);
      lfoGain.connect(og.gain);

      // Faint slow pitch drift for extra life.
      const driftLfo = ctx.createOscillator();
      driftLfo.frequency.value = 0.02 + Math.random() * 0.04;
      const driftAmt = ctx.createGain();
      driftAmt.gain.value = 3 + Math.random() * 4; // cents
      driftLfo.connect(driftAmt);
      driftAmt.connect(osc.detune);

      osc.connect(og);
      og.connect(lp);
      osc.start(now);
      lfo.start(now);
      driftLfo.start(now);
      stoppers.push((t) => { try { osc.stop(t); lfo.stop(t); driftLfo.stop(t); } catch { /* */ } });
    });
  });

  if (spec.shimmer) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = spec.freqs[0] * 6;
    const og = ctx.createGain();
    og.gain.value = 0.025;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05 + Math.random() * 0.05;
    const lg = ctx.createGain();
    lg.gain.value = 0.022;
    lfo.connect(lg);
    lg.connect(og.gain);
    osc.connect(og);
    og.connect(gain); // bypass lowpass so the shimmer stays airy
    osc.start(now);
    lfo.start(now);
    stoppers.push((t) => { try { osc.stop(t); lfo.stop(t); } catch { /* */ } });
  }

  if (spec.pulse) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = spec.freqs[0] / 2;
    const pg = ctx.createGain();
    pg.gain.value = 0.0001;
    const pulseLfo = ctx.createOscillator();
    pulseLfo.type = "sine";
    pulseLfo.frequency.value = spec.pulse;
    const pulseAmt = ctx.createGain();
    pulseAmt.gain.value = 0.09;
    pulseLfo.connect(pulseAmt);
    pulseAmt.connect(pg.gain);
    osc.connect(pg);
    pg.connect(lp);
    osc.start(now);
    pulseLfo.start(now);
    stoppers.push((t) => { try { osc.stop(t); pulseLfo.stop(t); } catch { /* */ } });
  }

  return {
    gain,
    stop: (at: number) => stoppers.forEach((s) => s(at)),
  };
}
