export type ThreatTier = 'low' | 'medium' | 'high' | 'apex';
export type PlaystyleRole = 'brute' | 'skirmisher' | 'controller' | 'support' | 'solo' | 'swarm';
export type DifficultyBand = 'easy' | 'standard' | 'deadly';
export type DamageProfile = 'low' | 'mixed' | 'high';
export type SavePressure = 'physical' | 'mental' | 'mixed';

export interface NarrativeFunction {
  purpose: string;
  storyPressure: string;
  whenToUse: string;
}

export interface Behavior {
  defaultTactic: string;
  underPressure: string;
  whenWinning: string;
  whenLosing: string;
}

export interface EscalationStage {
  stage: number;
  description: string;
}

export interface Escalation {
  trigger: string;
  stages: EscalationStage[];
}

export interface Consequences {
  ifPlayersSucceed: string[];
  ifPlayersFail: string[];
  ifPlayersDelay: string[];
  unexpectedPlayerAction: string[];
}

export interface SystemAdapter {
  difficultyBand: DifficultyBand;
  damageProfile: DamageProfile;
  savePressure: SavePressure;
}

export interface ThreatArchetype {
  archetypeId: string;
  displayName: string;
  threatTier: ThreatTier;
  playstyleRole: PlaystyleRole;
  narrativeFunction: NarrativeFunction;
  behavior: Behavior;
  escalation: Escalation;
  consequences: Consequences;
  systemAdapters?: {
    dnd5eStub?: SystemAdapter;
  };
  reskins: string[];
  dmNote: string;
}

