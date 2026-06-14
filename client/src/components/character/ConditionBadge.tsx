import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActiveCondition {
  name: string;       // lowercase condition name, e.g. "poisoned"
  source: string;     // what applied it
  endsOnTurn?: number | null;
  isConcentration?: boolean;
}

const CONDITION_META: Record<string, {
  label: string;
  color: string;      // tailwind bg color class
  textColor: string;
  description: string;
  mechanical: string;
}> = {
  blinded: {
    label: "Blinded",
    color: "bg-gray-700",
    textColor: "text-gray-200",
    description: "Cannot see.",
    mechanical: "Your attacks have disadvantage. Attacks against you have advantage. You auto-fail sight-based checks.",
  },
  charmed: {
    label: "Charmed",
    color: "bg-pink-800",
    textColor: "text-pink-200",
    description: "Magically charmed.",
    mechanical: "Cannot attack the charmer. Charmer has advantage on social checks against you.",
  },
  frightened: {
    label: "Frightened",
    color: "bg-yellow-800",
    textColor: "text-yellow-200",
    description: "Gripped by fear.",
    mechanical: "Disadvantage on attack rolls and ability checks while source is visible. Cannot willingly move closer to the source.",
  },
  grappled: {
    label: "Grappled",
    color: "bg-orange-800",
    textColor: "text-orange-200",
    description: "Held in place.",
    mechanical: "Speed becomes 0. Grapple ends if the grappler is incapacitated or you escape (STR or DEX vs. grappler's Athletics).",
  },
  incapacitated: {
    label: "Incapacitated",
    color: "bg-red-900",
    textColor: "text-red-200",
    description: "Cannot act.",
    mechanical: "Cannot take actions or reactions.",
  },
  invisible: {
    label: "Invisible",
    color: "bg-slate-600",
    textColor: "text-slate-200",
    description: "Cannot be seen.",
    mechanical: "Your attacks have advantage. Attacks against you have disadvantage. Detectable by noise.",
  },
  paralyzed: {
    label: "Paralyzed",
    color: "bg-purple-900",
    textColor: "text-purple-200",
    description: "Completely frozen.",
    mechanical: "Incapacitated, cannot move or speak. Any hit within 5 ft is a critical hit. Automatically fails STR and DEX saves.",
  },
  petrified: {
    label: "Petrified",
    color: "bg-stone-700",
    textColor: "text-stone-200",
    description: "Turned to stone.",
    mechanical: "Incapacitated. Resistance to all damage. Attacks against have advantage. Unaware of surroundings.",
  },
  poisoned: {
    label: "Poisoned",
    color: "bg-green-900",
    textColor: "text-green-200",
    description: "Suffering from poison.",
    mechanical: "Disadvantage on attack rolls and ability checks.",
  },
  prone: {
    label: "Prone",
    color: "bg-amber-900",
    textColor: "text-amber-200",
    description: "Lying on the ground.",
    mechanical: "Can only crawl (costs double movement). Melee attacks against you have advantage; ranged attacks have disadvantage. Stand up = half movement.",
  },
  restrained: {
    label: "Restrained",
    color: "bg-indigo-900",
    textColor: "text-indigo-200",
    description: "Bound or held.",
    mechanical: "Speed becomes 0. Attack rolls have disadvantage. Attacks against you have advantage. Disadvantage on DEX saves.",
  },
  stunned: {
    label: "Stunned",
    color: "bg-blue-900",
    textColor: "text-blue-200",
    description: "Dazed and unable to act.",
    mechanical: "Incapacitated, cannot move, can only speak falteringly. Attacks against have advantage. Fails STR and DEX saves.",
  },
  unconscious: {
    label: "Unconscious",
    color: "bg-slate-900",
    textColor: "text-slate-300",
    description: "Knocked out.",
    mechanical: "Incapacitated, prone, cannot move or speak. Any hit within 5 ft is a critical hit. Fails STR and DEX saves.",
  },
  exhaustion: {
    label: "Exhaustion",
    color: "bg-rose-900",
    textColor: "text-rose-200",
    description: "Severely fatigued.",
    mechanical: "Level 1: disadvantage on ability checks. Level 2: halved speed. Level 3+: disadvantage on attacks and saves. Level 6: death.",
  },
};

