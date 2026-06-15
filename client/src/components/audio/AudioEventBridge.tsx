/**
 * Bridges existing game events to sound effects. Mounted once (inside AudioProvider),
 * it listens for the window CustomEvents that websocket.ts already dispatches and maps
 * each to a synthesized SFX. Renders nothing.
 *
 * Payloads come from the server as { type, payload }; websocket.ts forwards `payload`
 * as the CustomEvent detail. Shapes are read defensively so a missing field degrades
 * to a sensible default rather than throwing.
 */
import { useEffect } from "react";
import { useAudio } from "@/hooks/use-audio";

export default function AudioEventBridge() {
  const { playSfx } = useAudio();

  useEffect(() => {
    const onDice = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      const type = String(d.diceType ?? d.dice ?? "").toLowerCase();
      const result = Number(d.result);
      const isD20 = type.includes("20");
      if (isD20 && result === 20) return playSfx("diceCrit");
      if (isD20 && result === 1) return playSfx("diceFumble");
      playSfx("dice");
    };

    const onCombatAction = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      const r = d.result ?? d ?? {};
      const isCrit = r.isCritical ?? r.critical ?? r.attackRoll?.isCritical ?? false;
      const isHit = r.isHit ?? r.hit ?? (r.damage != null);
      if (isCrit && isHit) playSfx("crit");
      else if (isHit) playSfx("hit");
      else playSfx("miss");
    };

    const onCombatStart = () => playSfx("combatStart");
    const onInitiative = () => playSfx("dice");
    const onStory = () => playSfx("narrate");

    window.addEventListener("dice_roll_result", onDice);
    window.addEventListener("combat_action", onCombatAction);
    window.addEventListener("combat_started", onCombatStart);
    window.addEventListener("initiative_rolled", onInitiative);
    window.addEventListener("story_advanced", onStory);
    return () => {
      window.removeEventListener("dice_roll_result", onDice);
      window.removeEventListener("combat_action", onCombatAction);
      window.removeEventListener("combat_started", onCombatStart);
      window.removeEventListener("initiative_rolled", onInitiative);
      window.removeEventListener("story_advanced", onStory);
    };
  }, [playSfx]);

  return null;
}
