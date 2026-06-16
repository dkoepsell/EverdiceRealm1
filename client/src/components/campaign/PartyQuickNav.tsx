import { useEffect, useState } from "react";

export interface QuickNavSection {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface PartyQuickNavProps {
  sections: QuickNavSection[];
  /** Optional heading shown above the links. */
  title?: string;
}

/**
 * A sticky, in-tab quick-jump menu. Each entry scrolls its matching
 * section (by element id) into view. Sections whose target isn't currently
 * rendered are skipped automatically, so the same list can be reused as the
 * selected party member changes.
 */
export function PartyQuickNav({ sections, title = "Jump to" }: PartyQuickNavProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Highlight whichever section is nearest the top of the viewport as the
  // user scrolls, so the menu reflects where they are.
  useEffect(() => {
    const ids = sections.map((s) => s.id);
    if (ids.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 }
    );

    const observed: Element[] = [];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
        observed.push(el);
      }
    }
    return () => observer.disconnect();
  }, [sections]);

  const handleJump = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
    }
  };

  if (sections.length === 0) return null;

  return (
    <nav
      aria-label="Party sections"
      className="lg:sticky lg:top-24 mb-4 lg:mb-0"
    >
      <div className="rounded-lg border-2 border-amber-200 bg-white/80 p-2 shadow-sm">
        <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
          {title}
        </p>
        {/* Horizontal scroll on mobile, vertical list on large screens. */}
        <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeId === section.id;
            return (
              <li key={section.id} className="flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleJump(section.id)}
                  className={`flex w-full items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-amber-500/20 text-amber-900"
                      : "text-slate-700 hover:bg-amber-100/70 hover:text-amber-900"
                  }`}
                >
                  {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-amber-600" />}
                  {section.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
