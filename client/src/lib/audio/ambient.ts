/**
 * Procedurally-synthesized ambient music beds (Web Audio API).
 *
 * Each "mood" is an evolving pad that moves through a CHORD PROGRESSION: the
 * oscillators glide between chords every ~chordDur seconds, so the harmony actually
 * changes over time (not a single static chord). On top of that, each tone has its
 * own gentle swell, a faint pitch drift, and the whole bed runs through a slow
 * lowpass sweep. Routed through the engine's music bus so the music-volume slider
 * and mute apply. Subtle by design; the engine crossfades between beds on mood change.
 *
 * To use real CC0 tracks later, the engine can resolve a mood to a file URL and play
 * that through the music bus instead of buildBed().
 */
export type MoodKey = "explore" | "combat" | "tension" | "calm";

interface BedSpec {
  chords: number[][]; // progression — each chord is 3 note frequencies (Hz)
  type: OscillatorType;
  cutoff: number; // lowpass cutoff (Hz)
  detune: number; // ± cents per note, for warmth
  lfoRate: number; // base Hz for the per-tone swell
  chordDur: number; // seconds each chord is held before gliding to the next
  pulse?: number; // optional low pulse rate (Hz) — combat tension
  shimmer?: boolean; // faint high partial — eerie/mysterious
}

// Note frequencies used below (Hz): C3 130.81, D3 146.83, E3 164.81, F3 174.61,
// G3 196.00, A3 220.00, B3 246.94, C4 261.63, D4 293.66, E4 329.63, F4 349.23,
// G4 392.00, A4 440, F#3 185.00, C#4 277.18, A2 110, Bb2 116.54, B2 123.47,
// G2 98.00, E3 164.81, Bb3 233.08, F#4 369.99.
const MOOD_BEDS: Record<MoodKey, BedSpec> = {
  // Warm, open progression (C – Am – F – G).
  explore: {
    chords: [[130.81, 196.0, 261.63], [110.0, 164.81, 220.0], [174.61, 261.63, 349.23], [196.0, 293.66, 392.0]],
    type: "sine", cutoff: 950, detune: 6, lfoRate: 0.08, chordDur: 16,
  },
  // Consonant, gentle (D – G – A – D).
  calm: {
    chords: [[146.83, 220.0, 293.66], [196.0, 293.66, 392.0], [220.0, 329.63, 440.0], [146.83, 220.0, 293.66]],
    type: "sine", cutoff: 1150, detune: 5, lfoRate: 0.07, chordDur: 20,
  },
  // Minor, drifting, uneasy (Bm – G – Em – F#), with a shimmer.
  tension: {
    chords: [[123.47, 185.0, 246.94], [196.0, 293.66, 392.0], [164.81, 246.94, 329.63], [185.0, 277.18, 369.99]],
    type: "triangle", cutoff: 720, detune: 10, lfoRate: 0.12, chordDur: 13, shimmer: true,
  },
  // Low, dark, chromatic tension (Am – Bb – G – Am), slow pulse.
  combat: {
    chords: [[110.0, 164.81, 220.0], [116.54, 174.61, 233.08], [98.0, 146.83, 196.0], [110.0, 164.81, 220.0]],
    type: "sawtooth", cutoff: 620, detune: 8, lfoRate: 0.18, chordDur: 10, pulse: 1.2,
  },
};

export interface BedHandle {
  gain: GainNode; // bed master gain — engine ramps this for crossfades
  stop: (at: number) => void; // stop progression + all oscillators
}

export function buildBed(ctx: AudioContext, out: AudioNode, mood: MoodKey): BedHandle {
  const spec = MOOD_BEDS[mood];
  const now = ctx.currentTime;
  const chords = spec.chords;

  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  gain.connect(out);

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = spec.cutoff;
  lp.connect(gain);

  const stoppers: Array<(t: number) => void> = [];
  // Each tuned oscillator knows how to compute its target frequency for a given chord,
  // so the whole bed can glide to the next chord in the progression.
  const tuned: Array<{ osc: OscillatorNode; freqFor: (chord: number[]) => number }> = [];

  // Slow lowpass sweep — timbral movement.
  const filtLfo = ctx.createOscillator();
  filtLfo.frequency.value = 0.035 + Math.random() * 0.03;
  const filtAmt = ctx.createGain();
  filtAmt.gain.value = spec.cutoff * 0.35;
  filtLfo.connect(filtAmt);
  filtAmt.connect(lp.frequency);
  filtLfo.start(now);
  stoppers.push((t) => { try { filtLfo.stop(t); } catch { /* */ } });

  // Voices = each chord tone, plus a quieter octave-up partial.
  const voices: Array<{ noteIndex: number; octave: number; weight: number }> = [];
  for (let i = 0; i < 3; i++) {
    voices.push({ noteIndex: i, octave: 1, weight: 1 });
    voices.push({ noteIndex: i, octave: 2, weight: 0.42 });
  }
  const vCount = voices.length;

  voices.forEach((v) => {
    [-spec.detune, spec.detune].forEach((d) => {
      const osc = ctx.createOscillator();
      osc.type = spec.type;
      osc.frequency.value = chords[0][v.noteIndex] * v.octave;
      osc.detune.value = d;

      const og = ctx.createGain();
      const base = (0.13 / vCount) * v.weight;
      og.gain.value = base;

      // Gentle swell so tones breathe (shallower now — the chord changes carry the movement).
      const lfo = ctx.createOscillator();
      lfo.frequency.value = spec.lfoRate * (0.6 + Math.random() * 0.8);
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = base * 0.5;
      lfo.connect(lfoGain);
      lfoGain.connect(og.gain);

      osc.connect(og);
      og.connect(lp);
      osc.start(now);
      lfo.start(now);
      stoppers.push((t) => { try { osc.stop(t); lfo.stop(t); } catch { /* */ } });
      tuned.push({ osc, freqFor: (c) => c[v.noteIndex] * v.octave });
    });
  });

  if (spec.shimmer) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = chords[0][2] * 4;
    const og = ctx.createGain();
    og.gain.value = 0.022;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05 + Math.random() * 0.05;
    const lg = ctx.createGain();
    lg.gain.value = 0.02;
    lfo.connect(lg);
    lg.connect(og.gain);
    osc.connect(og);
    og.connect(gain); // airy, bypass lowpass
    osc.start(now);
    lfo.start(now);
    stoppers.push((t) => { try { osc.stop(t); lfo.stop(t); } catch { /* */ } });
    tuned.push({ osc, freqFor: (c) => c[2] * 4 });
  }

  if (spec.pulse) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = chords[0][0] / 2;
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
    tuned.push({ osc, freqFor: (c) => c[0] / 2 });
  }

  // Walk the progression: glide every tuned oscillator to the next chord's notes.
  let chordIdx = 0;
  const advance = () => {
    chordIdx = (chordIdx + 1) % chords.length;
    const c = chords[chordIdx];
    const t = ctx.currentTime;
    tuned.forEach((tn) => {
      tn.osc.frequency.cancelScheduledValues(t);
      tn.osc.frequency.setTargetAtTime(tn.freqFor(c), t, 2.5); // smooth ~7s glide between chords
    });
  };
  const interval = setInterval(advance, spec.chordDur * 1000);

  return {
    gain,
    stop: (at: number) => {
      clearInterval(interval);
      stoppers.forEach((s) => s(at));
    },
  };
}
