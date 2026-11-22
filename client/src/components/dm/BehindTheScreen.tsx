/**
 * "Behind the screen": short notes on the DM craft behind what just happened
 * in play, each linked to the DM-path step that teaches it. Players can hide
 * them (remembered in this browser).
 */
import { useState } from "react";
import { Link } from "wouter";
import { BookOpen, ChevronDown, ChevronRight, EyeOff } from "lucide-react";
import { SCREEN_NOTES, getStep, type ScreenNoteId } from "@shared/dm/path";

const KEY = "everdice-dm-notes";

export function dmNotesEnabled(): boolean {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}

export function BehindTheScreen({ ids }: { ids?: Array<string | undefined | null> }) {
  const [enabled, setEnabled] = useState(dmNotesEnabled);
  const [open, setOpen] = useState(false);
  const notes = Array.from(new Set((ids ?? []).filter(Boolean) as string[]))
    .map((id) => SCREEN_NOTES[id as ScreenNoteId])
    .filter(Boolean);
  if (!enabled || notes.length === 0) return null;
  return (
    <div className="rounded border border-indigo-500/30 bg-indigo-950/20 text-xs" data-testid="behind-the-screen">
      <button className="w-full flex items-center gap-1.5 px-2 py-1.5 text-indigo-200" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <BookOpen className="h-3 w-3" />
        <span className="font-medium">Behind the screen</span>
        <span className="text-indigo-300/70 truncate">: {notes.map((n) => n.title).join(" · ")}</span>
      </button>
      {open && (
        <div className="px-2 pb-2 space-y-2">
          {notes.map((n) => (
            <div key={n.id}>
              <p className="text-indigo-100 font-medium">{n.title}</p>
              <p className="text-indigo-200/80 leading-relaxed">{n.text}</p>
              <Link href={`/dm-path#${n.step}`} className="text-indigo-300 underline">Learn to do this as a DM: {getStep(n.step)?.title}</Link>
            </div>
          ))}
          <button className="flex items-center gap-1 text-indigo-300/70 hover:text-indigo-200" onClick={() => { try { localStorage.setItem(KEY, "off"); } catch { /* ignore */ } setEnabled(false); }}>
            <EyeOff className="h-3 w-3" /> Hide these notes (turn them back on from the DM path page)
          </button>
        </div>
      )}
    </div>
  );
}

export function setDmNotes(on: boolean) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* ignore */ }
}
