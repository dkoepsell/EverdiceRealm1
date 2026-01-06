export interface CAMLGateExpr {
  fact?: string;
  op?: '==' | '!=' | '<' | '>' | '<=' | '>=' | 'in' | 'contains';
  value?: any;
}

export interface CAMLGate {
  all?: (string | CAMLGateExpr)[];
  any?: (string | CAMLGateExpr)[];
  not?: string | CAMLGateExpr;
}

export interface CAMLOutcomeStep {
  set?: string;
  inc?: string;
  dec?: string;
  by?: number;
  addTag?: string;
  removeTag?: string;
  transfer?: Record<string, any>;
}

export interface CAMLAbilities {
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
}

export interface CAMLAction {
  name: string;
  description?: string;
  attackBonus?: number;
  damage?: string;
  damageType?: string;
  reach?: string;
  range?: string;
  save?: {
    ability: string;
    dc: number;
  };
}

export interface CAMLSpellcasting {
  ability: string;
  spellSaveDC?: number;
  spellAttackBonus?: number;
  spells?: {
    level: number;
    slots?: number;
    known: string[];
  }[];
}

export interface CAMLDefenses {
  resistances?: string[];
  immunities?: string[];
  vulnerabilities?: string[];
  conditionImmunities?: string[];
}

export interface CAMLStatblock {
  ac?: number;
  hp?: number;
  hitDice?: string;
  speed?: string;
  abilities?: CAMLAbilities;
  saves?: Partial<CAMLAbilities>;
  skills?: Record<string, number>;
  senses?: string;
  languages?: string;
  cr?: string;
  proficiencyBonus?: number;
}

export interface CAMLBaseEntity {
  id: string;
  type: 'AdventureModule' | 'Location' | 'NPC' | 'Item' | 'Encounter' | 'Quest' | 'Faction' | 'Handout' | 'StateFact' | 'PC' | 'Spell' | 'Condition' | 'ClassFeature' | 'MonsterFeature';
  name?: string;
  description?: string;
  tags?: string[];
  links?: string[];
  ruleset?: string;
  occursAt?: string;
  participants?: string[];
  gates?: CAMLGate;
  outcomes?: Record<string, CAMLOutcomeStep[]>;
}

export interface CAMLLocation extends CAMLBaseEntity {
  type: 'Location';
  parentLocation?: string;
  connections?: {
    direction: string;
    target: string;
    description?: string;
  }[];
  features?: string[];
  encounters?: string[];
  items?: string[];
  npcs?: string[];
}

export interface CAMLNPC extends CAMLBaseEntity {
  type: 'NPC';
  race?: string;
  class?: string;
  level?: number;
  alignment?: string;
  statblock?: CAMLStatblock;
  abilities?: CAMLAbilities;
  proficiency?: Record<string, any>;
  defenses?: CAMLDefenses;
  actions?: CAMLAction[];
  bonusActions?: CAMLAction[];
  reactions?: CAMLAction[];
  spellcasting?: CAMLSpellcasting | null;
  resources?: Record<string, any>;
  faction?: string;
  attitude?: 'friendly' | 'neutral' | 'hostile';
  startsAt?: string;
  dialogue?: {
    greeting?: string;
    topics?: Record<string, string>;
  };
}

export interface CAMLItem extends CAMLBaseEntity {
  type: 'Item';
  itemType?: 'weapon' | 'armor' | 'wondrous' | 'consumable' | 'treasure' | 'tool' | 'misc';
  rarity?: 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary' | 'artifact';
  attunement?: boolean;
  properties?: string;
  value?: string;
  weight?: number;
}

export interface CAMLEncounter extends CAMLBaseEntity {
  type: 'Encounter';
  encounterType?: 'combat' | 'social' | 'exploration' | 'puzzle' | 'trap' | 'treasure';
  difficulty?: 'easy' | 'medium' | 'hard' | 'deadly';
  occursAt?: string;
  gates?: CAMLGate;
  outcomes?: {
    success?: CAMLOutcomeStep[];
    failure?: CAMLOutcomeStep[];
    partial?: CAMLOutcomeStep[];
  };
  enemies?: {
    id: string;
    count: number;
  }[];
  rewards?: {
    xp?: number;
    gold?: number;
    items?: string[];
  };
  resolution?: {
    success?: CAMLOutcomeStep[];
    failure?: CAMLOutcomeStep[];
    partial?: CAMLOutcomeStep[];
  };
  setup?: string;
  tactics?: string;
  treasure?: string;
}

export interface CAMLQuest extends CAMLBaseEntity {
  type: 'Quest';
  questGiver?: string;
  objectives?: {
    id: string;
    description: string;
    optional?: boolean;
    completed?: boolean;
  }[];
  rewards?: {
    xp?: number;
    gold?: number;
    items?: string[];
    reputation?: Record<string, number>;
  };
  stages?: {
    id: string;
    name: string;
    description: string;
    gates?: CAMLGate;
  }[];
}

export interface CAMLFaction extends CAMLBaseEntity {
  type: 'Faction';
  leader?: string;
  members?: string[];
  allies?: string[];
  enemies?: string[];
  headquarters?: string;
  goals?: string[];
}

export interface CAMLHandout extends CAMLBaseEntity {
  type: 'Handout';
  content: string;
  handoutType?: 'journal' | 'letter' | 'map' | 'note' | 'book';
  author?: string;
}

export interface CAMLAdventureModule extends CAMLBaseEntity {
  type: 'AdventureModule';
  title: string;
  author?: string;
  version?: string;
  minLevel?: number;
  maxLevel?: number;
  estimatedDuration?: string;
  setting?: string;
  synopsis?: string;
  hooks?: string[];
  startingLocation?: string;
  locations?: CAMLLocation[];
  npcs?: CAMLNPC[];
  items?: CAMLItem[];
  encounters?: CAMLEncounter[];
  quests?: CAMLQuest[];
  factions?: CAMLFaction[];
  handouts?: CAMLHandout[];
  initialState?: Record<string, any>;
}

export type CAMLEntity = CAMLLocation | CAMLNPC | CAMLItem | CAMLEncounter | CAMLQuest | CAMLFaction | CAMLHandout | CAMLAdventureModule;

export interface CAMLAdventurePack {
  adventure: CAMLAdventureModule;
  entities: Record<string, CAMLEntity>;
}

export function validateCAMLEntity(entity: any): entity is CAMLBaseEntity {
  return entity && typeof entity.id === 'string' && typeof entity.type === 'string';
}

export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function calculateCR(statblock: CAMLStatblock): string {
  if (statblock.cr) return statblock.cr;
  const hp = statblock.hp || 10;
  const ac = statblock.ac || 10;
  if (hp <= 6) return '0';
  if (hp <= 35) return '1/4';
  if (hp <= 49) return '1/2';
  if (hp <= 70) return '1';
  if (hp <= 85) return '2';
  if (hp <= 100) return '3';
  if (hp <= 115) return '4';
  if (hp <= 130) return '5';
  return Math.min(30, Math.floor(hp / 15)).toString();
}