export const THREAT_TIER_INFO: Record<ThreatTier, { label: string; color: string; description: string }> = {
  low: { label: 'Low', color: 'bg-green-500/20 text-green-400 border-green-500/30', description: 'Suitable for early encounters, introduces mechanics gently' },
  medium: { label: 'Medium', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', description: 'Requires tactical thinking, good for mid-adventure challenges' },
  high: { label: 'High', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', description: 'Significant danger, requires preparation and strategy' },
  apex: { label: 'Apex', color: 'bg-red-500/20 text-red-400 border-red-500/30', description: 'Campaign-defining threats, climactic moments only' }
};

export const PLAYSTYLE_ROLE_INFO: Record<PlaystyleRole, { label: string; icon: string; description: string }> = {
  brute: { label: 'Brute', icon: '🛡️', description: 'Controls space through raw power and intimidation' },
  skirmisher: { label: 'Skirmisher', icon: '⚡', description: 'Hit-and-run tactics, punishes overextension' },
  controller: { label: 'Controller', icon: '🌀', description: 'Warps the battlefield, forces prioritization' },
  support: { label: 'Support', icon: '🔮', description: 'Empowers other threats, creates moral tension' },
  solo: { label: 'Solo', icon: '👑', description: 'Defines the encounter alone, dramatic presence' },
  swarm: { label: 'Swarm', icon: '🐝', description: 'Overwhelms through numbers, tests resource management' }
};

export const BEGINNER_THREAT_PACK: ThreatArchetype[] = [
  {
    archetypeId: 'territorial-brute',
    displayName: 'Territorial Brute',
    threatTier: 'low',
    playstyleRole: 'brute',
    narrativeFunction: {
      purpose: 'Controls space through force',
      storyPressure: 'Forces players to commit or retreat',
      whenToUse: 'Early dungeons, roadblocks, guardians'
    },
    behavior: {
      defaultTactic: 'Blocks movement and attacks nearest threat',
      underPressure: 'Becomes reckless',
      whenWinning: 'Presses advantage',
      whenLosing: 'Tries to smash an escape'
    },
    escalation: {
      trigger: 'Players linger',
      stages: [
        { stage: 1, description: 'Loud warnings' },
        { stage: 2, description: 'Reinforced defenses' },
        { stage: 3, description: 'Environmental damage' }
      ]
    },
    consequences: {
      ifPlayersSucceed: ['Path is clear', 'Loot or resource available', 'Other creatures become wary'],
      ifPlayersFail: ['Forced retreat', 'Resource loss', 'Territory expands'],
      ifPlayersDelay: ['Reinforcements arrive', 'Environment becomes hazardous'],
      unexpectedPlayerAction: ['Parley possible if clever', 'Distraction creates opening']
    },
    systemAdapters: {
      dnd5eStub: {
        difficultyBand: 'easy',
        damageProfile: 'high',
        savePressure: 'physical'
      }
    },
    reskins: ['Ogre', 'Stone guardian', 'Mutated beast', 'Territorial bear', 'Cave troll'],
    dmNote: 'This creature exists to be obvious. Let it be simple. New DMs: if you\'re unsure what it would do, have it attack the closest thing.'
  },
  {
    archetypeId: 'cunning-skirmisher',
    displayName: 'Cunning Skirmisher',
    threatTier: 'low',
    playstyleRole: 'skirmisher',
    narrativeFunction: {
      purpose: 'Punishes careless movement',
      storyPressure: 'Creates tactical tension',
      whenToUse: 'Forests, ruins, ambush scenes'
    },
    behavior: {
      defaultTactic: 'Hit-and-run',
      underPressure: 'Disengages',
      whenWinning: 'Taunts and isolates',
      whenLosing: 'Retreats or surrenders'
    },
    escalation: {
      trigger: 'Players overextend',
      stages: [
        { stage: 1, description: 'Hit-and-fade' },
        { stage: 2, description: 'Coordinated attack' },
        { stage: 3, description: 'Full withdrawal' }
      ]
    },
    consequences: {
      ifPlayersSucceed: ['Ambush location secured', 'Information obtained', 'Morale boost'],
      ifPlayersFail: ['Supplies stolen', 'Party separated', 'Reputation damaged'],
      ifPlayersDelay: ['More skirmishers arrive', 'Trap complexity increases'],
      unexpectedPlayerAction: ['Can be bribed or intimidated', 'May reveal boss location to save self']
    },
    systemAdapters: {
      dnd5eStub: {
        difficultyBand: 'easy',
        damageProfile: 'low',
        savePressure: 'physical'
      }
    },
    reskins: ['Goblin scout', 'Bandit', 'Fey trickster', 'Street urchin gang', 'Kobold ambusher'],
    dmNote: 'If unsure, have it retreat. Retreat is still action. This teaches players that enemies can be smart too.'
  },
  {
    archetypeId: 'fragile-controller',
    displayName: 'Fragile Controller',
    threatTier: 'medium',
    playstyleRole: 'controller',
    narrativeFunction: {
      purpose: 'Warps the battlefield',
      storyPressure: 'Forces prioritization',
      whenToUse: 'Boss support, magical sites'
    },
    behavior: {
      defaultTactic: 'Alters terrain or minds',
      underPressure: 'Seeks protection',
      whenWinning: 'Increases chaos',
      whenLosing: 'Tries to escape or bargain'
    },
    escalation: {
      trigger: 'Ignored for too long',
      stages: [
        { stage: 1, description: 'Minor disruption' },
        { stage: 2, description: 'Area denial' },
        { stage: 3, description: 'Battlefield lockdown' }
      ]
    },
    consequences: {
      ifPlayersSucceed: ['Battlefield returns to normal', 'Magical knowledge gained', 'Other enemies weakened'],
      ifPlayersFail: ['Terrain permanently altered', 'Party debuffed', 'Escape routes blocked'],
      ifPlayersDelay: ['Controller grows in power', 'Allies become harder to defeat'],
      unexpectedPlayerAction: ['Power source can be disrupted', 'May offer arcane knowledge for freedom']
    },
    systemAdapters: {
      dnd5eStub: {
        difficultyBand: 'standard',
        damageProfile: 'low',
        savePressure: 'mental'
      }
    },
    reskins: ['Cult caster', 'Psionic entity', 'Arcane device', 'Corrupted druid', 'Bound elemental'],
    dmNote: 'If players focus it early, reward them. This teaches target prioritization. The fragility is intentional.'
  },
  {
    archetypeId: 'corrupted-ally',
    displayName: 'Corrupted Ally',
    threatTier: 'medium',
    playstyleRole: 'support',
    narrativeFunction: {
      purpose: 'Moral tension',
      storyPressure: 'Forces hard choices',
      whenToUse: 'Personal stakes'
    },
    behavior: {
      defaultTactic: 'Hesitant aggression',
      underPressure: 'Emotional reactions',
      whenWinning: 'Doubles down',
      whenLosing: 'Breaks or pleads'
    },
    escalation: {
      trigger: 'Emotional confrontation',
      stages: [
        { stage: 1, description: 'Verbal conflict' },
        { stage: 2, description: 'Reluctant violence' },
        { stage: 3, description: 'Irreversible harm' }
      ]
    },
    consequences: {
      ifPlayersSucceed: ['Ally redeemed or freed', 'Emotional resolution', 'New information revealed'],
      ifPlayersFail: ['Ally lost permanently', 'Party guilt', 'Enemy gains advantage'],
      ifPlayersDelay: ['Corruption deepens', 'Harder to save', 'Collateral damage'],
      unexpectedPlayerAction: ['Non-violent solutions work well', 'Past connections can break control']
    },
    systemAdapters: {
      dnd5eStub: {
        difficultyBand: 'standard',
        damageProfile: 'mixed',
        savePressure: 'mental'
      }
    },
    reskins: ['Mind-controlled friend', 'Possessed guard', 'Blackmailed official', 'Cursed family member', 'Charmed rival'],
    dmNote: 'This threat is about choice, not damage. The best outcome is when players find a way to save them. Let them try.'
  },
  {
    archetypeId: 'apex-solo-threat',
    displayName: 'Apex Solo Threat',
    threatTier: 'apex',
    playstyleRole: 'solo',
    narrativeFunction: {
      purpose: 'Defines the arc',
      storyPressure: 'The world reacts to it',
      whenToUse: 'Climactic moments'
    },
    behavior: {
      defaultTactic: 'Dominates presence',
      underPressure: 'Escalates spectacle',
      whenWinning: 'Toys with players',
      whenLosing: 'Unleashes last reserve'
    },
    escalation: {
      trigger: 'Time or damage thresholds',
      stages: [
        { stage: 1, description: 'Threat display' },
        { stage: 2, description: 'Environmental devastation' },
        { stage: 3, description: 'Final transformation' }
      ]
    },
    consequences: {
      ifPlayersSucceed: ['Arc resolved', 'Major reward', 'World changed for better'],
      ifPlayersFail: ['Major setback', 'World changed for worse', 'New arc begins'],
      ifPlayersDelay: ['Destruction spreads', 'Stakes increase', 'Allies perish'],
      unexpectedPlayerAction: ['Weak points can be exploited', 'Unexpected alliances possible']
    },
    systemAdapters: {
      dnd5eStub: {
        difficultyBand: 'deadly',
        damageProfile: 'high',
        savePressure: 'mixed'
      }
    },
    reskins: ['Ancient predator', 'War construct', 'Elemental catastrophe', 'Awakened titan', 'Corrupted god-fragment'],
    dmNote: 'You are allowed to make this dramatic. This is the moment players will remember. Take your time, describe everything, let it feel epic.'
  }
];
