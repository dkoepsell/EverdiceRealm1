/**
 * What's new in Everdice: the card grid (used by the modal and /whats-new)
 * and the once-per-release modal for returning players.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Compass, Dice5, Handshake, Scroll, Skull, Swords, Users, Zap, ArrowRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RELEASE_TITLE, WHATS_NEW, type WhatsNewCard, seenTipId, shouldShowWhatsNew } from "@shared/whatsNew";

const ICONS: Record<WhatsNewCard["icon"], typeof Swords> = {
  swords: Swords, skull: Skull, zap: Zap, users: Users, compass: Compass, scroll: Scroll, dice: Dice5, handshake: Handshake,
};

export function WhatsNewCards({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {WHATS_NEW.map((c) => {
        const Icon = ICONS[c.icon];
        return (
          <div key={c.id} className="flex flex-col rounded-xl border border-amber-800/50 bg-stone-900/70 p-4 text-stone-100" data-testid={`whats-new-${c.id}`}>
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
              <h3 className="font-semibold text-amber-100">{c.title}</h3>
            </div>
            <p className="mt-2 text-sm text-stone-300">{c.body}</p>
            <p className="mt-2 text-sm italic text-amber-200/90">Try it: {c.tryIt}</p>
            <Link href={c.href} onClick={onNavigate} className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-medium text-amber-300 hover:text-amber-200">
              {c.cta} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        );
      })}
    </div>
  );
}

export function WhatsNewModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const remember = useMutation({
    mutationFn: async () => { await apiRequest("PATCH", "/api/user/onboarding", { seenTips: [seenTipId()] }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/user"] }),
  });

  useEffect(() => {
    if (!shouldShowWhatsNew(user as any)) return;
    // Don't land on top of the join flow or the first-run pages.
    if (/^\/(join|begin|auth|whats-new)/.test(window.location.pathname)) return;
    let seen = false;
    try { seen = localStorage.getItem(seenTipId()) === "1"; } catch { /* storage can be unavailable */ }
    if (!seen) setOpen(true);
  }, [user]);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(seenTipId(), "1"); } catch { /* ignore */ }
    remember.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto border-amber-800/60 bg-stone-950 text-stone-100">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-amber-200">{RELEASE_TITLE}</DialogTitle>
          <DialogDescription className="text-stone-300">
            Here's what we've added since you were last at the table, and some fun ways to play.
          </DialogDescription>
        </DialogHeader>
        <WhatsNewCards onNavigate={close} />
        <div className="flex justify-end gap-2 pt-2">
          <Link href="/whats-new" onClick={close} className="self-center text-sm text-stone-400 underline underline-offset-2 hover:text-stone-200">Keep this list</Link>
          <Button onClick={close}>Let's play</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
