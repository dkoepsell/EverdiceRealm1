/** Pure (DB-free) so tests can build pregen character rows. */
import { getClassDef } from "@shared/rules/classProgression";
import { buildFeatureState } from "@shared/rules/leveling";
import type { Pregen } from "@shared/rules/pregens";

/** The character row for a pregen, with SRD features for level 3. */
export function pregenCharacterRow(p: Pregen, userId: number, nameOverride?: string | null) {
  const def = getClassDef(p.className);
  const features = def ? buildFeatureState(def, 3, p.subclass, p.abilities) : [];
  const withExpertise = p.expertise?.length
    ? features.map((f) => (f.id === "expertise" ? { ...f, choices: p.expertise } : f))
    : features;
  return {
    userId,
    name: nameOverride?.trim() ? nameOverride.trim().slice(0, 40) : p.name,
    race: p.race,
    class: p.className,
    subclass: p.subclass,
    level: 3,
    experience: 900,
    background: p.background,
    alignment: p.alignment,
    ...p.abilities,
    hitPoints: p.hitPoints,
    maxHitPoints: p.hitPoints,
    armorClass: p.armorClass,
    hitDiceRemaining: 3,
    skills: p.skills,
    equipment: [p.weapon, p.armor, ...p.extraEquipment],
    equippedWeapon: p.weapon,
    equippedArmor: p.armor,
    equippedShield: p.extraEquipment.includes("Shield") ? "Shield" : null,
    features: withExpertise,
    personality: p.personality,
    appearance: p.appearance,
    gold: 25,
    silver: 20,
    consumables: [{ name: "Healing Potion", quantity: 2, type: "healing", effect: "Restores 2d4+2 HP", healDice: "2d4", healBonus: 2 }],
  };
}

