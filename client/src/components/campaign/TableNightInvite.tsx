/**
 * One-shot nights: one link for up to five friends. They can join without an
 * account and pick a ready-made level 3 hero (join-campaign page).
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Copy, Loader2, PartyPopper } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function TableNightInvite({ campaignId }: { campaignId: number }) {
  const { toast } = useToast();
  const [link, setLink] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/campaigns/${campaignId}/invitations`, { role: "player", maxUses: 5 })).json(),
    onSuccess: (inv: any) => setLink(`${window.location.origin}/join/${inv.inviteCode}`),
    onError: (err: any) => toast({ title: "Couldn't make a link", description: err.message, variant: "destructive" }),
  });
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Link copied", description: "Paste it in your group chat or Discord." });
    } catch {
      toast({ title: "Copy it from the box", description: link });
    }
  };
  return (
    <Dialog onOpenChange={(o) => o && !link && !create.isPending && create.mutate()}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid="table-night-invite">
          <PartyPopper className="h-4 w-4 mr-2" /> Invite friends
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite friends to play</DialogTitle>
          <DialogDescription>
            One link for up to five friends. They don't need an account: they pick a ready-made level 3 hero and they're in.
            They can keep the character afterwards.
          </DialogDescription>
        </DialogHeader>
        {create.isPending || !link ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div>
        ) : (
          <div className="space-y-3">
            <input readOnly value={link} aria-label="Invite link" className="w-full rounded-md border bg-muted px-3 py-2 text-sm" onFocus={(e) => e.currentTarget.select()} />
            <Button className="w-full" onClick={copy}><Copy className="h-4 w-4 mr-2" /> Copy link</Button>
            <p className="text-xs text-muted-foreground">Tip: a one-shot campaign fits one evening. Start one from Campaigns, length "One-Shot".</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
