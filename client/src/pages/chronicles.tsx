import { Fragment, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Crown, Loader2, ScrollText, Sparkles } from "lucide-react";

interface FinishedAdventure {
  id: number;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  completedAt: string | null;
  totalChapters: number | null;
  earnedTitle: string | null;
  endingType: string | null;
  party: string[];
}

interface StoryTurn {
  actorName: string | null;
  characterName: string | null;
  choice: string | null;
  narrative: string | null;
  at: string | null;
}

interface StoryChapter {
  key: string;
  chapterNumber: number | null;
  title: string;
  turns: StoryTurn[];
}

interface AdventureStory {
  id: number;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  party: { name: string; race: string; class: string; level: number }[];
  completion: { earnedTitle: string | null; earnedTrait: string | null; endingType: string | null; epilogue: string | null } | null;
  chapters: StoryChapter[];
  beginsPartway: boolean;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function humanize(s: string | null) {
  return s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null;
}

// The narrator writes light markdown: headings, **bold**, *italics*, rules.
// Rendered as React nodes, never as HTML.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_)/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^(\*[^*]+\*|_[^_]+_)$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function Prose({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <>
      {blocks.map((block, i) => {
        if (/^(-{3,}|\*{3,})$/.test(block)) return <hr key={i} className="my-6 border-border" />;
        const heading = block.match(/^#{1,6}\s+(.*)$/);
        if (heading) {
          return <h4 key={i} className="mt-6 mb-2 font-serif text-lg font-semibold text-foreground">{inline(heading[1])}</h4>;
        }
        const lines = block.split("\n");
        return (
          <p key={i} className="mb-4 leading-relaxed">
            {lines.map((line, j) => (
              <Fragment key={j}>{j > 0 && <br />}{inline(line)}</Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

function AdventureList() {
  const { data: adventures, isLoading } = useQuery<FinishedAdventure[]>({
    queryKey: ["/api/me/finished-adventures"],
    staleTime: 60 * 1000,
  });

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="flex items-center gap-3 font-serif text-3xl font-bold">
          <ScrollText className="h-7 w-7 text-amber-500" /> Chronicles
        </h1>
        <p className="mt-2 text-muted-foreground">The adventures you have seen through to the end, told again from the start.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !adventures?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No finished adventures yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">When a campaign ends, its whole story is kept here to read again.</p>
            <Link href="/campaigns"><Button variant="outline" className="mt-6">Go to your campaigns</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {adventures.map((a) => (
            <Link key={a.id} href={`/chronicles/${a.id}`}>
              <Card className="h-full cursor-pointer overflow-hidden transition-all hover:border-amber-500/50 hover:shadow-lg" data-testid={`chronicle-card-${a.id}`}>
                {a.coverImageUrl && (
                  <div className="h-36 w-full overflow-hidden">
                    <img src={a.coverImageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                )}
                <CardContent className="space-y-2 p-5">
                  <h2 className="font-serif text-xl font-semibold">{a.title}</h2>
                  {formatDate(a.completedAt) && (
                    <p className="text-xs text-muted-foreground">Completed {formatDate(a.completedAt)}</p>
                  )}
                  {a.party.length > 0 && <p className="text-sm text-muted-foreground">{a.party.join(" · ")}</p>}
                  {a.earnedTitle && (
                    <Badge variant="secondary" className="gap-1"><Crown className="h-3 w-3" /> {a.earnedTitle}</Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function AdventureReader({ id }: { id: number }) {
  const { data: story, isLoading, error } = useQuery<AdventureStory>({
    queryKey: [`/api/campaigns/${id}/story`],
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !story) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-medium">This story could not be opened.</p>
        <Link href="/chronicles"><Button variant="outline" className="mt-6">Back to Chronicles</Button></Link>
      </div>
    );
  }

  const numbered = story.chapters.filter((c) => c.turns.length > 0);

  return (
    <article className="container mx-auto max-w-2xl px-4 py-8">
      <Link href="/chronicles">
        <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground"><ArrowLeft className="mr-1.5 h-4 w-4" /> Chronicles</Button>
      </Link>

      {story.coverImageUrl && (
        <img src={story.coverImageUrl} alt="" className="mb-6 h-48 w-full rounded-lg object-cover" />
      )}

      <header className="mb-8 border-b border-border pb-6 text-center">
        <h1 className="font-serif text-4xl font-bold">{story.title}</h1>
        {story.party.length > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            {story.party.map((p) => `${p.name}, ${[p.race, p.class].filter(Boolean).join(" ")}`).join(" · ")}
          </p>
        )}
        {formatDate(story.completedAt) && (
          <p className="mt-1 text-xs text-muted-foreground">Completed {formatDate(story.completedAt)}</p>
        )}
      </header>

      {numbered.length > 3 && (
        <nav className="mb-10 flex flex-wrap justify-center gap-2" aria-label="Chapters">
          {numbered.map((c) => (
            <a key={c.key} href={`#${c.key}`} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-amber-500/60 hover:text-foreground">
              {c.title}
            </a>
          ))}
        </nav>
      )}

      <div className="font-serif text-[1.05rem] text-foreground/90">
        {story.description && (
          <div className="mb-10 italic text-muted-foreground"><Prose text={story.description} /></div>
        )}

        {story.beginsPartway && (
          <p className="mb-8 rounded-md border border-border bg-muted/40 p-3 text-center font-sans text-xs text-muted-foreground">
            The earliest part of this adventure was not kept, so the telling picks up partway through.
          </p>
        )}

        {numbered.length === 0 && (
          <p className="py-8 text-center font-sans text-sm text-muted-foreground">No turns of this adventure were recorded.</p>
        )}

        {numbered.map((chapter) => (
          <section key={chapter.key} id={chapter.key} className="mb-12 scroll-mt-20">
            <h2 className="mb-6 text-center font-serif text-2xl font-semibold text-amber-600 dark:text-amber-400">{chapter.title}</h2>
            {chapter.turns.map((turn, i) => (
              <div key={i} className="mb-6">
                {turn.choice && (
                  <p className="mb-3 border-l-2 border-amber-500/60 pl-3 font-sans text-sm italic text-muted-foreground">
                    {(turn.characterName || turn.actorName) && (
                      <span className="not-italic font-semibold text-foreground/80">{turn.characterName || turn.actorName}: </span>
                    )}
                    {turn.choice}
                  </p>
                )}
                {turn.narrative && <Prose text={turn.narrative} />}
              </div>
            ))}
          </section>
        ))}

        {story.completion?.epilogue && (
          <section className="mb-12">
            <h2 className="mb-6 text-center font-serif text-2xl font-semibold text-amber-600 dark:text-amber-400">Epilogue</h2>
            <Prose text={story.completion.epilogue} />
          </section>
        )}
      </div>

      {story.isCompleted && (
        <footer className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-6 text-center">
          <p className="font-serif text-xl font-semibold">The End</p>
          {humanize(story.completion?.endingType ?? null) && (
            <p className="mt-1 text-sm text-muted-foreground">Ending: {humanize(story.completion!.endingType)}</p>
          )}
          {story.completion?.earnedTitle && (
            <p className="mt-3 flex items-center justify-center gap-2 text-sm"><Crown className="h-4 w-4 text-amber-500" /> {story.completion.earnedTitle}</p>
          )}
          {story.completion?.earnedTrait && (
            <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Sparkles className="h-4 w-4 text-purple-400" /> {story.completion.earnedTrait}</p>
          )}
        </footer>
      )}
    </article>
  );
}

export default function ChroniclesPage() {
  const [, params] = useRoute("/chronicles/:id");
  const id = params?.id ? parseInt(params.id) : NaN;
  return Number.isFinite(id) ? <AdventureReader id={id} /> : <AdventureList />;
}
