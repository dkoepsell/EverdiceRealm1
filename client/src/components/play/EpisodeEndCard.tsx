/**
 * "End of Episode N" (engagement spec 5.2; design PDF Episode end): what you
 * gained, a real 5e short-rest decision (spend Hit Dice: roll + Con each, half
 * come back on a long rest, and resting here ticks the clock), the clock at
 * risk, and a clean place to stop.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { audioEngine } from "@/lib/audio/engine";
import { ClockDial } from "@/components/combat/CombatTurnPanel";

export interface EpisodeCardData {
  number: number;
  title: string;
  cliffhanger: string;
  gains: { items: string[]; allies: string[]; rules: string[] };
  nextClock: { name: string; filled: number; segments: number; ifRest: number } | null;
  rest: { hp: number; maxHp: number; hitDiceLeft: number; hitDie: number; conMod: number } | null;
}

export function EpisodeEndCard({
  card,
  campaignId,
  characterId,
  onContinue,
  onStop,
}: {
  card: EpisodeCardData | null;
  campaignId: number;
  characterId?: number | null;
  onContinue: () => void;
  onStop: () => void;
}) {
  const [resting, setResting] = useState(false);
  const [restResult, setRestResult] = useState<string | null>(null);
  if (!card) return null;
  const rest = card.rest;
  const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  async function shortRest(dice: number) {
    if (!characterId) return;
    setResting(true);
    try {
      const res = await apiRequest("POST", `/api/characters/${characterId}/short-rest`, { campaignId, hitDice: dice, safe: false });
      const body = await res.json();
      audioEngine.playSfx("dice");
      setRestResult(body?.message ?? "You rest for an hour.");
      queryClient.invalidateQueries({ predicate: (q) => /\/participants|\/characters/.test(String(q.queryKey[0] ?? "")) });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/session`] });
    } catch (e) {
      setRestResult((e as Error)?.message?.replace(/^\d+:\s*/, "") || "Couldn't rest.");
    } finally {
      setResting(false);
    }
  }

  const tiles = [
    card.gains.items[0] ? { big: card.gains.items[0].split(" ").slice(0, 2).join(" "), small: card.gains.items[0].split(" ").slice(2).join(" ") || "found" } : null,
    card.gains.allies.length ? { big: String(card.gains.allies.length), small: card.gains.allies.length === 1 ? "new ally" : "new allies" } : null,
    card.gains.rules.length ? { big: String(card.gains.rules.length), small: card.gains.rules.length === 1 ? "rule learned" : "rules learned" } : null,
  ].filter(Boolean) as { big: string; small: string }[];

  return (
    <Dialog open={!!card} onOpenChange={(o) => { if (!o) onContinue(); }}>
      <DialogContent className="max-w-md border-stone-700 bg-stone-950 text-stone-100" data-testid="episode-end">
        <DialogHeader className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">End of episode {card.number}</p>
          <DialogTitle className="text-center font-serif text-2xl text-amber-100">{card.title}</DialogTitle>
          <DialogDescription className="text-center font-serif text-base italic text-stone-300">{card.cliffhanger}</DialogDescription>
        </DialogHeader>

        {tiles.length > 0 && (
          <div className="grid grid-cols-3 gap-2 text-center">
            {tiles.map((t) => (
              <div key={t.big + t.small} className="rounded-xl border border-stone-700 bg-stone-900 p-2">
                <div className="font-semibold text-amber-300">{t.big}</div>
                <div className="text-xs text-stone-400">{t.small}</div>
              </div>
            ))}
          </div>
        )}

        {rest && (
          <div className="space-y-2 rounded-xl border border-stone-700 bg-stone-900 p-3">
            <div className="flex justify-between"><span className="font-serif text-lg">Take a short rest?</span><span className="text-sm text-stone-400">1 hour in-world</span></div>
            <div className="flex justify-between text-sm"><span>HP <b>{rest.hp}</b> / {rest.maxHp}</span><span>Hit Dice left: <b>{rest.hitDiceLeft}d{rest.hitDie}</b></span></div>
            {restResult ? (
              <p className="text-sm text-emerald-300" data-testid="rest-result">{restResult}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" disabled={resting || rest.hitDiceLeft < 1 || rest.hp >= rest.maxHp} onClick={() => shortRest(1)}>Spend 1 die</Button>
                <Button variant="outline" disabled={resting || rest.hitDiceLeft < 2 || rest.hp >= rest.maxHp} onClick={() => shortRest(2)}>Spend 2</Button>
                <Button variant="outline" disabled={resting} onClick={() => setRestResult("You push on without resting.")}>Push on</Button>
              </div>
            )}
            <p className="text-xs text-stone-400">
              Each Hit Die heals d{rest.hitDie} {signed(rest.conMod)} (your Constitution modifier). You get half your dice back on a long rest, so spending them now leaves less for tomorrow.
              {card.nextClock && card.nextClock.ifRest > card.nextClock.filled ? ` Resting here also ticks ${card.nextClock.name.toLowerCase()} by 1.` : ""}
            </p>
          </div>
        )}

        {card.nextClock && (
          <div className="flex items-center gap-3 rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm">
            <ClockDial name="" filled={card.nextClock.filled} segments={card.nextClock.segments} />
            <span><b>Next time:</b> {card.nextClock.name} is at {card.nextClock.filled} of {card.nextClock.segments}.</span>
          </div>
        )}

        <Button className="w-full bg-purple-700 hover:bg-purple-600" onClick={onContinue} data-testid="next-episode">Play the next episode</Button>
        <Button variant="outline" className="w-full" onClick={onStop} data-testid="stop-here">Stop here. We'll save your place</Button>
      </DialogContent>
    </Dialog>
  );
}
