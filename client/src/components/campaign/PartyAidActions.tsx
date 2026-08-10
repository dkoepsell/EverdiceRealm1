import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Coins, HeartPulse, Sparkles, HandHeart } from "lucide-react";

/**
 * Async play breaks the usual assumption that the party is in the room
 * together: a character can sit downed, dead, or broke for days waiting on
 * whoever happens to be holding the potion. These let one player act for
 * another without needing the DM — the server does the real validation.
 */

interface AidTarget {
  characterId: number;
  name: string;
  status?: string | null;
  hitPoints?: number | null;
  maxHitPoints?: number | null;
}

interface PartyAidActionsProps {
  campaignId: number;
  /** The acting player's own character in this campaign. */
  myCharacterId: number;
  target: AidTarget;
}

interface InventoryItem {
  id: number;
  name: string;
  type: string;
  quantity: number | null;
  isEquipped?: boolean | null;
  isAttuned?: boolean | null;
}

export default function PartyAidActions({
  campaignId,
  myCharacterId,
  target,
}: PartyAidActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [goldAmount, setGoldAmount] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [selectedPotionId, setSelectedPotionId] = useState<string>("");

  const isDead = target.status === "dead";
  const isDown = target.status === "unconscious" || target.status === "stabilized";

  const { data: inventory = [] } = useQuery<InventoryItem[]>({
    queryKey: [`/api/characters/${myCharacterId}/inventory`],
    enabled: open,
  });

  const potions = inventory.filter((i) => {
    const n = (i.name || "").toLowerCase();
    return n.includes("potion") && n.includes("healing");
  });
  const giftable = inventory.filter((i) => !i.isEquipped && !i.isAttuned);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/participants`] });
    queryClient.invalidateQueries({ queryKey: [`/api/characters/${myCharacterId}/inventory`] });
    queryClient.invalidateQueries({ queryKey: [`/api/characters/${myCharacterId}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/turn-log`] });
  };

  // The server refuses with a specific, human-readable reason (not enough gold,
  // dead too long, still equipped) and that reason is the whole value of the
  // message. apiRequest throws it as "<status>: <raw json body>", so dig the
  // message back out instead of showing the player a status code and braces.
  const friendlyError = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    const body = raw.replace(/^\d{3}:\s*/, "");
    try {
      const parsed = JSON.parse(body);
      if (parsed?.message) return parsed.message;
    } catch {
      /* not JSON — fall through to the raw text */
    }
    return body || "That didn't work";
  };

  // A named hook, called unconditionally four times below: keeps the shared
  // wiring in one place without breaking the rules of hooks.
  const useAid = (endpoint: string, successTitle: (data: any) => string) =>
    useMutation({
      mutationFn: async (body: Record<string, unknown>) => {
        const res = await apiRequest("POST", `/api/campaigns/${campaignId}/party/${endpoint}`, {
          fromCharacterId: myCharacterId,
          toCharacterId: target.characterId,
          ...body,
        });
        return res.json();
      },
      onSuccess: (data) => {
        refresh();
        setOpen(false);
        toast({ title: successTitle(data) });
      },
      onError: (err: unknown) => {
        toast({ title: friendlyError(err), variant: "destructive" });
      },
    });

  const giveGold = useAid("give-gold", (d) => `Gave ${d.amount} gold to ${target.name}`);
  const giveItem = useAid("give-item", (d) => `Gave ${d.item} to ${target.name}`);
  const usePotion = useAid("use-potion", (d) =>
    d.revived
      ? `${target.name} is back on their feet (${d.healed} HP)`
      : `Healed ${target.name} for ${d.healed}`,
  );
  const revive = useAid("revive", (d) => `${d.spell} restored ${target.name} to life`);

  const busy =
    giveGold.isPending || giveItem.isPending || usePotion.isPending || revive.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={isDead || isDown ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          data-testid={`button-party-aid-${target.characterId}`}
        >
          <HandHeart className="h-3.5 w-3.5" />
          {isDead ? "Revive" : isDown ? "Help" : "Give"}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Help {target.name}</DialogTitle>
          <DialogDescription>
            {isDead
              ? `${target.name} is dead. Bringing them back consumes a diamond from your own purse.`
              : isDown
                ? `${target.name} is down. A healing potion will bring them back to consciousness.`
                : `Pass gold or gear to ${target.name}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {isDead && (
            <section className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
              <h4 className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Bring them back
              </h4>
              <p className="text-xs text-muted-foreground">
                Within a minute of death this is Revivify (300gp diamond). Longer than
                that, Raise Dead (500gp diamond), up to ten days. The cost comes out of
                your character's gold.
              </p>
              <Button
                className="w-full"
                disabled={busy}
                onClick={() => revive.mutate({})}
                data-testid="button-revive-confirm"
              >
                {revive.isPending ? "Casting…" : `Revive ${target.name}`}
              </Button>
            </section>
          )}

          {!isDead && (
            <section className="space-y-2">
              <h4 className="flex items-center gap-2 text-sm font-medium">
                <HeartPulse className="h-4 w-4 text-rose-500" />
                Healing potion
              </h4>
              {potions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  You aren't carrying any healing potions.
                </p>
              ) : (
                <div className="flex gap-2">
                  <Select value={selectedPotionId} onValueChange={setSelectedPotionId}>
                    <SelectTrigger className="flex-1" data-testid="select-potion">
                      <SelectValue placeholder="Choose a potion" />
                    </SelectTrigger>
                    <SelectContent>
                      {potions.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                          {(p.quantity ?? 1) > 1 ? ` (×${p.quantity})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    disabled={busy || !selectedPotionId}
                    onClick={() => usePotion.mutate({ itemId: Number(selectedPotionId) })}
                    data-testid="button-use-potion"
                  >
                    Give
                  </Button>
                </div>
              )}
            </section>
          )}

          <section className="space-y-2">
            <h4 className="flex items-center gap-2 text-sm font-medium">
              <Coins className="h-4 w-4 text-yellow-500" />
              Gold
            </h4>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="Amount"
                value={goldAmount}
                onChange={(e) => setGoldAmount(e.target.value)}
                data-testid="input-gold-amount"
              />
              <Button
                disabled={busy || !goldAmount || Number(goldAmount) < 1}
                onClick={() => giveGold.mutate({ amount: Number(goldAmount) })}
                data-testid="button-give-gold"
              >
                Send
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-medium">An item</h4>
            {giftable.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nothing in your pack to hand over. Equipped and attuned gear has to be
                taken off first.
              </p>
            ) : (
              <div className="flex gap-2">
                <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger className="flex-1" data-testid="select-item">
                    <SelectValue placeholder="Choose an item" />
                  </SelectTrigger>
                  <SelectContent>
                    {giftable.map((i) => (
                      <SelectItem key={i.id} value={String(i.id)}>
                        {i.name}
                        {(i.quantity ?? 1) > 1 ? ` (×${i.quantity})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  disabled={busy || !selectedItemId}
                  onClick={() => giveItem.mutate({ itemId: Number(selectedItemId), quantity: 1 })}
                  data-testid="button-give-item"
                >
                  Give
                </Button>
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
