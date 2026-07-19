import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sword, Sparkles, BookOpen, Shield, ArrowRight, Dices, Users, Feather } from "lucide-react";
import type { UserIntent } from "@shared/onboarding";

/**
 * First-run funnel. Signup routes new users here (see auth-page.tsx). Goal:
 * from "just signed up" to "playing" in well under a minute. Step 0 sorts the
 * player by intent (new / experienced / DM-for-group / author) so each persona
 * lands on the right path instead of one forced GUIDED solo tutorial:
 *  - new_solo         -> guided solo tutorial (isTutorial => GUIDED scaffolding).
 *  - experienced_solo -> engaging solo/co-op, isTutorial:false + OPEN rung.
 *  - dm_group         -> /dm-toolkit?onboard=group (create campaign + invite group).
 *  - author           -> /dm-toolkit?onboard=author (campaign authoring).
 * If the visitor came from the guest demo we prefill their chosen class.
 */

interface Archetype {
  id: string;
  charClass: string;
  name: string;
  blurb: string;
  icon: React.ReactNode;
}

const ARCHETYPES: Archetype[] = [
  { id: "warrior", charClass: "Fighter", name: "The Warrior", blurb: "Stand at the front. Hit hard, hold the line.", icon: <Sword className="h-6 w-6" /> },
  { id: "trickster", charClass: "Rogue", name: "The Trickster", blurb: "Shadows, locks, and a blade when it counts.", icon: <Sparkles className="h-6 w-6" /> },
  { id: "mage", charClass: "Wizard", name: "The Mage", blurb: "Bend the world with words of power.", icon: <BookOpen className="h-6 w-6" /> },
  { id: "healer", charClass: "Cleric", name: "The Healer", blurb: "Keep the party standing. Faith and firepower.", icon: <Shield className="h-6 w-6" /> },
];

interface Tone {
  id: string;
  name: string;
  description: string;
  title: string;
}

const TONES: Tone[] = [
  { id: "classic", name: "Classic Fantasy", title: "The Road to Ravenhollow", description: "A hero, a road, and a village with a problem only you can solve." },
  { id: "mystery", name: "Dark Mystery", title: "The Quiet House", description: "Something is wrong in the old manor, and the truth is buried deep." },
  { id: "heroic", name: "High Adventure", title: "The Sunspire Gambit", description: "Grand stakes, bold deeds, and a name worth carving into legend." },
];

interface Intent {
  id: UserIntent;
  name: string;
  blurb: string;
  icon: React.ReactNode;
}

const INTENTS: Intent[] = [
  { id: "new_solo", name: "I'm new to tabletop", blurb: "Learn by playing — your Dungeon Master will guide you step by step.", icon: <BookOpen className="h-6 w-6" /> },
  { id: "experienced_solo", name: "I've played before", blurb: "Drop me into engaging solo or co-op play — go light on the hand-holding.", icon: <Sparkles className="h-6 w-6" /> },
  { id: "dm_group", name: "Run a game for my group", blurb: "Create a campaign and bring your established table along.", icon: <Users className="h-6 w-6" /> },
  { id: "author", name: "Plan & author campaigns", blurb: "Build worlds and adventures with the DM authoring tools.", icon: <Feather className="h-6 w-6" /> },
];

type Step = "intent" | "hero" | "tone";

/** Best-effort read of the class the visitor picked in the guest demo. */
function readDemoPrefill(): { charClass?: string } {
  try {
    const raw = localStorage.getItem("everdice_demo_choice");
    if (!raw) return {};
    const d = JSON.parse(raw);
    return { charClass: typeof d?.class === "string" ? d.class : undefined };
  } catch {
    return {};
  }
}

