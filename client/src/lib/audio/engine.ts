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

export interface AudioState {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

const isBrowser = typeof window !== "undefined";

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private state: AudioState = { master: 0.8, music: 0.5, sfx: 0.8, muted: false };

  /** Create the context + gain graph. No-op if already created or unavailable. */
  private init() {
    if (this.ctx || !isBrowser) return;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
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

  private applyState() {
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
