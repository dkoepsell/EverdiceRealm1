/**
 * Become a DM: the DM path (shared/dm/path.ts), seven steps that each make
 * something real, plus "open to live play" matching. Exercises save on the
 * server (server/play/dmpath/routes.ts).
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, Circle, ChevronDown, ChevronRight, GraduationCap, Plus, Trash2, Users, Swords, Map as MapIcon, Loader2 } from "lucide-react";
import { Nudges } from "@/components/dm/Nudges";
import { dmNotesEnabled, setDmNotes } from "@/components/dm/BehindTheScreen";
import { FIVE_ROOM_THEMES, PUZZLE_SKILLS, TRAP_SAVES } from "@shared/dm/path";

interface Step { id: string; title: string; pitch: string; minutes: number; lesson: string[]; exercise: string; done: boolean; data: any }
interface PathData {
  steps: Step[];
  doneCount: number;
  fairFightGoal: { partyLevel: number; partySize: number; rating: string };
  monsters: Array<{ key: string; name: string; cr: number; xp: number }>;
  sessionZeroItems: Array<{ id: string; label: string }>;
  dungeons: Array<{ id: number; name: string; description: string }>;
  campaignsAsDm: Array<{ id: number; title: string }>;
  gamesRun: number;
}

const post = async (url: string, body: unknown) => (await apiRequest("POST", url, body)).json();

function Tips({ tips, ok }: { tips?: string[]; ok?: boolean }) {
  if (!tips?.length && !ok) return null;
  return (
    <div className="space-y-1 text-xs">
      {ok && <p className="text-emerald-400">Saved. Step complete.</p>}
      {tips?.map((t, i) => <p key={i} className="text-amber-300">• {t}</p>)}
    </div>
  );
}

// ── exercises ─────────────────────────────────────────────────────────────────

function FairFight({ d, onDone }: { d: PathData; onDone: () => void }) {
  const [level, setLevel] = useState(d.fairFightGoal.partyLevel);
  const [size, setSize] = useState(d.fairFightGoal.partySize);
  const [rows, setRows] = useState<Array<{ key: string; count: number }>>([{ key: "goblin", count: 2 }]);
  const rate = useMutation({ mutationFn: () => post("/api/dm-path/fair-fight", { monsters: rows, partyLevel: level, partySize: size }), onSuccess: (r) => { if (r.goalMet) onDone(); } });
  useEffect(() => { const t = setTimeout(() => rate.mutate(), 250); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [JSON.stringify(rows), level, size]);
  const r = rate.data;
  return (
    <div className="space-y-3">
      <div className="flex gap-3 text-sm items-center flex-wrap">
        <label className="flex items-center gap-1">Party level <Input type="number" min={1} max={10} value={level} onChange={(e) => setLevel(Number(e.target.value))} className="w-16 h-8" /></label>
        <label className="flex items-center gap-1">Characters <Input type="number" min={1} max={8} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-16 h-8" /></label>
        <Badge variant="outline">Goal: {d.fairFightGoal.rating} for {d.fairFightGoal.partySize} level {d.fairFightGoal.partyLevel} characters</Badge>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-center">
          <select className="bg-background border rounded h-8 px-2 text-sm flex-1" value={row.key} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}>
            {d.monsters.map((m) => <option key={m.key} value={m.key}>{m.name} (CR {m.cr < 1 ? `1/${Math.round(1 / m.cr)}` : m.cr}, {m.xp} XP)</option>)}
          </select>
          <Input type="number" min={0} max={12} value={row.count} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, count: Number(e.target.value) } : x)))} className="w-16 h-8" />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => setRows([...rows, { key: "wolf", count: 1 }])}><Plus className="h-3 w-3 mr-1" />Add monsters</Button>
      {r && (
        <div className="text-sm rounded border p-2 space-y-1" data-testid="fair-fight-result">
          <p>{r.count} monster{r.count === 1 ? "" : "s"}: {r.raw} XP, adjusted <b>{r.adjusted}</b> XP: <b className="uppercase">{r.rating}</b></p>
          <p className="text-xs text-muted-foreground">Thresholds for this party: easy {r.thresholds.easy}, medium {r.thresholds.medium}, hard {r.thresholds.hard}, deadly {r.thresholds.deadly}.</p>
          {r.goalMet && <p className="text-emerald-400 text-xs">That's a Medium fight for four level 2 characters. Step complete.</p>}
        </div>
      )}
    </div>
  );
}

function NpcForm({ d, onDone }: { d: PathData; onDone: () => void }) {
  const prev = d.steps.find((s) => s.id === "npc")?.data ?? {};
  const [npc, setNpc] = useState({ name: prev.name ?? "", want: prev.want ?? "", secret: prev.secret ?? "", voice: prev.voice ?? "", attitude: prev.attitude ?? 0 });
  const [campaignId, setCampaignId] = useState<string>("");
  const save = useMutation({ mutationFn: () => post("/api/dm-path/npc", { npc, campaignId: campaignId ? Number(campaignId) : null }), onSuccess: (r) => { if (r.ok) onDone(); } });
  const f = (k: keyof typeof npc, label: string, ph: string) => (
    <label className="block text-xs space-y-1"><span>{label}</span><Input value={npc[k] as string} placeholder={ph} onChange={(e) => setNpc({ ...npc, [k]: e.target.value })} /></label>
  );
  return (
    <div className="space-y-2">
      {f("name", "Name", "Tamsin")}
      {f("want", "What they want", "to get her cart to market before the rival peddler")}
      {f("secret", "A secret", "the 'silk' in her cart is stolen")}
      {f("voice", "A voice or a habit", "feathered hat, swears creatively, calls everyone 'petal'")}
      <label className="block text-xs space-y-1"><span>Starting attitude toward the party: {npc.attitude > 0 ? "friendly" : npc.attitude < 0 ? "hostile" : "indifferent"}</span>
        <input type="range" min={-3} max={3} value={npc.attitude} onChange={(e) => setNpc({ ...npc, attitude: Number(e.target.value) })} className="w-full" />
      </label>
      {d.campaignsAsDm.length > 0 && (
        <label className="block text-xs space-y-1"><span>Add them to the Ledger of a campaign you run (optional)</span>
          <select className="bg-background border rounded h-8 px-2 text-sm w-full" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">No, just save it</option>
            {d.campaignsAsDm.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
      )}
      <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending} data-testid="npc-save">Save NPC</Button>
      <Tips tips={save.data?.tips} ok={save.data?.ok} />
      {save.data?.addedTo && <p className="text-xs text-emerald-400">Added to the Ledger of {save.data.addedTo}.</p>}
    </div>
  );
}

function CluesForm({ d, onDone }: { d: PathData; onDone: () => void }) {
  const prev = d.steps.find((s) => s.id === "three_clues")?.data ?? {};
  const [conclusion, setConclusion] = useState(prev.conclusion ?? "");
  const [clues, setClues] = useState<Array<{ clue: string; where: string }>>(prev.clues ?? [{ clue: "", where: "" }, { clue: "", where: "" }, { clue: "", where: "" }]);
  const save = useMutation({ mutationFn: () => post("/api/dm-path/clues", { conclusion, clues }), onSuccess: (r) => { if (r.ok) onDone(); } });
  return (
    <div className="space-y-2">
      <label className="block text-xs space-y-1"><span>The conclusion players need to reach</span><Input value={conclusion} placeholder="The miller is smuggling for the goblins" onChange={(e) => setConclusion(e.target.value)} /></label>
      {clues.map((c, i) => (
        <div key={i} className="grid grid-cols-[1fr_12rem_auto] gap-2">
          <Input value={c.clue} placeholder={`Clue ${i + 1}: goblin arrows in the flour sacks`} onChange={(e) => setClues(clues.map((x, j) => (j === i ? { ...x, clue: e.target.value } : x)))} />
          <Input value={c.where} placeholder="where: the mill's cellar" onChange={(e) => setClues(clues.map((x, j) => (j === i ? { ...x, where: e.target.value } : x)))} />
          <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setClues(clues.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setClues([...clues, { clue: "", where: "" }])}><Plus className="h-3 w-3 mr-1" />Another clue</Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending} data-testid="clues-save">Save mystery</Button>
      </div>
      <Tips tips={save.data?.tips} ok={save.data?.ok} />
    </div>
  );
}

const ROOMS: Array<{ key: string; n: number; label: string; help: string }> = [
  { key: "guardian", n: 1, label: "Entrance and guardian", help: "Why hasn't this place been looted? Something guards it." },
  { key: "puzzle", n: 2, label: "Puzzle or roleplaying challenge", help: "Something to think or talk through, not fight." },
  { key: "setback", n: 3, label: "Trick or setback", help: "A trap, a collapse, a betrayal: raise the tension." },
  { key: "climax", n: 4, label: "Climax", help: "The big fight. Give it more than one way to win." },
  { key: "reward", n: 5, label: "Reward and twist", help: "What they came for, and a complication." },
];

function FiveRoom({ d, onBuilt }: { d: PathData; onBuilt: () => void }) {
  const { toast } = useToast();
  const prev = d.steps.find((s) => s.id === "five_room")?.data?.lastDraft;
  const [draft, setDraft] = useState<any>(prev ?? {
    title: "", theme: "goblin", partyLevel: 2,
    rooms: {
      guardian: { name: "", description: "", difficulty: "easy" },
      puzzle: { name: "", description: "", skill: "investigation", dc: 12, hint: "", solution: "" },
      setback: { name: "", description: "", save: "dexterity", dc: 12, damageDice: 2 },
      climax: { name: "", description: "", bossName: "", difficulty: "hard" },
      reward: { name: "", description: "", twist: "" },
    },
  });
  const setRoom = (room: string, k: string, v: unknown) => setDraft({ ...draft, rooms: { ...draft.rooms, [room]: { ...draft.rooms[room], [k]: v } } });
  const check = useMutation({ mutationFn: () => post("/api/dm-path/five-room/check", draft) });
  const build = useMutation({
    mutationFn: () => post("/api/dm-path/five-room", draft),
    onSuccess: (r) => { if (r.ok) { toast({ title: "Dungeon built", description: "It's in your Delve list. Playtest it to finish this step." }); onBuilt(); } },
  });
  const fb = build.data ?? check.data;
  const sel = (room: string, k: string, opts: readonly string[]) => (
    <select className="bg-background border rounded h-8 px-2 text-sm" value={draft.rooms[room][k]} onChange={(e) => setRoom(room, k, e.target.value)}>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-3 gap-2">
        <Input value={draft.title} placeholder="Dungeon name: The Sunken Mill" onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="sm:col-span-1" />
        <label className="text-xs flex items-center gap-1">Monsters
          <select className="bg-background border rounded h-8 px-2 text-sm flex-1" value={draft.theme} onChange={(e) => setDraft({ ...draft, theme: e.target.value })}>
            {FIVE_ROOM_THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-xs flex items-center gap-1">For level <Input type="number" min={1} max={10} value={draft.partyLevel} onChange={(e) => setDraft({ ...draft, partyLevel: Number(e.target.value) })} className="w-16 h-8" /></label>
      </div>
      {ROOMS.map((room) => (
        <div key={room.key} className="rounded border p-2 space-y-2">
          <p className="text-sm font-medium">Room {room.n}: {room.label} <span className="text-xs text-muted-foreground font-normal">{room.help}</span></p>
          <Input value={draft.rooms[room.key].name} placeholder="Room name" onChange={(e) => setRoom(room.key, "name", e.target.value)} />
          <Textarea value={draft.rooms[room.key].description} placeholder="What the players see, hear and smell" rows={2} onChange={(e) => setRoom(room.key, "description", e.target.value)} />
          <div className="flex flex-wrap gap-2 text-xs items-center">
            {room.key === "guardian" && <>Difficulty {sel("guardian", "difficulty", ["easy", "medium", "hard"])}</>}
            {room.key === "puzzle" && <>
              Skill {sel("puzzle", "skill", PUZZLE_SKILLS)}
              DC <Input type="number" min={5} max={30} value={draft.rooms.puzzle.dc} onChange={(e) => setRoom("puzzle", "dc", Number(e.target.value))} className="w-16 h-8" />
              <Input value={draft.rooms.puzzle.hint} placeholder="Hint for stuck players" onChange={(e) => setRoom("puzzle", "hint", e.target.value)} className="flex-1 min-w-40" />
              <Input value={draft.rooms.puzzle.solution} placeholder="The solution" onChange={(e) => setRoom("puzzle", "solution", e.target.value)} className="flex-1 min-w-40" />
            </>}
            {room.key === "setback" && <>
              Save {sel("setback", "save", TRAP_SAVES)}
              DC <Input type="number" min={5} max={30} value={draft.rooms.setback.dc} onChange={(e) => setRoom("setback", "dc", Number(e.target.value))} className="w-16 h-8" />
              Damage <Input type="number" min={1} max={10} value={draft.rooms.setback.damageDice} onChange={(e) => setRoom("setback", "damageDice", Number(e.target.value))} className="w-16 h-8" />d10
            </>}
            {room.key === "climax" && <>
              <Input value={draft.rooms.climax.bossName} placeholder="The villain's name" onChange={(e) => setRoom("climax", "bossName", e.target.value)} className="flex-1 min-w-40" />
              Difficulty {sel("climax", "difficulty", ["medium", "hard", "deadly"])}
            </>}
            {room.key === "reward" && <Input value={draft.rooms.reward.twist} placeholder="The twist" onChange={(e) => setRoom("reward", "twist", e.target.value)} className="flex-1" />}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => check.mutate()} disabled={check.isPending}>Get feedback</Button>
        <Button size="sm" onClick={() => build.mutate()} disabled={build.isPending} data-testid="five-room-build">{build.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Build it as a Delve dungeon</Button>
      </div>
      {fb && (
        <div className="text-xs space-y-1 rounded border p-2" data-testid="five-room-feedback">
          <p>With four level {draft.partyLevel} characters, the guardian fight is <b>{fb.ratings?.guardian}</b> and the climax is <b>{fb.ratings?.climax}</b> (DMG encounter math).</p>
          {fb.tips?.map((t: string, i: number) => <p key={i} className="text-amber-300">• {t}</p>)}
          {build.data?.ok && <p className="text-emerald-400">Built. It's waiting in your Delve list: <Link href="/delve" className="underline">playtest it now</Link>.</p>}
        </div>
      )}
    </div>
  );
}

function SessionZero({ d, onDone }: { d: PathData; onDone: () => void }) {
  const prev: string[] = d.steps.find((s) => s.id === "session_zero")?.data?.checked ?? [];
  const [checked, setChecked] = useState<string[]>(prev);
  const save = useMutation({ mutationFn: (c: string[]) => post("/api/dm-path/session-zero", { checked: c }), onSuccess: (r) => { if (r.ok) onDone(); } });
  return (
    <div className="space-y-1">
      {d.sessionZeroItems.map((i) => (
        <label key={i.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={checked.includes(i.id)} onChange={(e) => { const c = e.target.checked ? [...checked, i.id] : checked.filter((x) => x !== i.id); setChecked(c); save.mutate(c); }} />
          {i.label}
        </label>
      ))}
    </div>
  );
}

function RunAGame({ d }: { d: PathData }) {
  const { toast } = useToast();
  const postIt = useMutation({
    mutationFn: (dungeonId: number) => post("/api/dm-path/post-oneshot", { dungeonId }),
    onSuccess: () => toast({ title: "Posted on Find a Game", description: "Players can respond to it there." }),
    onError: (e: Error) => toast({ title: "Couldn't post", description: e.message, variant: "destructive" }),
  });
  return (
    <div className="space-y-2 text-sm" id="run">
      <p>{d.gamesRun > 0 ? `You've run ${d.gamesRun} game${d.gamesRun === 1 ? "" : "s"} as DM.` : "Not yet. Create a campaign in the DM Toolkit, invite at least one player, and run a session."}</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/dm-toolkit"><Button size="sm" variant="outline">Open the DM Toolkit</Button></Link>
        <Link href="/community?tab=find-a-game"><Button size="sm" variant="outline">Find players</Button></Link>
      </div>
      {d.dungeons.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Post one of your dungeons as a one-shot on Find a Game:</p>
          {d.dungeons.map((g) => (
            <div key={g.id} className="flex items-center gap-2">
              <MapIcon className="h-3 w-3" /><span className="flex-1">{g.name}</span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => postIt.mutate(g.id)} disabled={postIt.isPending} data-testid={`post-oneshot-${g.id}`}>Post a one-shot</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── play together ─────────────────────────────────────────────────────────────

function PlayTogether() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data } = useQuery<any>({ queryKey: ["/api/play-together"] });
  const [prefs, setPrefs] = useState<any>(null);
  useEffect(() => {
    if (data && !prefs) setPrefs({ ...data.prefs, timezone: data.prefs.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone });
  }, [data, prefs]);
  const save = useMutation({
    mutationFn: async () => apiRequest("PUT", "/api/play-together", prefs),
    onSuccess: () => { toast({ title: "Saved" }); qc.invalidateQueries({ queryKey: ["/api/play-together"] }); qc.invalidateQueries({ queryKey: ["/api/dm-path/nudges"] }); },
    onError: (e: Error) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });
  if (!data || !prefs) return null;
  const toggle = (k: "slots" | "styles", v: string) => setPrefs({ ...prefs, [k]: prefs[k].includes(v) ? prefs[k].filter((x: string) => x !== v) : [...prefs[k], v] });
  return (
    <Card id="play-together" data-testid="play-together">
      <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" />Play together</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground text-xs">Opt in to see other players who are looking for a live game at the same times as you. Only players who opt in can see each other, and only your username, role, times and style are shown. Get in touch through Find a Game posts, as usual.</p>
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={prefs.open} onChange={(e) => setPrefs({ ...prefs, open: e.target.checked })} data-testid="play-open" /> I'm open to live play</label>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs">I'd like to</span>
          {data.options.roles.map((r: string) => (
            <button key={r} onClick={() => setPrefs({ ...prefs, role: r })} className={`px-2 py-0.5 rounded border text-xs ${prefs.role === r ? "border-violet-400 bg-violet-900/40" : ""}`}>{r === "dm" ? "run games" : r === "player" ? "play" : "either"}</button>
          ))}
          <span className="text-xs ml-2">Time zone</span><Input value={prefs.timezone ?? ""} onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })} className="h-7 w-48 text-xs" />
        </div>
        <div className="flex flex-wrap gap-1.5">{data.options.slots.map((s: string) => (
          <button key={s} onClick={() => toggle("slots", s)} className={`px-2 py-0.5 rounded border text-xs ${prefs.slots.includes(s) ? "border-emerald-400 bg-emerald-900/30" : ""}`}>{s}</button>
        ))}</div>
        <div className="flex flex-wrap gap-1.5">{data.options.styles.map((s: string) => (
          <button key={s} onClick={() => toggle("styles", s)} className={`px-2 py-0.5 rounded border text-xs ${prefs.styles.includes(s) ? "border-sky-400 bg-sky-900/30" : ""}`}>{s}</button>
        ))}</div>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending} data-testid="play-save">Save</Button>
        {data.prefs.open && (
          <div className="space-y-1.5 pt-2">
            <p className="font-medium">Players free when you are</p>
            {data.matches.length === 0 && <p className="text-xs text-muted-foreground">No one yet. Post a game on Find a Game, and check back.</p>}
            {data.matches.map((m: any) => (
              <div key={m.username} className="flex flex-wrap items-center gap-2 rounded border p-2 text-xs">
                <span className="font-medium">{m.username}</span>
                <Badge variant="outline" className="text-[10px]">{m.role === "dm" ? "runs games" : m.role === "player" ? "plays" : "plays or runs"}</Badge>
                {m.level && <span className="text-muted-foreground">level {m.level}</span>}
                <span className="text-muted-foreground">{m.sharedSlots.join(", ")}{m.timezone ? ` · ${m.timezone}` : ""}</span>
                {m.post ? <Link href="/community?tab=find-a-game" className="ml-auto underline">Their post: {m.post.title}</Link> : <span className="ml-auto text-muted-foreground">no post yet</span>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function DmPathPage() {
  const qc = useQueryClient();
  const { data } = useQuery<PathData>({ queryKey: ["/api/dm-path"] });
  const [open, setOpen] = useState<string | null>(null);
  const [notes, setNotes] = useState(dmNotesEnabled());
  const refresh = () => { qc.invalidateQueries({ queryKey: ["/api/dm-path"] }); qc.invalidateQueries({ queryKey: ["/api/dm-path/nudges"] }); };
  const readDone = useMutation({ mutationFn: () => post("/api/dm-path/dm_job/complete", {}), onSuccess: refresh });

  // Open the step named in the URL (#five_room), on load and whenever a
  // "Behind the screen" link changes the hash.
  useEffect(() => {
    const go = () => {
      const h = window.location.hash.replace("#", "");
      if (h && data?.steps.some((s) => s.id === h)) setOpen(h);
      if (h) setTimeout(() => document.getElementById(h === "run" ? "run_a_game" : h)?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, [data]);

  const next = useMemo(() => data?.steps.find((s) => !s.done)?.id, [data]);
  if (!data) return <div className="container mx-auto p-8 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading the DM path...</div>;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6" data-testid="dm-path">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2"><GraduationCap className="h-7 w-7 text-violet-400" />Become a DM</h1>
        <p className="text-muted-foreground">Every great table started with someone deciding to run a game. Seven steps, each one making something real, ending with a game you run for another player.</p>
        <p className="text-xs text-muted-foreground">Want more reading? The <Link href="/dm-toolkit" className="underline">DM Toolkit</Link>'s Training Center has 30-odd lessons with quizzes; this path is where you practise them.</p>
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 rounded bg-muted overflow-hidden"><div className="h-full bg-violet-500" style={{ width: `${(data.doneCount / data.steps.length) * 100}%` }} /></div>
          <span className="text-sm text-muted-foreground">{data.doneCount} / {data.steps.length}</span>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={notes} onChange={(e) => { setNotes(e.target.checked); setDmNotes(e.target.checked); }} />
          Show "Behind the screen" notes in Wander and Delve, explaining the DM craft behind what happens
        </label>
      </div>

      <Nudges />

      <div className="space-y-3">
        {data.steps.map((s, i) => {
          const isOpen = open === s.id;
          return (
            <Card key={s.id} id={s.id} className={s.id === next ? "border-violet-500/60" : ""} data-testid={`dm-step-${s.id}`}>
              <button className="w-full text-left" onClick={() => setOpen(isOpen ? null : s.id)}>
                <CardHeader className="py-3">
                  <div className="flex items-center gap-3">
                    {s.done ? <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />}
                    <div className="flex-1">
                      <CardTitle className="text-base">{i + 1}. {s.title}</CardTitle>
                      <p className="text-xs text-muted-foreground">{s.pitch} · about {s.minutes} min</p>
                    </div>
                    {s.id === next && <Badge className="bg-violet-600">Next</Badge>}
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                </CardHeader>
              </button>
              {isOpen && (
                <CardContent className="space-y-4 pt-0">
                  <div className="space-y-2 text-sm leading-relaxed">{s.lesson.map((p, j) => <p key={j}>{p}</p>)}</div>
                  <div className="rounded-md bg-muted/40 p-3 space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2"><Swords className="h-4 w-4" />Exercise: {s.exercise}</p>
                    {s.id === "dm_job" && !s.done && <Button size="sm" onClick={() => readDone.mutate()}>Mark as read</Button>}
                    {s.id === "fair_fight" && <FairFight d={data} onDone={refresh} />}
                    {s.id === "npc" && <NpcForm d={data} onDone={refresh} />}
                    {s.id === "three_clues" && <CluesForm d={data} onDone={refresh} />}
                    {s.id === "five_room" && <FiveRoom d={data} onBuilt={refresh} />}
                    {s.id === "session_zero" && <SessionZero d={data} onDone={refresh} />}
                    {s.id === "run_a_game" && <RunAGame d={data} />}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <PlayTogether />
    </div>
  );
}