export default function BeginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [prefill] = useState(readDemoPrefill);
  const [intent, setIntent] = useState<UserIntent | null>(null);
  const [step, setStep] = useState<Step>("intent");
  const [archetype, setArchetype] = useState<Archetype | null>(
    prefill.charClass ? ARCHETYPES.find((a) => a.charClass === prefill.charClass) ?? null : null,
  );
  const [heroName, setHeroName] = useState("");
  const [tone, setTone] = useState<Tone | null>(null);

  const experienced = intent === "experienced_solo";

  // Persist the intent choice (best-effort telemetry; never blocks the flow).
  const recordIntent = (i: UserIntent) => {
    apiRequest("PATCH", "/api/user/onboarding", { intent: i }).catch(() => {});
  };

  const chooseIntent = (i: UserIntent) => {
    setIntent(i);
    recordIntent(i);
    if (i === "dm_group") {
      navigate("/dm-toolkit?onboard=group");
      return;
    }
    if (i === "author") {
      navigate("/dm-toolkit?onboard=author");
      return;
    }
    setStep("hero");
  };

  const start = useMutation({
    mutationFn: async () => {
      if (!archetype || !tone) throw new Error("Pick a hero and a tone first.");

      // 1. Create the solo campaign. Newcomers get the guided tutorial; experienced
      //    players skip it (no forced GUIDED rails).
      const campRes = await apiRequest("POST", "/api/campaigns", {
        title: tone.title,
        description: tone.description,
        difficulty: "balanced",
        narrativeStyle: "descriptive",
        setting: tone.id,
        isTutorial: !experienced,
      });
      const campaign = await campRes.json();

      // 2. Roll a hero of the chosen archetype, linked to the campaign as a participant.
      const charRes = await apiRequest("POST", "/api/characters/quick-build", {
        campaignId: campaign.id,
        class: archetype.charClass,
        ...(heroName.trim() ? { name: heroName.trim() } : {}),
      });
      const character = await charRes.json();

      // 2b. Experienced players start at the OPEN rung (safety net on, but no
      //     newbie coach-marks); they can still climb to PURE/expert in play.
      if (experienced) {
        try {
          await apiRequest("PUT", `/api/campaigns/${campaign.id}/guidance`, { mode: "OPEN" });
        } catch {
          /* non-fatal — defaults to GUIDED, still playable */
        }
      }

      // 3. Make this the active campaign so the dashboard opens straight into it.
      try {
        localStorage.setItem("activeCampaignId", String(campaign.id));
        localStorage.removeItem("everdice_demo_choice");
      } catch {
        /* private mode — the dashboard's most-recent fallback still selects it */
      }

      // 4. Record funnel completion (best-effort — never block play on it).
      try {
        await apiRequest("PATCH", "/api/user/onboarding", {
          intent: intent ?? "new_solo",
          funnel: {
            step: "playing",
            completedAt: new Date().toISOString(),
            campaignId: campaign.id,
            characterId: character.id,
            archetype: archetype.id,
            tone: tone.id,
          },
        });
      } catch {
        /* non-fatal */
      }

      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      navigate("/dashboard");
    },
    onError: (err: Error) => {
      toast({
        title: "The dice slipped",
        description: err.message || "Something went wrong starting your adventure. Try again.",
        variant: "destructive",
      });
    },
  });

  const busy = start.isPending;

  const heading =
    step === "intent" ? "What brings you here?" : step === "hero" ? "Choose your hero" : "Choose your tale";
  const subheading =
    step === "intent"
      ? "Pick the path that fits you — you can change lanes anytime."
      : step === "hero"
        ? experienced
          ? "We'll roll the stats and gear — pick who you want to be."
          : "We'll roll the stats and gear — you just pick who you want to be."
        : experienced
          ? "Pick a mood and we'll drop you straight into play."
          : "Pick a mood. Your Dungeon Master will take it from here, gently guiding your first steps.";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-amber-950/20 to-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-400 mb-3">Welcome, adventurer</p>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
            {heading}
          </h1>
          <p className="text-white/60 mt-2 text-sm">{subheading}</p>
        </div>

        {/* Step: intent */}
        {step === "intent" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INTENTS.map((it) => (
                <button
                  key={it.id}
                  onClick={() => chooseIntent(it.id)}
                  className="text-left rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-amber-400/50 hover:bg-amber-400/5"
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-amber-400">{it.icon}</span>
                    <span className="font-semibold">{it.name}</span>
                  </div>
                  <p className="text-sm text-white/60">{it.blurb}</p>
                </button>
              ))}
            </div>

            <div className="flex justify-center mt-8">
              <button
                onClick={() => navigate("/dashboard")}
                className="text-sm text-white/40 hover:text-white/70 underline underline-offset-4"
              >
                Skip — I'll explore on my own
              </button>
            </div>
          </>
        )}

        {/* Step: hero */}
        {step === "hero" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ARCHETYPES.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setArchetype(a)}
                  className={`text-left rounded-xl border p-4 transition-all ${
                    archetype?.id === a.id
                      ? "border-amber-400 bg-amber-400/10 shadow-[0_0_24px_rgba(217,119,6,.25)]"
                      : "border-white/10 bg-white/5 hover:border-amber-400/50"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-amber-400">{a.icon}</span>
                    <span className="font-semibold">{a.name}</span>
                  </div>
                  <p className="text-sm text-white/60">{a.blurb}</p>
                  <p className="text-xs text-amber-400/70 mt-2">{a.charClass}</p>
                </button>
              ))}
            </div>

            <div className="mt-5">
              <label className="text-xs text-white/50">Name your hero <span className="opacity-60">(optional — we'll pick one if you don't)</span></label>
              <Input
                value={heroName}
                onChange={(e) => setHeroName(e.target.value)}
                placeholder="e.g. Elara, Thorin, Zariel…"
                className="mt-1 bg-white/5 border-white/10"
                maxLength={40}
              />
            </div>

            <div className="flex justify-between items-center mt-8">
              <button onClick={() => setStep("intent")} className="text-sm text-white/40 hover:text-white/70 underline underline-offset-4">
                ← Back
              </button>
              <Button disabled={!archetype} onClick={() => setStep("tone")} className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-semibold">
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {/* Step: tone */}
        {step === "tone" && (
          <>
            <div className="grid grid-cols-1 gap-3">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTone(t)}
                  disabled={busy}
                  className={`text-left rounded-xl border p-4 transition-all ${
                    tone?.id === t.id
                      ? "border-amber-400 bg-amber-400/10 shadow-[0_0_24px_rgba(217,119,6,.25)]"
                      : "border-white/10 bg-white/5 hover:border-amber-400/50"
                  }`}
                >
                  <span className="font-semibold">{t.name}</span>
                  <p className="text-sm text-white/60 mt-1">{t.description}</p>
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center mt-8">
              <button onClick={() => setStep("hero")} disabled={busy} className="text-sm text-white/40 hover:text-white/70 underline underline-offset-4">
                ← Back
              </button>
              <Button
                disabled={!tone || busy}
                onClick={() => start.mutate()}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-semibold min-w-[190px]"
              >
                {busy ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lighting the torch…</>
                ) : (
                  <><Dices className="mr-2 h-4 w-4" /> Begin the adventure</>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
