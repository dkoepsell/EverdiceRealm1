/**
 * Wander travel UI (wander-threads-spec.md section 9): the travel bar (day,
 * clock, weather, food, water, exhaustion), pace and activity controls, the
 * trails journal, and roll readouts.
 */
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sun, Moon, Cloud, CloudRain, CloudFog, CloudLightning, Wheat, Droplets, BatteryLow, Tent,
  Footprints, Compass, Search, Eye, Loader2, Dices, Route, HelpCircle,
} from "lucide-react";
import {
  EXHAUSTION_EFFECTS, TRAVEL_DAY_HOURS, WEATHER_LABEL, clockLabel, isNight, timeOfDayLabel,
  type Pace, type TravelActivity, type TravelState, type Weather,
} from "@shared/wander/travel";

export interface JournalThread {
  id: number;
  templateId: string;
  title: string;
  status: string;
  beat: string;
  bearing: string;
  distance: number;
  target: { q: number; r: number } | null;
  rumor: { source?: string; text?: string } | null;
}

const WEATHER_ICON: Record<Weather, typeof Sun> = {
  clear: Sun, overcast: Cloud, rain: CloudRain, fog: CloudFog, storm: CloudLightning,
};

function Stat({ icon: Icon, label, value, tone, title }: { icon: typeof Sun; label: string; value: string; tone?: string; title?: string }) {
  return (
    <div className="flex items-center gap-1.5" title={title}>
      <Icon className={`h-4 w-4 ${tone ?? "text-slate-400"}`} />
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

export function TravelBar({ travel, onCamp, camping }: { travel: TravelState; onCamp: () => void; camping: boolean }) {
  const night = isNight(travel.hour);
  const WIcon = WEATHER_ICON[travel.weather] ?? Sun;
  const need = travel.hot ? 2 : 1;
  const overDay = travel.hoursToday >= TRAVEL_DAY_HOURS;
  return (
    <div className="flex items-center gap-x-5 gap-y-2 flex-wrap" data-testid="wander-travel-bar">
      <Stat icon={night ? Moon : Sun} label={`Day ${travel.day}`} value={`${clockLabel(travel.hour)} ${timeOfDayLabel(travel.hour)}`} tone={night ? "text-indigo-300" : "text-amber-300"}
        title={night ? "Night: without darkvision you have disadvantage on navigation and on Perception that relies on sight." : undefined} />
      <Stat icon={WIcon} label="Weather" value={`${WEATHER_LABEL[travel.weather]}${travel.hot ? ", hot" : ""}`} tone="text-sky-300"
        title={travel.weather === "rain" || travel.weather === "fog" || travel.weather === "storm" ? "Lightly obscured: disadvantage on sight-based Perception (-5 passive), and -5 to navigation." : undefined} />
      <Stat icon={Route} label="Travelled" value={`${Math.round(travel.hoursToday * 10) / 10} / ${TRAVEL_DAY_HOURS} h`} tone={overDay ? "text-red-400" : "text-slate-400"}
        title="A travel day is 8 hours. Each hour beyond that is a forced march: a Constitution save (DC 10 + 1 per extra hour) or a level of exhaustion." />
      <Stat icon={Wheat} label="Food" value={`${travel.food} lb`} tone={travel.food < 1 ? "text-red-400" : "text-amber-200"} title="You eat 1 lb of food a day when you make camp." />
      <Stat icon={Droplets} label="Water" value={`${travel.water} gal`} tone={travel.water < need ? "text-red-400" : "text-sky-300"} title={`You need ${need} gallon${need > 1 ? "s" : ""} of water a day${travel.hot ? " in this heat" : ""}.`} />
      <Stat icon={BatteryLow} label="Exhaustion" value={`${travel.exhaustion}`} tone={travel.exhaustion ? "text-red-400" : "text-slate-400"}
        title={travel.exhaustion ? `Level ${travel.exhaustion}: ${EXHAUSTION_EFFECTS.slice(1, travel.exhaustion + 1).join("; ")}.` : "No exhaustion."} />
      {overDay && (
        <span className="text-xs text-red-300 basis-full" data-testid="wander-forced-march">
          Past 8 hours on the road: every further hour is a forced march (Constitution save, DC 10 + 1 per extra hour, or a level of exhaustion). Make camp to rest.
        </span>
      )}
      <Button size="sm" variant="outline" className="ml-auto border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10" onClick={onCamp} disabled={camping} data-testid="wander-camp">
        {camping ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Tent className="h-4 w-4 mr-1" />}
        Make camp
      </Button>
    </div>
  );
}

const PACES: Array<{ id: Pace; label: string; hint: string }> = [
  { id: "fast", label: "Fast", hint: "4 mph, 1.5 h a hex. -5 passive Perception, -5 to navigate, can't forage." },
  { id: "normal", label: "Normal", hint: "3 mph, 2 h a hex." },
  { id: "slow", label: "Slow", hint: "2 mph, 3 h a hex. You can move stealthily, +5 to navigate." },
];

const ACTIVITIES: Array<{ id: TravelActivity; label: string; icon: typeof Compass; hint: string }> = [
  { id: "navigate", label: "Navigate", icon: Compass, hint: "Survival check to avoid getting lost (DC 5 grassland, 10 desert, 15 forest, swamp, mountains). Nobody navigating means disadvantage." },
  { id: "forage", label: "Forage", icon: Search, hint: "Survival check (DC 10 / 15 / 20 by how much the land offers) for 1d6 + Wis lb of food and gallons of water." },
  { id: "scout", label: "Scout", icon: Eye, hint: "Keep watch: full passive Perception at any pace, and see landmarks a hex further." },
];

export function TravelControls({
  pace, activity, onPace, onActivity,
}: { pace: Pace; activity: TravelActivity; onPace: (p: Pace) => void; onActivity: (a: TravelActivity) => void }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3" data-testid="wander-travel-controls">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 w-14">Pace</span>
        <div className="flex rounded-md border border-slate-700 overflow-hidden">
          {PACES.map((p) => (
            <button key={p.id} title={p.hint} onClick={() => onPace(p.id)}
              className={`px-3 py-1 text-xs ${pace === p.id ? "bg-amber-600/30 text-amber-200" : "bg-slate-900 text-slate-400 hover:text-slate-200"}`}
              data-testid={`wander-pace-${p.id}`}
            >{p.label}</button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 w-14 sm:w-auto">While travelling</span>
        <div className="flex rounded-md border border-slate-700 overflow-hidden">
          {ACTIVITIES.map((a) => (
            <button key={a.id} title={a.hint} onClick={() => onActivity(a.id)}
              disabled={a.id === "forage" && pace === "fast"}
              className={`px-3 py-1 text-xs flex items-center gap-1 disabled:opacity-40 ${activity === a.id ? "bg-sky-700/30 text-sky-200" : "bg-slate-900 text-slate-400 hover:text-slate-200"}`}
              data-testid={`wander-activity-${a.id}`}
            >
              <a.icon className="h-3 w-3" />{a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RollList({ rolls, notes }: { rolls?: string[]; notes?: string[] }) {
  if (!rolls?.length && !notes?.length) return null;
  return (
    <div className="space-y-1.5" data-testid="wander-rolls">
      {(notes ?? []).map((n, i) => (
        <p key={`n${i}`} className="text-xs text-amber-200/90 leading-relaxed">{n}</p>
      ))}
      {(rolls ?? []).map((r, i) => (
        <div key={`r${i}`} className="flex items-start gap-1.5 text-[11px] font-mono text-slate-300 bg-slate-950/60 border border-slate-800 rounded px-2 py-1">
          <Dices className="h-3 w-3 mt-0.5 shrink-0 text-slate-500" />
          <span className={/success|spot them first/.test(r) ? "text-emerald-300" : /failure|unaware/.test(r) ? "text-red-300" : ""}>{r}</span>
        </div>
      ))}
    </div>
  );
}

const BEAT_LABEL: Record<string, string> = {
  sign: "First signs", trace: "On the trail", approach: "Close", climax: "Found it", rumor: "Rumor",
};

export function TrailsJournal({ threads }: { threads: JournalThread[] }) {
  return (
    <Card className="border-slate-700/50 bg-slate-900/50" data-testid="wander-trails">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-amber-300">
          <Footprints className="h-4 w-4" /> Trails and rumors
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {threads.length === 0 ? (
          <p className="text-xs text-slate-500">No trails yet. Discoveries sometimes turn out to be the first sign of something bigger, and the Tavern regulars hear road news.</p>
        ) : threads.map((t) => (
          <div key={t.id} className="p-2 rounded bg-slate-800/50 border border-slate-700/50">
            <div className="flex items-center gap-2">
              {t.status === "rumored" ? <HelpCircle className="h-3.5 w-3.5 text-violet-300" /> : <Compass className="h-3.5 w-3.5 text-amber-300" />}
              <span className="text-sm text-slate-100">{t.title}</span>
              <Badge variant="outline" className="ml-auto text-[10px] border-slate-600 text-slate-300">{BEAT_LABEL[t.beat] ?? t.beat}</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {t.distance === 0 ? "Right here." : `${t.bearing}${t.target || t.beat !== "sign" ? `, about ${t.distance} hex${t.distance === 1 ? "" : "es"}` : ""}`}
            </p>
            {t.rumor?.text && <p className="text-xs italic text-slate-500 mt-1">"{t.rumor.text}" ({t.rumor.source})</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function checkLabel(check?: { skill: string; dc: number }): string | null {
  if (!check) return null;
  const skill = check.skill.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `${skill} DC ${check.dc}`;
}
