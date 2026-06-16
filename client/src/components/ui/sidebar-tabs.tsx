import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * Sidebar-style tabs: a drop-in replacement for the shadcn Tabs primitives
 * that renders the tab list as a sticky vertical sidebar on large screens
 * (and a horizontally-scrolling strip on mobile), with the active panel
 * filling the remaining space.
 *
 * Usage mirrors <Tabs>: swap Tabs -> SidebarTabs, TabsList -> SidebarTabsList,
 * TabsTrigger -> SidebarTabsTrigger, and keep <TabsContent> as-is. Works as
 * long as the only always-rendered children of the root are the list and the
 * tab panels (Radix unmounts inactive panels, so the CSS grid places the
 * sidebar in column 1 and the active panel in column 2 automatically).
 *
 * Layout classes are applied AFTER the caller's className so the sidebar
 * layout always wins, even when a page's original TabsList carried conflicting
 * layout utilities like `grid grid-cols-6 w-full`. Pass colors/borders via
 * className freely — those don't conflict and are preserved.
 */
const SidebarTabs = React.forwardRef<
  React.ElementRef<typeof Tabs>,
  React.ComponentPropsWithoutRef<typeof Tabs>
>(({ className, ...props }, ref) => (
  <Tabs
    ref={ref}
    orientation="vertical"
    className={cn(
      className,
      "flex flex-col gap-4 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6 lg:items-start",
    )}
    {...props}
  />
));
SidebarTabs.displayName = "SidebarTabs";

const SidebarTabsList = React.forwardRef<
  React.ElementRef<typeof TabsList>,
  React.ComponentPropsWithoutRef<typeof TabsList>
>(({ className, ...props }, ref) => (
  <TabsList
    className={cn(
      className,
      // Mobile: full-width horizontal scroll strip.
      "flex h-auto w-full flex-row flex-nowrap justify-start gap-1 overflow-x-auto rounded-lg p-1.5",
      // Desktop: vertical, sticky sidebar.
      "lg:w-52 lg:flex-col lg:items-stretch lg:overflow-visible lg:sticky lg:top-20 lg:self-start",
    )}
    ref={ref}
    {...props}
  />
));
SidebarTabsList.displayName = "SidebarTabsList";

const SidebarTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsTrigger>,
  React.ComponentPropsWithoutRef<typeof TabsTrigger>
>(({ className, ...props }, ref) => (
  <TabsTrigger
    className={cn(
      className,
      // Mobile: auto-width pill in the scroll strip. Desktop: full-width row.
      "flex-shrink-0 justify-start gap-2 whitespace-nowrap px-3 py-2 lg:w-full lg:flex-shrink",
    )}
    ref={ref}
    {...props}
  />
));
SidebarTabsTrigger.displayName = "SidebarTabsTrigger";

/**
 * Optional wrapper for the panel column. Only needed when the root has extra
 * always-rendered children besides the list (which would break grid
 * auto-placement) — wrap all <TabsContent> elements in this.
 */
const SidebarTabsContentArea = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("min-w-0 w-full", className)} {...props} />
));
SidebarTabsContentArea.displayName = "SidebarTabsContentArea";

export {
  SidebarTabs,
  SidebarTabsList,
  SidebarTabsTrigger,
  SidebarTabsContentArea,
  TabsContent,
};
