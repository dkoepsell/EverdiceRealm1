export interface AdventureRequirements {
  encounters: {
    combat: number;
    trap: number;
    treasure: number;
    total: number;
  };
  puzzles: number;
  discoveries: number;
  subquests: number;
}

export interface AdventureProgress {
  encounters: {
    combat: number;
    trap: number;
    treasure: number;
    total: number;
  };
  puzzles: number;
  discoveries: number;
  subquestsCompleted: number;
  startedAt: string;
  completedAt?: string;
  isComplete: boolean;
}

export const DIFFICULTY_REQUIREMENTS: Record<string, AdventureRequirements> = {
  "Easy - Relaxed Story": {
    encounters: {
      combat: 2,
      trap: 1,
      treasure: 2,
      total: 5
    },
    puzzles: 1,
    discoveries: 3,
    subquests: 1
  },
  "Normal - Balanced Challenge": {
    encounters: {
      combat: 4,
      trap: 2,
      treasure: 3,
      total: 9
    },
    puzzles: 2,
    discoveries: 5,
    subquests: 2
  },
  "Hard - Challenging Adventure": {
    encounters: {
      combat: 6,
      trap: 4,
      treasure: 4,
      total: 14
    },
    puzzles: 4,
    discoveries: 7,
    subquests: 3
  },
  "Deadly - Extreme Danger": {
    encounters: {
      combat: 10,
      trap: 6,
      treasure: 5,
      total: 21
    },
    puzzles: 5,
    discoveries: 10,
    subquests: 4
  }
};

export const SUBQUEST_REQUIREMENTS: Record<string, { encounters: number; puzzles: number }> = {
  "Easy - Relaxed Story": {
    encounters: 1,
    puzzles: 0
  },
  "Normal - Balanced Challenge": {
    encounters: 2,
    puzzles: 1
  },
  "Hard - Challenging Adventure": {
    encounters: 3,
    puzzles: 1
  },
  "Deadly - Extreme Danger": {
    encounters: 4,
    puzzles: 2
  }
};

export function getRequirementsForDifficulty(difficulty: string): AdventureRequirements {
  return DIFFICULTY_REQUIREMENTS[difficulty] || DIFFICULTY_REQUIREMENTS["Normal - Balanced Challenge"];
}

export function getSubquestRequirements(difficulty: string): { encounters: number; puzzles: number } {
  return SUBQUEST_REQUIREMENTS[difficulty] || SUBQUEST_REQUIREMENTS["Normal - Balanced Challenge"];
}

export function createEmptyProgress(): AdventureProgress {
  return {
    encounters: {
      combat: 0,
      trap: 0,
      treasure: 0,
      total: 0
    },
    puzzles: 0,
    discoveries: 0,
    subquestsCompleted: 0,
    startedAt: new Date().toISOString(),
    isComplete: false
  };
}

export function checkAdventureCompletion(
  progress: AdventureProgress,
  requirements: AdventureRequirements
): { isComplete: boolean; percentComplete: number; remaining: Partial<AdventureRequirements> } {
  const combatComplete = progress.encounters.combat >= requirements.encounters.combat;
  const trapComplete = progress.encounters.trap >= requirements.encounters.trap;
  const treasureComplete = progress.encounters.treasure >= requirements.encounters.treasure;
  const puzzlesComplete = progress.puzzles >= requirements.puzzles;
  const discoveriesComplete = progress.discoveries >= requirements.discoveries;
  const subquestsComplete = progress.subquestsCompleted >= requirements.subquests;
  
  const isComplete = combatComplete && trapComplete && treasureComplete && 
                     puzzlesComplete && discoveriesComplete && subquestsComplete;
  
  const totalRequired = requirements.encounters.total + requirements.puzzles + 
                       requirements.discoveries + requirements.subquests;
  const totalProgress = Math.min(progress.encounters.total, requirements.encounters.total) +
                       Math.min(progress.puzzles, requirements.puzzles) +
                       Math.min(progress.discoveries, requirements.discoveries) +
                       Math.min(progress.subquestsCompleted, requirements.subquests);
  
  const percentComplete = Math.floor((totalProgress / totalRequired) * 100);
  
  return {
    isComplete,
    percentComplete,
    remaining: {
      encounters: {
        combat: Math.max(0, requirements.encounters.combat - progress.encounters.combat),
        trap: Math.max(0, requirements.encounters.trap - progress.encounters.trap),
        treasure: Math.max(0, requirements.encounters.treasure - progress.encounters.treasure),
        total: Math.max(0, requirements.encounters.total - progress.encounters.total)
      },
      puzzles: Math.max(0, requirements.puzzles - progress.puzzles),
      discoveries: Math.max(0, requirements.discoveries - progress.discoveries),
      subquests: Math.max(0, requirements.subquests - progress.subquestsCompleted)
    }
  };
}

export function formatProgressSummary(
  progress: AdventureProgress,
  requirements: AdventureRequirements
): string {
  const { percentComplete, remaining } = checkAdventureCompletion(progress, requirements);
  
  const parts: string[] = [];
  
  if (remaining.encounters?.combat && remaining.encounters.combat > 0) {
    parts.push(`${remaining.encounters.combat} combat${remaining.encounters.combat > 1 ? 's' : ''}`);
  }
  if (remaining.encounters?.trap && remaining.encounters.trap > 0) {
    parts.push(`${remaining.encounters.trap} trap${remaining.encounters.trap > 1 ? 's' : ''}`);
  }
  if (remaining.puzzles && remaining.puzzles > 0) {
    parts.push(`${remaining.puzzles} puzzle${remaining.puzzles > 1 ? 's' : ''}`);
  }
  if (remaining.subquests && remaining.subquests > 0) {
    parts.push(`${remaining.subquests} subquest${remaining.subquests > 1 ? 's' : ''}`);
  }
  
  if (parts.length === 0) {
    return `Adventure complete! (${percentComplete}%)`;
  }
  
  return `${percentComplete}% complete - Remaining: ${parts.join(', ')}`;
}
