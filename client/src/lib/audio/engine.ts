/**
 * Core audio engine — owns the single AudioContext and the gain graph that all
 * game audio routes through:
 *
 *     sfx synths  ─┐
 *                  ├─► sfxGain ──┐
 *     (music later)              ├─► masterGain ──► destination
 *                   musicGain ──┘
 *
 * Volumes are 0..1. Browsers block audio until a user gesture, so the context is
 * created lazily and resumed via unlock(); playSfx() also opportunistically resumes.
 *
 * This is a singleton (one AudioContext per tab). The React layer (use-audio.tsx)
 * pushes state in and triggers playback; it never touches Web Audio directly.
 */
import { SFX_SYNTHS, SfxName } from "./sfx";
import { buildBed, BedHandle, MoodKey } from "./ambient";

const BED_TARGET_GAIN = 0.85; // bed loudness into the music bus (then scaled by music/master)
const CROSSFADE_SECONDS = 3;

export interface AudioState {
  master: number;
  music: number;
  sfx: number;
  voice: number;
  muted: boolean;
}

const isBrowser = typeof window !== "undefined";

// A zero-length silent WAV. Playing this during a user gesture "unlocks" the voice
// element so later programmatic play() (after the async TTS fetch) is permitted.
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

function clampVol(v: number): number {
  return Math.max(0, Math.min(1, v));
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private state: AudioState = { master: 0.8, music: 0.5, sfx: 0.8, voice: 0.9, muted: false };
  // Voice narration plays through a plain HTMLAudioElement (progressive playback,
  // simple volume control) rather than the Web Audio graph.
  private voiceEl: HTMLAudioElement | null = null;
  private voicePrimed = false;
  private currentMood: MoodKey | null = null;
  private currentBed: BedHandle | null = null;

  /** Create the context + gain graph. No-op if already created or unavailable. */
  private init() {
    if (this.ctx || !isBrowser) return;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    // Master-bus compressor: glues layered impacts together and adds perceived
    // punch/loudness while preventing clipping when several SFX overlap.
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 24;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;
    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);
    this.applyState();
  }

  /** Resume the context after a user gesture (autoplay policy). */
  async unlock() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        /* ignore — will retry on next gesture/playback */
      }
    }
    this.primeVoice();
  }

  setState(partial: Partial<AudioState>) {
    this.state = { ...this.state, ...partial };
    this.applyState();
  }

  getState(): AudioState {
    return { ...this.state };
  }

  /** The bus SFX should connect to, or null if audio isn't available yet. */
  get sfxBus(): { ctx: AudioContext; out: AudioNode } | null {
    if (!this.ctx || !this.sfxGain) return null;
    return { ctx: this.ctx, out: this.sfxGain };
  }

  /** The bus ambient music will connect to (used by a later phase). */
  get musicBus(): { ctx: AudioContext; out: AudioNode } | null {
    if (!this.ctx || !this.musicGain) return null;
    return { ctx: this.ctx, out: this.musicGain };
  }

  playSfx(name: SfxName) {
    if (this.state.muted) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    const bus = this.sfxBus;
    if (!bus) return;
    const synth = SFX_SYNTHS[name];
    if (!synth) return;
    try {
      synth(bus.ctx, bus.out);
    } catch {
      /* a single failed effect must never break gameplay */
    }
  }

  /** Crossfade the ambient music bed to a new mood (no-op if already on it). */
  playAmbient(mood: MoodKey) {
    this.init();
    if (!this.ctx || !this.musicGain) return;
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    if (this.currentMood === mood && this.currentBed) return;

    const now = this.ctx.currentTime;
    const old = this.currentBed;
    if (old) {
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(Math.max(old.gain.gain.value, 0.0001), now);
      old.gain.gain.exponentialRampToValueAtTime(0.0001, now + CROSSFADE_SECONDS);
      old.stop(now + CROSSFADE_SECONDS + 0.3);
    }

    const bed = buildBed(this.ctx, this.musicGain, mood);
    bed.gain.gain.setValueAtTime(0.0001, now);
    bed.gain.gain.exponentialRampToValueAtTime(BED_TARGET_GAIN, now + CROSSFADE_SECONDS);
    this.currentBed = bed;
    this.currentMood = mood;
  }

  /** Fade out and stop ambient music (e.g. when leaving a campaign). */
  stopAmbient() {
    if (!this.ctx || !this.currentBed) return;
    const now = this.ctx.currentTime;
    const old = this.currentBed;
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(Math.max(old.gain.gain.value, 0.0001), now);
    old.gain.gain.exponentialRampToValueAtTime(0.0001, now + 2);
    old.stop(now + 2.3);
    this.currentBed = null;
    this.currentMood = null;
  }

  private ensureVoiceEl(): HTMLAudioElement | null {
    if (!isBrowser) return null;
    if (!this.voiceEl) {
      this.voiceEl = new Audio();
      this.voiceEl.preload = "auto";
    }
    return this.voiceEl;
  }

  /**
   * Play a silent clip during a user gesture so the browser grants the voice
   * element playback permission. Without this, programmatic play() after the
   * async TTS fetch (or from auto-narrate) is blocked by autoplay policy.
   */
  primeVoice() {
    const el = this.ensureVoiceEl();
    if (!el || this.voicePrimed) return;
    this.voicePrimed = true;
    try {
      el.src = SILENT_WAV;
      const p = el.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          el.pause();
          el.currentTime = 0;
        }).catch(() => {});
      }
    } catch {
      /* ignore — playback will be retried on the real narration */
    }
  }

  /** Play narration audio from a URL through the voice channel. */
  playVoice(url: string, handlers?: { onEnded?: () => void; onError?: () => void }) {
    const el = this.ensureVoiceEl();
    if (!el) return;
    el.onended = null;
    el.onerror = null;
    el.pause();
    el.src = url;
    el.volume = this.state.muted ? 0 : clampVol(this.state.master * this.state.voice);
    el.onended = () => handlers?.onEnded?.();
    el.onerror = () => handlers?.onError?.();
    el.play().catch(() => handlers?.onError?.());
  }

  stopVoice() {
    if (!this.voiceEl) return;
    this.voiceEl.pause();
    try {
      this.voiceEl.currentTime = 0;
    } catch {
      /* ignore */
    }
  }

  private applyState() {
    // Voice volume rides on a plain media element, independent of the Web Audio graph.
    if (this.voiceEl) {
      this.voiceEl.volume = this.state.muted ? 0 : clampVol(this.state.master * this.state.voice);
    }
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const master = this.state.muted ? 0 : this.state.master;
    // setTargetAtTime gives a quick, click-free ramp.
    this.masterGain.gain.setTargetAtTime(master, now, 0.015);
    this.sfxGain.gain.setTargetAtTime(this.state.sfx, now, 0.015);
    this.musicGain.gain.setTargetAtTime(this.state.music, now, 0.015);
  }
}

export const audioEngine = new AudioEngine();
