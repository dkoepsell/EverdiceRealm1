/**
 * React layer over the audio engine: an AudioProvider that holds user volume/mute
 * settings (persisted to localStorage), pushes them into the engine, unlocks audio
 * on the first user gesture, and exposes useAudio() for playback + controls.
 *
 * Settings are intentionally client-local (localStorage) for now — no schema change
 * or DB round-trip. Cross-device sync can be layered on later.
 */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { audioEngine, AudioState } from "@/lib/audio/engine";
import { SfxName } from "@/lib/audio/sfx";

const STORAGE_KEY = "everdice:audio";
const DEFAULTS: AudioState = { master: 0.8, music: 0.5, sfx: 0.8, muted: false };

function clamp01(v: unknown, fallback: number): number {
  return typeof v === "number" && isFinite(v) && v >= 0 && v <= 1 ? v : fallback;
}

function loadState(): AudioState {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw);
    return {
      master: clamp01(p.master, DEFAULTS.master),
      music: clamp01(p.music, DEFAULTS.music),
      sfx: clamp01(p.sfx, DEFAULTS.sfx),
      muted: typeof p.muted === "boolean" ? p.muted : DEFAULTS.muted,
    };
  } catch {
    return DEFAULTS;
  }
}

interface AudioContextValue extends AudioState {
  setMaster: (v: number) => void;
  setMusic: (v: number) => void;
  setSfx: (v: number) => void;
  setMuted: (b: boolean) => void;
  toggleMute: () => void;
  playSfx: (name: SfxName) => void;
}

const AudioCtx = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AudioState>(loadState);

  // Sync settings into the engine and persist them.
  useEffect(() => {
    audioEngine.setState(state);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage may be unavailable (private mode) — settings just won't persist */
    }
  }, [state]);

  // Resume the AudioContext on the first user interaction (autoplay policy).
  useEffect(() => {
    const unlock = () => {
      audioEngine.unlock();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const update = useCallback((patch: Partial<AudioState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const value: AudioContextValue = {
    ...state,
    setMaster: (v) => update({ master: v }),
    setMusic: (v) => update({ music: v }),
    setSfx: (v) => update({ sfx: v }),
    setMuted: (b) => update({ muted: b }),
    toggleMute: () => setState((s) => ({ ...s, muted: !s.muted })),
    playSfx: (name) => audioEngine.playSfx(name),
  };

  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>;
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("useAudio must be used within an AudioProvider");
  return ctx;
}
