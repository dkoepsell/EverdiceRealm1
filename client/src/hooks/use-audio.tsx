/**
 * React layer over the audio engine: an AudioProvider that holds user volume/mute
 * settings (persisted to localStorage), pushes them into the engine, unlocks audio
 * on the first user gesture, and exposes useAudio() for playback + controls.
 *
 * Also drives TTS voice narration: narrate(text) requests audio from /api/tts and
 * plays it through the engine's voice channel, tracking idle/loading/playing state.
 *
 * Settings are intentionally client-local (localStorage) for now — no schema change
 * or DB round-trip. Cross-device sync can be layered on later.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { audioEngine, AudioState } from "@/lib/audio/engine";
import { SfxName } from "@/lib/audio/sfx";
import { MoodKey } from "@/lib/audio/ambient";
import { apiRequest } from "@/lib/queryClient";

const STORAGE_KEY = "everdice:audio";

interface PersistedSettings extends AudioState {
  autoNarrate: boolean;
}

const DEFAULTS: PersistedSettings = {
  master: 0.8,
  music: 0.5,
  sfx: 0.8,
  voice: 0.9,
  muted: false,
  autoNarrate: false,
};

export type NarrationStatus = "idle" | "loading" | "playing";

function clamp01(v: unknown, fallback: number): number {
  return typeof v === "number" && isFinite(v) && v >= 0 && v <= 1 ? v : fallback;
}

function loadSettings(): PersistedSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw);
    return {
      master: clamp01(p.master, DEFAULTS.master),
      music: clamp01(p.music, DEFAULTS.music),
      sfx: clamp01(p.sfx, DEFAULTS.sfx),
      voice: clamp01(p.voice, DEFAULTS.voice),
      muted: typeof p.muted === "boolean" ? p.muted : DEFAULTS.muted,
      autoNarrate: typeof p.autoNarrate === "boolean" ? p.autoNarrate : DEFAULTS.autoNarrate,
    };
  } catch {
    return DEFAULTS;
  }
}

interface AudioContextValue extends AudioState {
  autoNarrate: boolean;
  narration: NarrationStatus;
  setMaster: (v: number) => void;
  setMusic: (v: number) => void;
  setSfx: (v: number) => void;
  setVoice: (v: number) => void;
  setMuted: (b: boolean) => void;
  toggleMute: () => void;
  setAutoNarrate: (b: boolean) => void;
  playSfx: (name: SfxName) => void;
  narrate: (text: string) => Promise<void>;
  stopNarration: () => void;
  playAmbient: (mood: MoodKey) => void;
  stopAmbient: () => void;
  playCue: (name: string) => void;
}

const AudioCtx = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PersistedSettings>(loadSettings);
  const [narration, setNarration] = useState<NarrationStatus>("idle");
  // Monotonic token so a stale TTS response can't override a newer narration.
  const narrateToken = useRef(0);

  // Sync engine state (audio fields only) + persist everything.
  useEffect(() => {
    const { autoNarrate, ...audioState } = settings;
    audioEngine.setState(audioState);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* storage may be unavailable (private mode) — settings just won't persist */
    }
  }, [settings]);

  // Resume the AudioContext on the first user interaction (autoplay policy).
  useEffect(() => {
    const unlock = () => audioEngine.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const update = useCallback((patch: Partial<PersistedSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const stopNarration = useCallback(() => {
    narrateToken.current += 1; // invalidate any in-flight request
    audioEngine.stopVoice();
    setNarration("idle");
  }, []);

  const narrate = useCallback(async (text: string) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    // Prime within the calling gesture so playback after the async fetch is allowed.
    audioEngine.primeVoice();
    const token = ++narrateToken.current;
    setNarration("loading");
    try {
      const resp = await apiRequest("POST", "/api/tts", { text: trimmed });
      const data = await resp.json();
      if (token !== narrateToken.current) return; // superseded by a newer call
      if (!data?.url) throw new Error("No narration URL returned");
      audioEngine.playVoice(data.url, {
        onEnded: () => {
          if (token === narrateToken.current) setNarration("idle");
        },
        onError: () => {
          if (token === narrateToken.current) setNarration("idle");
        },
      });
      setNarration("playing");
    } catch {
      if (token === narrateToken.current) setNarration("idle");
    }
  }, []);

  const { autoNarrate, ...audioState } = settings;
  const value: AudioContextValue = {
    ...audioState,
    autoNarrate,
    narration,
    setMaster: (v) => update({ master: v }),
    setMusic: (v) => update({ music: v }),
    setSfx: (v) => update({ sfx: v }),
    setVoice: (v) => update({ voice: v }),
    setMuted: (b) => update({ muted: b }),
    toggleMute: () => setSettings((s) => ({ ...s, muted: !s.muted })),
    setAutoNarrate: (b) => update({ autoNarrate: b }),
    playSfx: (name) => audioEngine.playSfx(name),
    narrate,
    stopNarration,
    playAmbient: (mood) => audioEngine.playAmbient(mood),
    stopAmbient: () => audioEngine.stopAmbient(),
    playCue: (name) => audioEngine.playCue(name),
  };

  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>;
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("useAudio must be used within an AudioProvider");
  return ctx;
}
