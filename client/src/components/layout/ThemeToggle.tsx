import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { BookOpen, Moon, Sun } from 'lucide-react';

/**
 * Cycles the reading mode: Dark (night), Light (day), and E-ink (pure black
 * on white with no greys or animation, for black-and-white e-readers like
 * Boox). `next-themes` puts the matching class on <html>; the play palette in
 * index.css follows it, so the story text changes too, not just the chrome.
 */
const MODES = ['dark', 'light', 'eink'] as const;
type Mode = (typeof MODES)[number];

const LABEL: Record<Mode, string> = { dark: 'Dark', light: 'Light', eink: 'E-ink' };

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // The first render doesn't know the stored preference, so the icon waits for mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current: Mode = MODES.includes(theme as Mode) ? (theme as Mode) : 'dark';
  const next = MODES[(MODES.indexOf(current) + 1) % MODES.length];
  const label = `Reading mode: ${LABEL[current]}. Switch to ${LABEL[next]}`;
  const Icon = !mounted || current === 'dark' ? Moon : current === 'light' ? Sun : BookOpen;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className={`p-2 rounded-lg text-white hover:bg-white/10 transition-colors ${className ?? ''}`}
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
