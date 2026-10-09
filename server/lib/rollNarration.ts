/**
 * Turns a client-side roll into the "DICE OUTCOME" block the story narrator reads.
 *
 * Two shapes arrive here. Skill checks send { result, modifier, total, dc }.
 * Weapon attacks send { type: "weapon_attack", hit, attackRoll: { total, ... },
 * damage: { total }, targetName, weaponName } — no top-level total or dc. The
 * narrator used to read every roll as a skill check, so an attack evaluated as
 * `undefined >= 10`, always FAILURE: a longsword hit for 7 was written up as a
 * clean miss, and the zombie it struck stood up for thirteen turns.
 */
export function describeRollForNarrator(rollResult: any, actorName?: string): string {
  if (!rollResult || typeof rollResult !== "object") return "";

  if (isAttackRoll(rollResult)) {
    const atk = rollResult.attackRoll || {};
    const hit = rollSucceeded(rollResult);
    const crit = !!atk.isCritical;
    const fumble = !!atk.isCriticalMiss;
    const who = actorName || "The attacker";
    const weapon = rollResult.weaponName || "their weapon";
    const target = rollResult.targetName || "the target";
    const dmg = rollResult.damage?.total;
    const dmgType = rollResult.damage?.damageType ? ` ${rollResult.damage.damageType}` : "";
    return `
DICE OUTCOME — ${who} just attacked:
- Attack: ${who} with ${weapon} vs ${target} — d20 ${atk.roll ?? "?"} + ${atk.modifier ?? 0} = ${atk.total ?? "?"}
- Result: ${hit ? (crit ? "CRITICAL HIT" : "HIT") : (fumble ? "CRITICAL MISS" : "MISS")}${hit && dmg != null ? ` for ${dmg}${dmgType} damage` : ""}

${hit
    ? `The blow lands — ${target} takes ${dmg ?? "real"} damage and visibly suffers it. Do not soften this into a miss or a glancing failure.`
    : `The attack misses ${target}. Show why, without inflicting damage.`} It is ${who} who swings ${weapon} — no one else. Do NOT contradict this outcome.
`;
  }

  const dc = Number(rollResult.dc) || 10;
  const success = rollSucceeded(rollResult);
  return `
DICE OUTCOME — the player just rolled for this action:
- Check: ${rollResult.purpose || 'skill check'}
- Roll: ${rollResult.diceType || 'd20'} ${rollResult.result} + ${rollResult.modifier || 0} = ${rollResult.total} vs DC ${dc}
- Result: ${success ? 'SUCCESS' : 'FAILURE'}

Write the scene around this ${success ? 'success' : 'failure'}. ${success ? 'The attempt works — show it paying off.' : 'The attempt falls short — show the complication, not a clean win.'} Do NOT contradict this outcome.
`;
}

/** True for a weapon-attack roll (hit/attackRoll shape) rather than a skill check. */
export function isAttackRoll(rollResult: any): boolean {
  return !!(rollResult && (rollResult.attackRoll || rollResult.type === "weapon_attack"));
}

/** Did the roll succeed? A hit for attacks; total vs DC for skill checks. */
export function rollSucceeded(rollResult: any): boolean {
  if (!rollResult) return false;
  if (isAttackRoll(rollResult)) return !!(rollResult.hit ?? rollResult.isHit ?? rollResult.autoHit);
  return Number(rollResult.total) >= (Number(rollResult.dc) || 10);
}
