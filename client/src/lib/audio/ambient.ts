/**
 * Procedurally-synthesized ambient music beds (Web Audio API).
 *
 * Rather than ship licensed audio files, each "mood" is an evolving pad built from
 * detuned oscillators (a soft chord), slow amplitude LFOs for movement, and a
 * lowpass filter — atmospheric drone beds, not melodic tracks. Routed through the
 * engine's music bus so the music-volume slider and mute apply. Tasteful and subtle
 * by design; the engine crossfades between beds when the scene mood changes.
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
  lfoRate: number; // Hz, slow amplitude movement
  pulse?: number; // optional low pulse rate (Hz) — combat tension
  shimmer?: boolean; // faint high partial — eerie/mysterious
}

const MOOD_BEDS: Record<MoodKey, BedSpec> = {
  // Open, neutral, gently moving — default exploration.
  explore: { freqs: [130.81, 196.0, 261.63], type: "sine", cutoff: 900, detune: 6, lfoRate: 0.08 },
  // Warm, consonant — towns, downtime, social scenes.
  calm: { freqs: [146.83, 220.0, 293.66, 369.99], type: "sine", cutoff: 1100, detune: 5, lfoRate: 0.06 },
  // Minor, eerie, with a faint shimmer — puzzles, discoveries, dread.
  tension: { freqs: [123.47, 185.0, 246.94], type: "triangle", cutoff: 700, detune: 10, lfoRate: 0.12, shimmer: true },
  // Low, dissonant, slow pulse — combat.
  combat: { freqs: [98.0, 130.81, 146.83], type: "sawtooth", cutoff: 600, detune: 8, lfoRate: 0.2, pulse: 1.2 },
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
  const n = spec.freqs.length;

  spec.freqs.forEach((f, i) => {
    // Two detuned oscillators per note for a warmer, chorused pad.
    [-spec.detune, spec.detune].forEach((d) => {
      const osc = ctx.createOscillator();
      osc.type = spec.type;
      osc.frequency.value = f;
      osc.detune.value = d;

      const og = ctx.createGain();
      og.gain.value = 0.18 / n;

      // Slow tremolo so the pad breathes (rates differ per note to avoid phasing in lockstep).
      const lfo = ctx.createOscillator();
      lfo.frequency.value = spec.lfoRate * (1 + i * 0.13);
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.06 / n;
      lfo.connect(lfoGain);
      lfoGain.connect(og.gain);

      osc.connect(og);
      og.connect(lp);
      osc.start(now);
      lfo.start(now);
      stoppers.push((t) => { try { osc.stop(t); lfo.stop(t); } catch { /* already stopped */ } });
    });
  });

  if (spec.shimmer) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = spec.freqs[0] * 6;
    const og = ctx.createGain();
    og.gain.value = 0.025;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 0.02;
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
