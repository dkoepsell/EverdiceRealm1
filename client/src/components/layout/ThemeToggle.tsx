import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

/**
 * Switches between the dark and light palettes. `next-themes` is already
 * mounted in App with `attribute="class"`, so flipping the theme swaps the
 * `dark` class Tailwind keys off and persists the choice to localStorage.
 */
export default function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  // The server-side/first render doesn't know the stored preference, so the
  // icon is only decided after mount to avoid rendering the wrong one.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme !== 'light';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`p-2 rounded-lg text-white hover:bg-white/10 transition-colors ${className ?? ''}`}
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
    >
      {mounted && !isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </button>
  );
}
