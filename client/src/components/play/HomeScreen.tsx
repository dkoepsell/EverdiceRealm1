/**
 * Home (design PDF page 1): your character and how close the next level is,
 * "Previously on…" with one big Continue, the learning path, and two ways to
 * start something new (a 30-minute one-shot, or a table to join).
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, Beer, Compass, Map, Pickaxe, Store } from "lucide-react";
import type { Campaign, Character } from "@shared/schema";
import { getClassDef } from "@shared/rules/classProgression";
import { normalizeCampaignLength, pacingForLength } from "@shared/rules/campaignLength";
import { LearningPathCard } from "./LearningPathCard";
import { LevelUpButton } from "@/components/character/LevelUpDialog";

interface JournalLite { recap: string[] }
interface Progress { currentChapter: number; totalChapters: number; scenesInChapter: number; hardCap: number }

export function HomeScreen({
  username,
  character,
  campaign,
  showLearningPath,
  onContinue,
  onStartedLesson,
}: {
  username: string;
  character: Character | null;
  campaign: Campaign | null;
  showLearningPath: boolean;
  onContinue: () => void;
  onStartedLesson: (campaignId: number) => void;
}) {
  const cid = campaign?.id;
  const { data: journal } = useQuery<JournalLite>({ queryKey: [`/api/campaigns/${cid}/ledger`], enabled: !!cid, staleTime: 0 });
  const { data: progress } = useQuery<Progress>({ queryKey: [`/api/campaigns/${cid}/chapter-progress`], enabled: !!cid, staleTime: 0 });
  const { data: sessions } = useQuery<any[]>({ queryKey: [`/api/campaigns/${cid}/sessions`], enabled: !!cid, staleTime: 0 });
  const { data: away } = useQuery<{ narrativeRecap?: string | null }>({ queryKey: [`/api/campaigns/${cid}/while-you-were-away`], enabled: !!cid });
  const { data: bulletin = [] } = useQuery<any[]>({ queryKey: ["/api/bulletin"], staleTime: 60_000 });
  const openTables = (Array.isArray(bulletin) ? bulletin : []).filter((p) => (p?.postType === "lfg" || p?.postType === "lfp") && p?.isActive !== false).length;

  const last = Array.isArray(sessions) && sessions.length ? sessions[sessions.length - 1] : null;
  const state = typeof last?.storyState === "string" ? safeParse(last.storyState) : last?.storyState ?? {};
  const pacing = pacingForLength(normalizeCampaignLength(campaign?.campaignLength));
  const episodeScenes = typeof state?.episode?.scenes === "number" ? state.episode.scenes : null;
  const minutesLeft = episodeScenes != null ? Math.max(2, (pacing.episodeScenes - episodeScenes) * 2) : null;

  const recap = (journal?.recap?.length ? journal.recap : [away?.narrativeRecap || lastSentence(last?.narrative)]).filter(Boolean) as string[];
  const def = character ? getClassDef(character.class) : undefined;
  const subclass = def && character?.subclass === def.subclass.id ? def.subclass.name : null;
  const chapterPct = progress ? Math.min(100, Math.round((progress.scenesInChapter / Math.max(1, pacing.minScenes + 2)) * 100)) : 0;

  return (
    <div className="ed-surface min-h-[calc(100vh-4rem)] px-4 py-6" data-testid="home-screen">
      <div className="mx-auto max-w-xl space-y-5">
        <div className="flex items-center justify-between">
          <span className="ed-title text-3xl text-[var(--ed-gold)]">Everdice</span>
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--ed-line)] bg-[var(--ed-card)] ed-title text-lg">
            {(username || "?").charAt(0).toUpperCase()}
          </span>
        </div>

        {character && (
          <div className="ed-card flex items-center gap-4 p-4">
            {character.portraitUrl ? (
              <img src={character.portraitUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--ed-card-hi)] ed-title text-3xl ed-gold">{character.name.charAt(0)}</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="ed-title truncate text-xl">{character.name}</div>
              <div className="truncate text-sm ed-muted">{[character.race, character.class, `Level ${character.level}`, subclass].filter(Boolean).join(" · ")}</div>
              {character.pendingLevelUp ? (
                <div className="mt-2"><LevelUpButton characterId={character.id} pendingLevelUp={character.pendingLevelUp} /></div>
              ) : campaign && progress ? (
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-1.5 flex-1 rounded-full bg-[var(--ed-line)]"><div className="h-1.5 rounded-full bg-[var(--ed-gold)]" style={{ width: `${chapterPct}%` }} /></div>
                  <span className="shrink-0 text-xs ed-muted">Level {(character.level || 1) + 1} at next milestone</span>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {campaign ? (
          <div className="rounded-2xl border border-[#4a3a63] bg-[var(--ed-violet-bg)] p-5" data-testid="home-previously">
            <div className="ed-label mb-2 !text-[var(--ed-violet-ink)]">Previously on {campaign.title}</div>
            {recap.length > 0 && (
              <ul className="mb-4 list-disc space-y-1 pl-5 font-fantasy text-lg text-[var(--ed-ink)]">
                {recap.slice(0, 3).map((line) => <li key={line}>{line}</li>)}
              </ul>
            )}
            <button type="button" onClick={onContinue} className="ed-btn-primary flex w-full items-center justify-center gap-2 py-4 text-lg" data-testid="home-continue">
              Continue <ArrowRight className="h-5 w-5" />
            </button>
            {minutesLeft != null && <p className="mt-2 text-center text-sm text-[var(--ed-violet-ink)]">About {minutesLeft} minutes to the end of this episode</p>}
          </div>
        ) : (
          <div className="ed-card p-5 text-center">
            <p className="font-fantasy text-lg">No adventure in progress.</p>
            <p className="text-sm ed-muted">Start a one-shot below, or join a table.</p>
          </div>
        )}

        {showLearningPath && <LearningPathCard characterId={character?.id ?? null} onStarted={onStartedLesson} />}

        <div className="grid grid-cols-2 gap-3">
          <Link href="/begin" className="ed-card block p-4 text-center hover:border-[var(--ed-gold)]" data-testid="home-new-oneshot">
            <div className="text-lg font-semibold">New one-shot</div>
            <div className="text-sm ed-muted">30 min</div>
          </Link>
          <Link href="/community" className="ed-card block p-4 text-center hover:border-[var(--ed-gold)]" data-testid="home-find-party">
            <div className="text-lg font-semibold">Find a party</div>
            <div className="text-sm ed-muted">{openTables ? `${openTables} table${openTables === 1 ? "" : "s"} open` : "Post or browse tables"}</div>
          </Link>
        </div>

        <div data-testid="home-where-to-next">
          <div className="ed-label mb-2">Where to next?</div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {[
              { href: "/wander", label: "Wander", desc: "Explore the wilds", icon: Compass },
              { href: "/delve", label: "Delve", desc: "Raid a dungeon", icon: Pickaxe },
              { href: "/tavern", label: "Tavern", desc: "Rest and resupply", icon: Beer },
              { href: "/trading-post", label: "Trading Post", desc: "Buy and sell", icon: Store },
              { href: "/world-map", label: "World Map", desc: "See the realm", icon: Map },
            ].map(({ href, label, desc, icon: Icon }) => (
              <Link key={href} href={href} className="ed-card block p-3 text-center hover:border-[var(--ed-gold)]" data-testid={`home-goto-${label.toLowerCase().replace(/ /g, "-")}`}>
                <Icon className="mx-auto mb-1 h-6 w-6 ed-gold" />
                <div className="text-sm font-semibold">{label}</div>
                <div className="text-xs ed-muted">{desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function safeParse(s: string) {
  try { return JSON.parse(s); } catch { return {}; }
}
function lastSentence(text?: string | null) {
  const parts = (text || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/);
  return parts[parts.length - 1] || "";
}
