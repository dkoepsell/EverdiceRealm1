/**
 * The character column from the design PDF (desktop play screen): name card,
 * HP / AC / proficiency, the six abilities, the skills in play with their
 * real modifiers, passive scores, class features with uses left, and Hit
 * Dice. Every number comes from the shared rules the server uses, so what the
 * sheet says is what the dice will do.
 *
 * `variant="strip"` is the compact phone version: HP / AC / Prof / Inspiration
 * with the full sheet one tap away.
 */
import { useState } from "react";
import { ABILITY_ABBR, ABILITY_NAMES, type AbilityName } from "@shared/rules/abilities";
import { checkModifier, passives, SKILL_LABELS, normalizeSkill } from "@shared/rules/checks";
import { allFeaturesThrough, atLevel, getClassDef } from "@shared/rules/classProgression";
import { hitDieFor, parseFeatureState } from "@shared/rules/leveling";
import { getProficiencyBonus } from "@shared/rules/xp";
import { SKILL_ABILITY_MAP } from "@shared/rules/skills";

export interface RailCharacter {
  id: number;
  name: string;
  race?: string | null;
  class: string;
  level?: number | null;
  subclass?: string | null;
  hitPoints: number;
  maxHitPoints: number;
  armorClass?: number | null;
  strength: number; dexterity: number; constitution: number; intelligence: number; wisdom: number; charisma: number;
  skills?: string[] | null;
  features?: unknown;
  hitDiceRemaining?: number | null;
  inspiration?: boolean | null;
  portraitUrl?: string | null;
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
const mod = (score: number) => Math.floor((score - 10) / 2);
const norm = (s: string) => s.toLowerCase().replace(/[\s-]+/g, "_").replace(/'/g, "");
const KIND_LABEL: Record<string, string> = { bonusAction: "bonus action", reaction: "reaction", action: "action" };

export function buildCharacterSheet(c: RailCharacter, highlightSkill?: string | null) {
  const level = c.level || 1;
  const def = getClassDef(c.class);
  const subclassName = def && c.subclass === def.subclass.id ? def.subclass.name : null;
  const prof = getProficiencyBonus(level);
  const state = parseFeatureState(c.features);
  const featureDefs = def ? allFeaturesThrough(def, Math.min(level, def.maxEncodedLevel), !!subclassName) : [];
  const features = state
    .map((s) => {
      const f = featureDefs.find((x) => x.id === s.id);
      if (!f) return null;
      const scale = atLevel(f.scaling, level);
      const detail = typeof s.usesRemaining === "number" ? `${s.usesRemaining} left` : scale ? (f.id === "sneak_attack" ? `${scale}, once/turn` : scale) : KIND_LABEL[f.kind] ?? "";
      return { id: f.id, name: f.name, detail, summary: f.summary, fromSubclass: !!def?.subclass.features && Object.values(def.subclass.features).some((list) => list.some((x) => x.id === f.id)) };
    })
    .filter(Boolean) as { id: string; name: string; detail: string; summary: string; fromSubclass: boolean }[];
  const skillKeys = Array.from(new Set((c.skills ?? []).map((s) => normalizeSkill(String(s))).filter((s): s is string => !!s && !!SKILL_LABELS[s])));
  const hi = normalizeSkill(highlightSkill ?? "");
  if (hi && SKILL_LABELS[hi] && !skillKeys.includes(hi)) skillKeys.unshift(hi);
  const skills = skillKeys
    .map((k) => ({ ...checkModifier(c, k), key: k, label: SKILL_LABELS[k] }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
  const highlightAbility = hi ? ((SKILL_ABILITY_MAP[hi] ?? null) as AbilityName | null) : null;
  return {
    level, def, subclassName, prof, features, skills, passives: passives(c),
    hitDie: hitDieFor(c.class),
    hitDiceLeft: typeof c.hitDiceRemaining === "number" ? c.hitDiceRemaining : level,
    highlightSkill: hi, highlightAbility,
  };
}

export function CharacterRail({ character: c, highlightSkill, variant = "rail" }: { character: RailCharacter; highlightSkill?: string | null; variant?: "rail" | "strip" }) {
  const sheet = buildCharacterSheet(c, highlightSkill);
  const [open, setOpen] = useState(false);
  const subtitle = [c.race, `${c.class} ${sheet.level}`, sheet.subclassName].filter(Boolean).join(" · ");

  if (variant === "strip" && !open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="ed-card mb-3 flex w-full items-center gap-3 px-3 py-2 text-left" data-testid="character-strip">
        <span className="ed-title text-base">{c.name}</span>
        <span className="text-xs ed-muted">{c.class} {sheet.level}</span>
        <span className="ml-auto flex gap-3 text-sm">
          <span>HP <b>{c.hitPoints}/{c.maxHitPoints}</b></span>
          <span>AC <b>{c.armorClass ?? 10}</b></span>
          <span>Prof <b>+{sheet.prof}</b></span>
          {c.inspiration ? <span className="ed-gold">☆</span> : null}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-3 text-[var(--ed-ink)]" data-testid="character-rail">
      <div className="ed-card flex items-center gap-3 p-3">
        {c.portraitUrl ? (
          <img src={c.portraitUrl} alt="" className="h-11 w-11 rounded-lg object-cover" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--ed-card-hi)] ed-title text-xl ed-gold">{c.name.charAt(0)}</div>
        )}
        <div className="min-w-0">
          <div className="ed-title truncate text-[1.05rem]">{c.name}</div>
          <div className="truncate text-xs ed-muted">{subtitle}</div>
        </div>
        {variant === "strip" && (
          <button type="button" onClick={() => setOpen(false)} className="ml-auto text-xs ed-muted hover:text-[var(--ed-ink)]">Close</button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="ed-stat"><div className="text-[0.65rem] ed-muted">HP</div><div className="text-lg font-bold">{c.hitPoints}/{c.maxHitPoints}</div></div>
        <div className="ed-stat"><div className="text-[0.65rem] ed-muted">AC</div><div className="text-lg font-bold">{c.armorClass ?? 10}</div></div>
        <div className="ed-stat"><div className="text-[0.65rem] ed-muted">Prof.</div><div className="text-lg font-bold">+{sheet.prof}</div></div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {ABILITY_NAMES.map((a) => (
          <div key={a} className={`ed-stat ${sheet.highlightAbility === a ? "ed-stat-hi" : ""}`}>
            <div className={`text-[0.65rem] ${sheet.highlightAbility === a ? "ed-gold" : "ed-muted"}`}>{ABILITY_ABBR[a]} {(c as any)[a]}</div>
            <div className={`text-base font-bold ${sheet.highlightAbility === a ? "ed-gold" : ""}`}>{signed(mod((c as any)[a]))}</div>
          </div>
        ))}
      </div>

      {sheet.skills.length > 0 && (
        <div className="ed-card p-3">
          <div className="ed-label mb-1.5">Skills in play</div>
          {sheet.skills.map((s) => (
            <div key={s.key} className={`flex justify-between py-0.5 text-sm ${s.key === sheet.highlightSkill ? "ed-gold" : ""}`}>
              <span>{s.label}{s.expertise ? <span className="ed-muted"> (Expertise)</span> : !s.proficient ? <span className="ed-muted"> (untrained)</span> : null}</span>
              <span className="font-semibold">{signed(s.total)}</span>
            </div>
          ))}
          <div className="my-1.5 border-t border-[var(--ed-line)]" />
          <div className="flex justify-between py-0.5 text-sm"><span>Passive Perception</span><span className="font-semibold">{sheet.passives.perception}</span></div>
          <div className="flex justify-between py-0.5 text-sm"><span>Passive Insight</span><span className="font-semibold">{sheet.passives.insight}</span></div>
          <div className="flex justify-between py-0.5 text-sm"><span>Passive Investigation</span><span className="font-semibold">{sheet.passives.investigation}</span></div>
        </div>
      )}

      <div className="ed-card p-3">
        <div className="ed-label mb-1.5">Features</div>
        {sheet.features.length === 0 && <p className="text-sm ed-muted">Class features appear here as you level.</p>}
        {sheet.features.map((f) => (
          <div key={f.id} className="flex justify-between gap-2 py-0.5 text-sm" title={f.summary}>
            <span>{f.name}</span>
            <span className="shrink-0 ed-muted">{f.fromSubclass && sheet.subclassName ? sheet.subclassName : f.detail}</span>
          </div>
        ))}
        <div className="flex justify-between py-0.5 text-sm"><span>Hit Dice</span><span className="ed-muted">{sheet.hitDiceLeft} of {sheet.level} d{sheet.hitDie}</span></div>
      </div>
    </div>
  );
}