interface ConditionBadgeProps {
  condition: ActiveCondition;
  characterId?: number;
  canRemove?: boolean;
  size?: "sm" | "md";
}

export function ConditionBadge({ condition, characterId, canRemove = false, size = "md" }: ConditionBadgeProps) {
  const queryClient = useQueryClient();
  const meta = CONDITION_META[condition.name] ?? {
    label: condition.name.charAt(0).toUpperCase() + condition.name.slice(1),
    color: "bg-slate-700",
    textColor: "text-slate-200",
    description: "",
    mechanical: "",
  };

  const removeMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/characters/${characterId}/conditions/remove`, { name: condition.name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/characters/${characterId}/conditions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/characters/${characterId}`] });
    },
  });

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium cursor-help select-none",
              meta.color,
              meta.textColor,
              size === "sm" ? "text-[10px]" : "text-xs"
            )}
          >
            {meta.label}
            {canRemove && characterId && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeMutation.mutate();
                }}
                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                aria-label={`Remove ${meta.label}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs p-0 overflow-hidden bg-slate-900 border-amber-500/30">
          <div className={cn("px-3 py-2 border-b border-amber-500/20", meta.color)}>
            <h4 className={cn("font-semibold text-sm", meta.textColor)}>{meta.label}</h4>
            {meta.description && (
              <p className="text-xs opacity-75 text-white mt-0.5">{meta.description}</p>
            )}
          </div>
          <div className="p-3 space-y-1.5">
            {meta.mechanical && (
              <p className="text-xs text-slate-300">{meta.mechanical}</p>
            )}
            <p className="text-xs text-slate-500">
              Source: <span className="text-slate-400">{condition.source}</span>
              {condition.isConcentration && " (concentration)"}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Displays a row of condition badges for a character.
 * Fetches conditions from the API if characterId is provided.
 */
interface ConditionRowProps {
  characterId: number;
  canRemove?: boolean;
  /** Pass conditions directly (e.g. from a parent query) to avoid a second fetch */
  conditions?: ActiveCondition[];
}

export function ConditionRow({ characterId, canRemove = false, conditions: propConditions }: ConditionRowProps) {
  const { data } = useQuery<{ conditions: ActiveCondition[] }>({
    queryKey: [`/api/characters/${characterId}/conditions`],
    enabled: propConditions === undefined,
  });

  const conditions = propConditions ?? data?.conditions ?? [];

  if (conditions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {conditions.map((c) => (
        <ConditionBadge
          key={c.name}
          condition={c}
          characterId={characterId}
          canRemove={canRemove}
        />
      ))}
    </div>
  );
}

/**
 * DM condition picker — lets the DM apply any of the 14 SRD conditions to a character.
 */
interface ConditionPickerProps {
  characterId: number;
  currentConditions: ActiveCondition[];
}

export function ConditionPicker({ characterId, currentConditions }: ConditionPickerProps) {
  const queryClient = useQueryClient();
  const ALL_CONDITIONS = Object.keys(CONDITION_META);
  const activeNames = new Set(currentConditions.map((c) => c.name));

  const addMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest("POST", `/api/characters/${characterId}/conditions/add`, {
        name,
        source: "DM Applied",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/characters/${characterId}/conditions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/characters/${characterId}`] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest("POST", `/api/characters/${characterId}/conditions/remove`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/characters/${characterId}/conditions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/characters/${characterId}`] });
    },
  });

  return (
    <div className="flex flex-wrap gap-1">
      {ALL_CONDITIONS.map((name) => {
        const meta = CONDITION_META[name];
        const isActive = activeNames.has(name);
        return (
          <button
            key={name}
            type="button"
            onClick={() => isActive ? removeMutation.mutate(name) : addMutation.mutate(name)}
            className={cn(
              "px-2 py-0.5 rounded text-xs font-medium border transition-all",
              isActive
                ? `${meta.color} ${meta.textColor} border-transparent`
                : "bg-transparent border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200"
            )}
          >
            {isActive ? "✓ " : ""}{meta.label}
          </button>
        );
      })}
    </div>
  );
}
