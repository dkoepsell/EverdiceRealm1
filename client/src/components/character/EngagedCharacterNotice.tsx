import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Swords, Loader2 } from "lucide-react";
import type { CharacterEngagement } from "@shared/schema";

/** A character row as returned by GET /api/characters (engagement attached). */
export interface CharacterWithEngagement {
  id: number;
  name: string;
  engagement?: CharacterEngagement | null;
  [key: string]: any;
}

export function isEngaged(character?: CharacterWithEngagement | null): boolean {
  return !!character?.engagement;
}

/** "Thalia — deep in a dungeon" for use in disabled dropdown options. */
export function engagementSuffix(character?: CharacterWithEngagement | null): string {
  return character?.engagement ? ` — ${character.engagement.label}` : "";
}

interface Props {
  character: CharacterWithEngagement;
  /** What the player was trying to do, e.g. "visit the tavern". */
  activity?: string;
  className?: string;
}

/**
 * Shown on town surfaces (tavern, trading post) when the selected character is
 * out in the field.
 *
 * Playtest feedback: "a character should be either in an adventure or out of
 * one, and if he's in an adventure, the tavern shouldn't be available... you
 * shouldn't be able to wander or tavern with the same character that's in an
 * adventure."
 *
 * Rather than hiding the surface entirely, we explain where the character is
 * and offer the one action that resolves it.
 */
export default function EngagedCharacterNotice({ character, activity = "do this", className }: Props) {
  const { toast } = useToast();

  const returnToTown = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/characters/${character.id}/return-to-town`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      toast({
        title: `${character.name} is back in town`,
        description: "You can pick up the adventure again whenever you like.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Couldn't return to town", description: error.message, variant: "destructive" });
    },
  });

  if (!character.engagement) return null;

  return (
    <Alert className={`border-amber-500/40 bg-amber-950/30 ${className || ""}`} data-testid="alert-character-engaged">
      <Swords className="h-4 w-4 text-amber-400" />
      <AlertTitle className="text-amber-200">
        {character.name} is {character.engagement.label}
      </AlertTitle>
      <AlertDescription className="text-amber-100/70">
        <p className="mb-3">
          A character can only be in one place at a time, so {character.name} can't {activity} while
          out in the field. Return to town first, or switch to another character.
        </p>
        <Button
          size="sm"
          className="bg-amber-600 hover:bg-amber-500 text-white"
          onClick={() => returnToTown.mutate()}
          disabled={returnToTown.isPending}
          data-testid="button-return-to-town"
        >
          {returnToTown.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Returning…</>
          ) : (
            <>Return to town</>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
