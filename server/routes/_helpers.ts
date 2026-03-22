import { storage } from "../storage";
import { db } from "../db";
import { getAIClient, getAppOpenAI } from "../lib/aiProvider";
import { objectStorageClient } from "../replit_integrations/object_storage";
import { randomUUID } from "crypto";
import { eq, sql, desc, and } from "drizzle-orm";
import {
  campaignQuests,
  characterReputationProfiles,
  reputationEvents,
  factions,
  worldLocations,
} from "@shared/schema";
import {
  type TraceEventKind,
  type TraceEvent,
  type CAMLTrace,
  type TraceCampaign,
  type TraceSession,
  type TraceActor,
  generateEventId,
  generateTraceId,
  generateModuleId,
  CAML_TRACE_VERSION
} from "@shared/caml-trace";
import OpenAI from "openai";

const openai = getAppOpenAI();

export async function generateCAMLCoverArt(title: string, summary: string, theme: string): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) return "";

    const appOpenAI = getAppOpenAI();
    const prompt = `Create a stunning fantasy adventure cover art for a tabletop RPG adventure called "${title}". Theme: ${theme}. ${summary.substring(0, 200)}. Style: Epic fantasy book cover art with dramatic lighting, rich colors, and an atmosphere of mystery and adventure. The image should evoke the feeling of an exciting quest ahead, suitable for a fantasy RPG module cover.`;

    const response = await appOpenAI.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "vivid",
    });

    const imageData = response.data?.[0];
    if (!imageData?.url) return "";

    const imageResponse = await fetch(imageData.url);
    if (!imageResponse.ok) return "";

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) return "";

    const bucket = objectStorageClient.bucket(bucketId);
    const uuid = randomUUID();
    const file = bucket.file(`public/caml-covers/${uuid}.png`);
    await file.save(imageBuffer, {
      contentType: "image/png",
      metadata: { cacheControl: "public, max-age=31536000" },
    });

    return `/objects/caml-covers/${uuid}.png`;
  } catch (error: any) {
    console.error("Error generating CAML cover art:", error.message);
    return "";
  }
}

const narrativeCache = new Map<string, { narrative: string; timestamp: number }>();
const NARRATIVE_CACHE_TTL = 5 * 60 * 1000;

export function getCachedNarrative(campaignId: number, userId: number): string | null {
  const key = `${campaignId}:${userId}`;
  const entry = narrativeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > NARRATIVE_CACHE_TTL) {
    narrativeCache.delete(key);
    return null;
  }
  return entry.narrative;
}

export function setCachedNarrative(campaignId: number, userId: number, narrative: string) {
  const key = `${campaignId}:${userId}`;
  narrativeCache.set(key, { narrative, timestamp: Date.now() });
}

export function deleteCachedNarrative(campaignId: number, userId: number) {
  narrativeCache.delete(`${campaignId}:${userId}`);
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

// ============================================
// SCENE SCHEMA v2 - BALANCED ENCOUNTER RULES
// ============================================
// These constraints ensure varied scene types with natural combat encounters

export const SCENE_GENERATION_CONSTRAINTS = `
SCENE GENERATION CONSTRAINTS (FOLLOW STRICTLY):

1. Combat is a NATURAL part of adventuring. Dangerous worlds have hostile creatures, bandits, monsters, and enemies. Don't shy away from combat — it keeps players on their toes and makes the world feel alive and dangerous.

2. NEVER generate two Combat scenes in a row unless the player explicitly chooses violence or an ongoing battle continues.

3. Every scene SHOULD have multiple approaches. Include at least:
   - One Dialogue/Social option
   - One Investigation/Exploration option  
   - One bold or forceful option (which may involve combat)
   Combat can also appear organically — ambushes, territorial creatures, hostile patrols, or monsters in lairs don't wait for player permission.

4. Combat can appear as:
   - A random encounter while traveling or exploring (bandits, wild creatures, hostile patrols)
   - An ambush or surprise attack from enemies lurking nearby
   - Territorial creatures defending their domain
   - Enemies acting on their own agenda (raiding, hunting, guarding)
   - An escalation from failed checks or player aggression
   - A consequence of poor choices or failed stealth
   - A deliberate player choice

5. Scene types should vary. Prefer this distribution:
   - Exploration (22%): Discover environments, find clues, uncover secrets
   - Social (18%): Negotiate, persuade, gather information, roleplay
   - Combat (15%): Meaningful battles, random encounters, ambushes, monster lairs
   - Discovery (15%): Reveal lore, find treasures, learn about the world
   - Travel (12%): Journey between locations, random encounters, atmosphere
   - Puzzle (10%): Solve riddles, navigate traps, overcome obstacles cleverly
   - Downtime (8%): Rest, craft, shop, personal character moments

6. When presenting choices:
   - Include combat-forward options that feel exciting ("Draw your weapon and charge!", "Prepare for battle!")
   - Frame non-combat options as equally valid ("Try to negotiate", "Sneak past undetected")
   - Ensure at least one option advances the story without fighting
   - Sometimes the world forces combat — an ambush doesn't offer a dialogue option first

7. Resolution modes include:
   - Combat: Direct confrontation, defensive fighting, tactical retreat
   - Dialogue: Persuasion, deception, intimidation, negotiation
   - Investigation: Perception, arcana, history, tracking clues
   - Ingenuity: Creative problem-solving, using environment, crafting solutions
   - Stealth: Sneaking, hiding, avoiding detection
   - Endurance: Survival, endurance challenges, resisting effects
`;

export const SCENE_CHOICE_FRAMING = `
CHOICE FRAMING REQUIREMENTS:
- Each scene must present 3-4 meaningful options
- At least ONE option must be non-violent (dialogue, investigation, stealth)
- At least ONE option must be investigative or exploratory
- Combat options should note risk level and potential consequences
- Frame choices to encourage player creativity and varied approaches
- Include skill variety: social (persuasion, insight), mental (investigation, arcana), physical (athletics, stealth)

NARRATIVE-CHOICE ALIGNMENT (CRITICAL):
- If your narrative presents a moral dilemma, fork, or decision between two paths, the CHOICES MUST include clear options representing EACH SIDE of that decision
- Example: If the story says "you must choose between preserving the balance or unleashing the chaos," the choices MUST include one option for preserving and one for unleashing — do NOT replace them with generic utility actions like "heal wounds" or "explore the area"
- The choices are WHERE THE PLAYER MAKES THE DECISION the narrative sets up. If the narrative builds toward a fork and the choices dodge it, the story feels hollow and unsatisfying
- At least 2 of the 4 choices must directly engage with the central tension or dilemma of the current scene
- Generic "housekeeping" choices (heal, rest, search, meditate) may fill remaining slots but must NEVER crowd out the actual narrative decision
`;

export const WAYPOINT_TRAVEL_PATTERNS = /\b(walk|continue|head\s+(north|south|east|west|forward|back|onward)|travel|proceed|move\s+(on|forward|ahead|along)|go\s+(to|forward|north|south|east|west|ahead|on)|keep\s+(going|walking|moving)|press\s+(on|forward|ahead)|march|trek|follow\s+the\s+(path|road|trail|river)|take\s+the\s+(path|road|trail)|carry\s+on|advance|wander|stroll|ride\s+(on|forward|ahead)|set\s+off|set\s+out|leave|depart|make\s+(my|our)\s+way)\b/i;

export function isWaypointTravel(action: string): boolean {
  if (!action) return false;
  const lower = action.toLowerCase().trim();
  if (WAYPOINT_TRAVEL_PATTERNS.test(lower)) {
    const combatIntent = /\b(attack|fight|strike|cast|shoot|fire|slash|stab|kill|ambush|charge)\b/i;
    const socialIntent = /\b(talk|speak|ask|persuade|negotiate|interrogate|convince|intimidate|bribe)\b/i;
    const investigateIntent = /\b(search|examine|inspect|investigate|study|analyze|read|decipher|open|pick\s+lock|disarm)\b/i;
    if (combatIntent.test(lower) || socialIntent.test(lower) || investigateIntent.test(lower)) {
      return false;
    }
    return true;
  }
  return false;
}

export const SCENE_TEMPERATURE_SCALING = `
SCENE TEMPERATURE — MATCH INTENSITY TO CONTEXT (CRITICAL):
Not every scene is a world-changing event. Scale your narrative intensity to fit the actual situation:

WAYPOINT MOVE (simple travel/movement) — 20-35 words:
- Triggered when the player's action is purely movement: "continue forward", "head north", "walk to the village", "proceed along the road", "move on", "travel to the next town"
- Write a BRIEF 1-2 sentence transition. Describe the journey in passing — terrain, weather, a small detail — then state where they arrive.
- Do NOT invent encounters, dramatic events, ambushes, or discoveries during waypoint moves unless the story explicitly demands it (e.g., an established pursuit)
- Do NOT describe glowing anything, mystical energy, ancient power, or cosmic significance during simple travel
- Examples of good waypoint transitions:
  * "The trail winds through sparse pines before opening onto a grassy ridge. Ahead, the village of Thornfield comes into view."
  * "You follow the river south for an hour. The current quickens near a weathered stone bridge."
  * "The road is quiet. Dust kicks up with each step until the crossroads appears around the bend."
- Choices after waypoint moves should be practical: explore the new area, talk to someone nearby, rest, or keep moving

LOW TEMPERATURE (calm, routine, transitional) — 30-50 words:
- Shopping, resting, casual conversation, arriving at a familiar place
- 2-3 sentences max. One sensory detail, what happens, move on.
- Choices should be simple and practical: "Head north" / "Browse the stall" / "Ask about local rumors"
- NO cosmic stakes, ancient prophecies, or mystical revelations in mundane moments

MEDIUM TEMPERATURE (engaging, purposeful) — 60-90 words:
- Meeting an NPC with information, discovering a clue, entering a new area, social encounters
- 3-5 sentences. Focus on what's interesting and what the player can interact with.
- Choices should offer meaningful variety but proportionate stakes

HIGH TEMPERATURE (dramatic, climactic) — 80-120 words:
- Boss fights, betrayals, major reveals, critical story turning points
- Full prose, emotional weight, dramatic tension — this is where you pull out all the stops
- Choices carry real consequences and should feel weighty

RULES:
- Default to LOW or MEDIUM temperature. HIGH should be rare — maybe 1 in every 5-6 scenes.
- If the player just chose "walk down the road", "continue forward", "head north", "travel to X", or any simple movement action, use WAYPOINT MOVE temperature. Do NOT turn a simple step into a mystical encounter with glowing runes or an ambush.
- Travel scenes, shopping, and idle moments should feel grounded and natural, not portentous.
- Save dramatic language (ancient, mystical, cosmic, fate, destiny, prophecy) for moments that earn it.
- Variety in pacing is what makes dramatic moments land. A story that's always at 10 has no impact.

DESCRIPTION VARIETY — AVOID REPETITION (CRITICAL):
BANNED PHRASES — Do NOT use any of these:
- "glowing runes", "ancient runes glow", "runes pulse with energy"
- "mystical energy", "arcane symbols pulse", "magical energy crackles"
- "eldritch power", "otherworldly glow", "shimmering aura"

Instead, vary your environmental descriptions using these alternatives:
- Carved stonework, weathered carvings, faded inscriptions, chiseled grooves
- Painted murals, mosaic tile patterns, tapestry-covered walls
- Mechanical contraptions, clockwork devices, weighted pulleys, iron levers
- Crystal formations, mineral veins, phosphorescent moss, bioluminescent fungi
- Natural phenomena: thermal vents, underground streams, wind-carved passages
- Architectural details: crumbling arches, buttressed ceilings, iron-banded doors
- Sensory details: dripping water, distant echoes, musty air, cold drafts, the smell of damp earth
- Evidence of habitation: scratched tally marks, scattered tools, old campfire rings, discarded rations

Rotate through different description categories. If your last scene used stonework, try natural phenomena or mechanical elements next.

ANTI-REPETITION DIRECTIVE:
You MUST avoid repeating the same descriptive patterns across scenes. Track what you have already described and choose something different each time.

DO NOT default to magical/arcane descriptions for every environment. Most rooms, corridors, and spaces are mundane — made of stone, wood, earth, or metal. Magic should be the exception, not the rule.

For puzzles and obstacles, vary the type:
- Mechanical: gears, levers, counterweights, pressure plates, rotating cylinders
- Natural: flooding water, unstable ground, narrow ledges, tangled roots, ice patches
- Architectural: collapsed passages, hidden doors, rotating walls, false floors
- Social: riddles from guardians, bargains with spirits, tests of character
- Sensory: sound-based locks, color-matching sequences, scent trails, temperature puzzles

For environment descriptions, rotate through:
- Weather and atmosphere: fog, rain, dust motes, shafts of light, oppressive heat
- Fauna and flora: spiderwebs, bat colonies, mushroom clusters, lichen, root systems
- Construction materials: brick, timber, packed earth, rough-hewn stone, polished marble
- Age indicators: rust, moss, erosion, fresh tool marks, recent repairs
`;

export async function improviseDoctrine(campaign: any): Promise<{ campaignQuestion: string; campaignStakes: any[]; chapterGates: any[] } | null> {
  const hasDoctrine = (campaign.campaignQuestion && campaign.campaignStakes?.length > 0 && campaign.chapterGates?.length > 0);
  if (hasDoctrine) return null;

  // Concurrency guard: re-fetch to avoid duplicate writes if another request just persisted
  const fresh = await storage.getCampaign(campaign.id);
  if (fresh && fresh.campaignQuestion && (fresh as any).campaignStakes?.length > 0 && (fresh as any).chapterGates?.length > 0) {
    return { campaignQuestion: fresh.campaignQuestion!, campaignStakes: (fresh as any).campaignStakes, chapterGates: (fresh as any).chapterGates };
  }

  const title = campaign.title || "Unknown Adventure";
  const desc = campaign.description || "";
  const totalChapters = campaign.totalChapters || 5;
  const difficulty = campaign.difficulty || "medium";
  const style = campaign.narrativeStyle || "dramatic";

  const descLower = desc.toLowerCase();
  const titleLower = title.toLowerCase();
  const combined = titleLower + " " + descLower;

  const themeKeywords: Record<string, string[]> = {
    undead: ["undead", "zombie", "skeleton", "necromancer", "lich", "vampire", "death", "grave", "tomb"],
    wilderness: ["forest", "wild", "beast", "hunt", "nature", "druid", "ranger", "wolf", "bear"],
    political: ["kingdom", "throne", "king", "queen", "noble", "court", "alliance", "war", "politics", "crown"],
    arcane: ["magic", "wizard", "arcane", "spell", "enchant", "rune", "sorcerer", "ritual", "tower"],
    heist: ["thief", "heist", "steal", "rogue", "guild", "smuggl", "crime", "treasure"],
    horror: ["horror", "curse", "haunt", "dark", "shadow", "demon", "abyss", "madness", "fear"],
    exploration: ["explore", "discover", "ruin", "ancient", "lost", "forgotten", "dungeon", "cave", "map"],
    nautical: ["sea", "ocean", "ship", "pirate", "sail", "harbor", "voyage", "nautical"],
    divine: ["god", "temple", "cleric", "paladin", "holy", "prayer", "divine", "faith", "celestial"],
    swamp: ["swamp", "marsh", "bog", "bayou", "wetland", "mire", "lizardfolk", "hag"],
    arctic: ["arctic", "ice", "snow", "frost", "frozen", "tundra", "glacier", "blizzard", "winter"],
    feywild: ["fey", "feywild", "fairy", "pixie", "archfey", "enchanted", "whimsical", "sprite"],
    underdark: ["underdark", "drow", "subterranean", "cavern", "illithid", "mind flayer", "deep"],
    planar: ["plane", "planar", "portal", "astral", "ethereal", "elemental", "celestial", "infernal"],
  };

  let detectedTheme = "exploration";
  let bestScore = 0;
  for (const [theme, keywords] of Object.entries(themeKeywords)) {
    const score = keywords.filter(kw => combined.includes(kw)).length;
    if (score > bestScore) { bestScore = score; detectedTheme = theme; }
  }
  // Require minimum confidence — below threshold, fall back to exploration
  if (bestScore < 2) detectedTheme = "exploration";

  const stakeTemplates: Record<string, { stakes: any[]; questionTemplate: string }> = {
    undead: {
      questionTemplate: `Should the veil between life and death be restored, exploited, or accepted as broken — and who pays the price of each answer?`,
      stakes: [
        { id: "veil_integrity", name: "Veil Between Life and Death", value: 3, max: 5, description: "The barrier keeping the dead at rest", passiveDrift: -1, driftReason: "The veil frays further each day without active intervention", worsensWhen: ["Disturbing burial sites", "Using necromantic artifacts", "Ignoring growing undead threats"], improvesWhen: ["Consecrating defiled ground", "Discovering the source of corruption", "Allying with ancestral spirits"], thresholdConsequence: { at0: { event: "The veil collapses — the dead walk freely and cannot be put down by ordinary means", irreversible: true, forksTo: "world_of_walking_dead" }, at5: { event: "The veil is sealed so tightly that resurrection magic fails permanently", irreversible: true, forksTo: "no_resurrection_world" } } },
        { id: "survivor_hope", name: "Survivor Hope", value: 3, max: 5, description: "The living's will to resist the darkness", passiveDrift: -1, driftReason: "Without visible victories, despair spreads", worsensWhen: ["Failing to protect innocents", "Losing key allies", "Spreading fear"], improvesWhen: ["Rescuing survivors", "Defeating major undead", "Restoring safe havens"], thresholdConsequence: { at0: { event: "Survivors abandon the region — the land is ceded to the dead", irreversible: true, forksTo: "abandoned_homeland" }, at5: { event: "A militia forms and begins aggressive purges, including of anything 'unnatural' — including friendly magic users", irreversible: false, forksTo: "zealot_militia" } } },
      ]
    },
    wilderness: {
      questionTemplate: `Must civilization retreat, adapt, or dominate the wilds — and what is lost in each choice?`,
      stakes: [
        { id: "natural_balance", name: "Natural Balance", value: 3, max: 5, description: "The harmony between civilization and the wild", passiveDrift: -1, driftReason: "Unchecked expansion tips the balance further", worsensWhen: ["Destroying natural sites", "Siding with exploiters", "Ignoring corruption in the land"], improvesWhen: ["Healing blighted areas", "Allying with nature guardians", "Finding sustainable solutions"], thresholdConsequence: { at0: { event: "The wilds awaken and strike back — settlements are overrun by awakened beasts and hostile fey", irreversible: true, forksTo: "nature_reclaims" }, at5: { event: "Nature is fully pacified but the land loses its magic — no more druidic power, fey vanish", irreversible: true, forksTo: "dead_magic_zone" } } },
        { id: "community_survival", name: "Community Survival", value: 3, max: 5, description: "Whether the people can coexist with the wilds", passiveDrift: -1, driftReason: "Food runs short and fear grows without active solutions", worsensWhen: ["Abandoning settlements", "Provoking territorial beasts", "Resource depletion"], improvesWhen: ["Establishing peace with wildlife", "Strengthening defenses", "Sharing resources wisely"], thresholdConsequence: { at0: { event: "The community collapses — refugees scatter and the settlement is lost", irreversible: true, forksTo: "diaspora" }, at5: { event: "The fortress-community thrives but becomes isolationist and hostile to outsiders", irreversible: false, forksTo: "fortress_mentality" } } },
      ]
    },
    political: {
      questionTemplate: `Should the old order be preserved, reformed, or overthrown — and what injustice does each answer require?`,
      stakes: [
        { id: "political_stability", name: "Political Stability", value: 3, max: 5, description: "The realm's ability to hold together under pressure", passiveDrift: -1, driftReason: "Factions maneuver and tensions simmer without mediation", worsensWhen: ["Betraying political allies", "Ignoring faction demands", "Public failures of leadership"], improvesWhen: ["Forging alliances", "Resolving disputes diplomatically", "Exposing true enemies"], thresholdConsequence: { at0: { event: "Civil war erupts — the realm fractures into hostile territories", irreversible: true, forksTo: "civil_war" }, at5: { event: "A single faction seizes total control — stability at the cost of freedom", irreversible: true, forksTo: "authoritarian_peace" } } },
        { id: "public_trust", name: "Public Trust", value: 3, max: 5, description: "How much the common people trust those in power", passiveDrift: -1, driftReason: "Rumors and unmet promises erode trust each day", worsensWhen: ["Breaking promises to the people", "Collateral damage from conflicts", "Cover-ups exposed"], improvesWhen: ["Delivering justice", "Protecting the vulnerable", "Transparent decisions"], thresholdConsequence: { at0: { event: "The people revolt — mobs storm the seats of power and justice becomes vigilante", irreversible: true, forksTo: "popular_revolt" }, at5: { event: "Blind trust enables corruption — advisors exploit the people's faith", irreversible: false, forksTo: "exploited_trust" } } },
      ]
    },
    arcane: {
      questionTemplate: `Should forbidden knowledge be destroyed, contained, or used — and who decides what's 'forbidden'?`,
      stakes: [
        { id: "arcane_stability", name: "Arcane Stability", value: 3, max: 5, description: "The stability of magical forces in the region", passiveDrift: -1, driftReason: "Unstable magic bleeds further into the world without containment", worsensWhen: ["Reckless spellcasting", "Tampering with wards", "Using forbidden magic"], improvesWhen: ["Restoring magical barriers", "Containing wild magic", "Learning ancient safeguards"], thresholdConsequence: { at0: { event: "A wild magic catastrophe reshapes the landscape — spells become unpredictable everywhere", irreversible: true, forksTo: "wild_magic_zone" }, at5: { event: "Magic is locked down so tightly that casting requires institutional approval — mage guilds become tyrannical", irreversible: true, forksTo: "magic_police_state" } } },
        { id: "knowledge_cost", name: "Price of Knowledge", value: 2, max: 5, description: "How much has been sacrificed in pursuit of understanding", passiveDrift: 0, driftReason: "Knowledge sought stays sought", worsensWhen: ["Pushing past warnings", "Ignoring the cost on others", "Choosing power over wisdom"], improvesWhen: ["Accepting limitations", "Sharing discoveries", "Protecting the uninitiated"], thresholdConsequence: { at0: { event: "The secret is lost forever — sealed by those who paid too much to learn it", irreversible: true, forksTo: "sealed_knowledge" }, at5: { event: "The knowledge transforms its wielder — power corrupts absolutely", irreversible: true, forksTo: "corruption_of_power" } } },
      ]
    },
    heist: {
      questionTemplate: `Is this job worth what it will cost your crew, your principles, and the people caught in the crossfire?`,
      stakes: [
        { id: "crew_loyalty", name: "Crew Loyalty", value: 3, max: 5, description: "How much the team trusts each other under pressure", passiveDrift: -1, driftReason: "Stress and temptation erode trust without active maintenance", worsensWhen: ["Double-crossing allies", "Hoarding loot", "Leaving someone behind"], improvesWhen: ["Sharing risks equally", "Keeping promises under pressure", "Sacrificing for the team"], thresholdConsequence: { at0: { event: "The crew fractures — someone sells out to the opposition", irreversible: true, forksTo: "betrayed_by_crew" }, at5: { event: "Fanatical loyalty — the crew follows into clearly suicidal plans without question", irreversible: false, forksTo: "blind_loyalty" } } },
        { id: "heat_level", name: "Heat Level", value: 2, max: 5, description: "How close the authorities are to catching you", passiveDrift: 1, driftReason: "Investigations continue whether you act or not", worsensWhen: ["Leaving evidence", "Drawing public attention", "Betraying informants"], improvesWhen: ["Clean getaways", "Planting false trails", "Buying silence"], thresholdConsequence: { at0: { event: "You're completely off the radar — but so is your reputation; no one will hire you", irreversible: false, forksTo: "ghost_crew" }, at5: { event: "Manhunt — the full weight of the law descends, safe houses are burned, allies arrested", irreversible: true, forksTo: "manhunt" } } },
      ]
    },
    horror: {
      questionTemplate: `Can the horror be stopped, or only survived — and what must you become to endure it?`,
      stakes: [
        { id: "sanity_grip", name: "Grip on Reality", value: 3, max: 5, description: "The party's mental resilience against the horror", passiveDrift: -1, driftReason: "Proximity to the horror erodes sanity even in safety", worsensWhen: ["Witnessing traumatic events", "Using cursed items", "Isolation from allies"], improvesWhen: ["Finding moments of hope", "Understanding the threat", "Supporting each other"], thresholdConsequence: { at0: { event: "Madness claims a party member — they become an unreliable narrator, and reality bends", irreversible: true, forksTo: "fractured_reality" }, at5: { event: "Perfect clarity — but the truth is so terrible that sharing it breaks others", irreversible: false, forksTo: "terrible_knowledge" } } },
        { id: "corruption_spread", name: "Corruption Spread", value: 2, max: 5, description: "How far the darkness has reached", passiveDrift: 1, driftReason: "The corruption spreads whether you fight it or not", worsensWhen: ["Delay or inaction", "Spreading fear", "Failed containment"], improvesWhen: ["Destroying sources of corruption", "Saving the afflicted", "Sealing breaches"], thresholdConsequence: { at0: { event: "Corruption contained but the sealed zone is permanently lost — a dead zone on the map", irreversible: true, forksTo: "quarantine_zone" }, at5: { event: "The corruption is everywhere — no safe ground remains, survival becomes the only goal", irreversible: true, forksTo: "total_corruption" } } },
      ]
    },
    nautical: {
      questionTemplate: `What matters more — the destination, the crew, or what you left behind — and you can't save all three?`,
      stakes: [
        { id: "crew_morale", name: "Crew Morale", value: 3, max: 5, description: "The ship's company's will to continue the voyage", passiveDrift: -1, driftReason: "Every day at sea without progress saps the will", worsensWhen: ["Rationing supplies harshly", "Losing crew members", "Bad omens ignored"], improvesWhen: ["Successful raids or trades", "Shore leave", "Fair leadership"], thresholdConsequence: { at0: { event: "Mutiny — the crew seizes the ship and you must negotiate or fight for command", irreversible: true, forksTo: "mutiny" }, at5: { event: "The crew is blindly devoted — they ignore danger signs and push into suicidal waters", irreversible: false, forksTo: "fanatical_crew" } } },
        { id: "ship_integrity", name: "Ship Integrity", value: 3, max: 5, description: "The vessel's ability to survive what's coming", passiveDrift: -1, driftReason: "The sea takes its toll on every vessel", worsensWhen: ["Storms weathered poorly", "Combat damage", "Neglecting repairs"], improvesWhen: ["Skilled repairs", "Finding safe harbor", "Acquiring better equipment"], thresholdConsequence: { at0: { event: "The ship is lost — you're stranded, adrift, or marooned on unknown shores", irreversible: true, forksTo: "shipwrecked" }, at5: { event: "The ship is legendary — but it attracts hunters, pirates, and those who covet it", irreversible: false, forksTo: "hunted_vessel" } } },
      ]
    },
    divine: {
      questionTemplate: `When faith demands cruelty and mercy demands heresy, which do you choose — and can you live with either?`,
      stakes: [
        { id: "divine_favor", name: "Divine Favor", value: 3, max: 5, description: "The deity's attention and support", passiveDrift: -1, driftReason: "Gods grow distant when not actively served", worsensWhen: ["Acting against the faith's tenets", "Doubting openly", "Allying with enemies of the faith"], improvesWhen: ["Acts of devotion", "Converting others", "Self-sacrifice for the cause"], thresholdConsequence: { at0: { event: "Abandoned by the divine — holy powers fail, and a rival faith fills the void", irreversible: true, forksTo: "divine_abandonment" }, at5: { event: "Chosen instrument — the deity's will overrides free choice, you become a vessel", irreversible: true, forksTo: "divine_puppet" } } },
        { id: "mortal_cost", name: "Mortal Cost", value: 2, max: 5, description: "The toll on ordinary people caught in divine plans", passiveDrift: 1, driftReason: "Holy conflicts always claim innocent lives", worsensWhen: ["Collateral damage from holy wars", "Ignoring suffering", "Fanaticism"], improvesWhen: ["Protecting innocents", "Finding merciful solutions", "Questioning harmful doctrine"], thresholdConsequence: { at0: { event: "The people are spared but the divine mission fails — was mercy worth the cost?", irreversible: true, forksTo: "mercy_over_mission" }, at5: { event: "The crusade succeeds but the people are broken — a hollow victory over ashes", irreversible: true, forksTo: "pyrrhic_crusade" } } },
      ]
    },
    swamp: {
      questionTemplate: `Should the swamp's corruption be cleansed, contained, or harnessed — and what crawls from the depths when you disturb it?`,
      stakes: [
        { id: "corruption_spread", name: "Corruption Spread", value: 3, max: 5, description: "How far the swamp's blight is spreading into surrounding lands", passiveDrift: 1, driftReason: "The corruption grows when left unchecked", worsensWhen: ["Disturbing sealed evil", "Feeding the blight", "Destroying natural wards"], improvesWhen: ["Purifying water sources", "Allying with swamp guardians", "Sealing corruption fonts"], thresholdConsequence: { at0: { event: "The corruption is purged but the swamp dries up — an ecosystem dies to save the surrounding lands", irreversible: true, forksTo: "dead_wetland" }, at5: { event: "The blight engulfs the region — the swamp consumes everything, creating a vast poisoned wasteland", irreversible: true, forksTo: "endless_mire" } } },
        { id: "hag_influence", name: "Hag Influence", value: 2, max: 5, description: "The grip of the swamp's hag coven on local affairs", passiveDrift: 1, driftReason: "Hags scheme and manipulate constantly", worsensWhen: ["Making bargains with hags", "Revealing secrets to them", "Ignoring their machinations"], improvesWhen: ["Breaking hag bargains", "Uniting communities against them", "Destroying their totems"], thresholdConsequence: { at0: { event: "The hags are destroyed but their dying curse twists the land permanently", irreversible: true, forksTo: "cursed_land" }, at5: { event: "The hag coven ascends to full power — reality bends to their whims in the region", irreversible: true, forksTo: "hag_dominion" } } },
      ]
    },
    arctic: {
      questionTemplate: `Should the frozen north be tamed, respected, or feared — and what ancient things thaw when the ice retreats?`,
      stakes: [
        { id: "frozen_seal", name: "Frozen Seal", value: 3, max: 5, description: "Ancient things sealed beneath the ice", passiveDrift: -1, driftReason: "The ice recedes slowly, revealing what was buried", worsensWhen: ["Melting ice deliberately", "Using fire magic recklessly", "Disturbing frozen tombs"], improvesWhen: ["Reinforcing ancient wards", "Allying with frost guardians", "Containing thawed threats"], thresholdConsequence: { at0: { event: "The great thaw releases an ancient evil frozen since the dawn age", irreversible: true, forksTo: "ancient_awakening" }, at5: { event: "An eternal winter descends — nothing thaws, and the cold creeps southward", irreversible: true, forksTo: "endless_winter" } } },
        { id: "survival_resources", name: "Survival Resources", value: 3, max: 5, description: "Fuel, food, and shelter against the killing cold", passiveDrift: -1, driftReason: "The cold consumes resources relentlessly", worsensWhen: ["Losing shelter", "Wasting supplies", "Extended travel in storms"], improvesWhen: ["Finding caches", "Building alliances with locals", "Securing warm shelter"], thresholdConsequence: { at0: { event: "Resources are exhausted — the party faces death by exposure unless they make terrible bargains", irreversible: false, forksTo: "desperate_bargain" }, at5: { event: "Abundance attracts raiders from the frozen wastes who will kill for what you have", irreversible: false, forksTo: "raider_siege" } } },
      ]
    },
    feywild: {
      questionTemplate: `Do you play the fey's game by their rules, cheat to win, or refuse to play — knowing each choice has a price you can't foresee?`,
      stakes: [
        { id: "fey_debt", name: "Fey Debt", value: 2, max: 5, description: "Obligations owed to fey creatures", passiveDrift: 1, driftReason: "The fey count every kindness as a debt and every slight as an insult", worsensWhen: ["Accepting fey gifts", "Making promises", "Eating fey food"], improvesWhen: ["Repaying debts cleverly", "Outsmarting fey in their own games", "Finding loopholes in bargains"], thresholdConsequence: { at0: { event: "All debts are cleared — but the fey lose interest in you entirely, closing all doors to the Feywild", irreversible: true, forksTo: "fey_exile" }, at5: { event: "Debt collectors arrive — an archfey claims ownership of the party's memories, names, or shadows", irreversible: true, forksTo: "claimed_by_archfey" } } },
        { id: "reality_anchor", name: "Reality Anchor", value: 3, max: 5, description: "Your grip on the material plane and your true identity", passiveDrift: -1, driftReason: "The Feywild slowly erases your connection to the real world", worsensWhen: ["Spending too long in the Feywild", "Forgetting mortal concerns", "Embracing fey transformations"], improvesWhen: ["Clinging to mortal memories", "Keeping iron tokens", "Maintaining routines from home"], thresholdConsequence: { at0: { event: "You become fey — your mortal life fades to dream and you belong to the Feywild forever", irreversible: true, forksTo: "fey_transformation" }, at5: { event: "Your mortal nature repels the Feywild — it begins to reject and expel you violently", irreversible: false, forksTo: "feywild_rejection" } } },
      ]
    },
    underdark: {
      questionTemplate: `In the lightless deep, do you become the predator, forge impossible alliances, or find a way back to the sun — and what follows you up?`,
      stakes: [
        { id: "depth_madness", name: "Depth Madness", value: 2, max: 5, description: "The psychological toll of the endless dark", passiveDrift: 1, driftReason: "The Underdark erodes sanity through isolation and alien horrors", worsensWhen: ["Encountering aberrations", "Losing light sources", "Witnessing drow cruelty"], improvesWhen: ["Finding safe havens", "Maintaining group bonds", "Small victories against the dark"], thresholdConsequence: { at0: { event: "Mental clarity returns but the trauma leaves permanent phobias and nightmares", irreversible: false, forksTo: "scarred_survivors" }, at5: { event: "Madness takes hold — paranoia and hallucinations make it impossible to trust anyone", irreversible: true, forksTo: "paranoid_dissolution" } } },
        { id: "escape_progress", name: "Escape Progress", value: 2, max: 5, description: "How close you are to finding a path back to the surface", passiveDrift: 0, driftReason: "The Underdark doesn't reveal its secrets willingly", worsensWhen: ["Getting lost", "Tunnel collapses", "Being driven deeper by pursuers"], improvesWhen: ["Finding maps", "Allying with deep gnomes", "Discovering upward passages"], thresholdConsequence: { at0: { event: "Hopelessly lost — you must accept the Underdark as your new home and adapt or perish", irreversible: true, forksTo: "permanent_exile" }, at5: { event: "The way out is found but something ancient follows your trail to the surface", irreversible: true, forksTo: "brought_darkness_up" } } },
      ]
    },
    planar: {
      questionTemplate: `When gods and cosmic forces use mortals as pawns, do you serve, rebel, or transcend — and can any mortal survive the answer?`,
      stakes: [
        { id: "planar_stability", name: "Planar Stability", value: 3, max: 5, description: "The structural integrity of the planar boundaries", passiveDrift: -1, driftReason: "Every planar crossing weakens the barriers between worlds", worsensWhen: ["Opening portals recklessly", "Destroying planar anchors", "Angering planar guardians"], improvesWhen: ["Sealing breaches", "Restoring planar anchors", "Allying with modrons or inevitables"], thresholdConsequence: { at0: { event: "Planar collapse — multiple realities crash together in a maelstrom of chaos", irreversible: true, forksTo: "planar_convergence" }, at5: { event: "The planes are sealed permanently — no more travel, no more summons, no more divine intervention", irreversible: true, forksTo: "sealed_multiverse" } } },
        { id: "cosmic_attention", name: "Cosmic Attention", value: 2, max: 5, description: "How much attention powerful extraplanar beings pay to you", passiveDrift: 1, driftReason: "Mortals meddling with the planes always attract notice", worsensWhen: ["Using powerful planar magic", "Killing planar beings", "Collecting planar artifacts"], improvesWhen: ["Acting subtly", "Disguising your nature", "Resolving issues without force"], thresholdConsequence: { at0: { event: "You're beneath notice — but also without allies when cosmic threats arise", irreversible: false, forksTo: "invisible_mortals" }, at5: { event: "A cosmic entity takes personal interest — you become a piece in an unfathomable game", irreversible: true, forksTo: "cosmic_chess_piece" } } },
      ]
    },
    exploration: {
      questionTemplate: `Should what sleeps in these ruins be awakened, preserved, or destroyed — and who has the right to decide?`,
      stakes: [
        { id: "discovery_progress", name: "Discovery Progress", value: 2, max: 5, description: "How much of the mystery has been uncovered", passiveDrift: 0, driftReason: "Mysteries wait but don't solve themselves", worsensWhen: ["Missing clues", "Triggering traps", "Destroying evidence"], improvesWhen: ["Solving puzzles", "Finding hidden passages", "Deciphering ancient texts"], thresholdConsequence: { at0: { event: "The mystery is sealed forever — the ruins collapse or seal, taking their secrets with them", irreversible: true, forksTo: "mystery_lost" }, at5: { event: "The full truth is revealed — but it's dangerous knowledge that others will kill for", irreversible: true, forksTo: "dangerous_truth" } } },
        { id: "expedition_safety", name: "Expedition Safety", value: 3, max: 5, description: "How safe the party remains in dangerous territory", passiveDrift: -1, driftReason: "The deeper you go, the more the ruins resist", worsensWhen: ["Splitting the party", "Ignoring warnings", "Exhausting resources"], improvesWhen: ["Careful preparation", "Finding allies underground", "Securing rest areas"], thresholdConsequence: { at0: { event: "The expedition is lost — survivors must choose between pressing on alone or retreating empty-handed", irreversible: true, forksTo: "lost_expedition" }, at5: { event: "Overconfidence — the party pushes into a trap that exploits their feeling of invincibility", irreversible: false, forksTo: "hubris_trap" } } },
      ]
    },
  };

  const template = stakeTemplates[detectedTheme] || stakeTemplates.exploration;
  
  // Adjust starting stake values based on difficulty
  const difficultyModifier = difficulty === "hard" ? -1 : difficulty === "easy" ? 1 : 0;
  
  const campaignQuestion = campaign.campaignQuestion || 
    template.questionTemplate.replace(/\?$/, ` in ${title}?`);

  const campaignStakes = campaign.campaignStakes?.length > 0 
    ? campaign.campaignStakes 
    : template.stakes.map((s: any) => ({
        ...s,
        value: Math.max(1, Math.min(5, s.value + difficultyModifier))
      }));

  const chapterGates = campaign.chapterGates?.length > 0 
    ? campaign.chapterGates 
    : Array.from({ length: totalChapters }, (_, i) => {
        const chapter = i + 1;
        if (chapter === 1) return { chapter, advanceWhen: "The party understands the true nature of the threat", requiredTruth: "The real danger is revealed" };
        if (chapter === totalChapters) return { chapter, advanceWhen: "The final confrontation is resolved and the campaign question is answered", requiredCommitment: "Make the defining choice" };
        if (chapter <= Math.ceil(totalChapters / 2)) return { chapter, advanceWhen: "A key alliance or commitment is forged that changes the approach", requiredCommitment: "Commit to a path forward" };
        return { chapter, advanceWhen: "A deeply held belief about the situation changes based on new evidence", requiredBeliefChange: "What seemed true is revealed to be more complex" };
      });

  console.log(`DOCTRINE IMPROVISED for campaign ${campaign.id} "${title}" (theme: ${detectedTheme}) — question: "${campaignQuestion.substring(0, 60)}...", ${campaignStakes.length} stakes, ${chapterGates.length} gates`);

  try {
    await storage.updateCampaign(campaign.id, {
      campaignQuestion,
      campaignStakes,
      chapterGates,
      narrativeLog: campaign.narrativeLog || [],
    });
  } catch (err) {
    console.error(`Failed to persist improvised doctrine for campaign ${campaign.id}:`, err);
  }

  return { campaignQuestion, campaignStakes, chapterGates };
}

export function applyStakePassiveDrift(stakes: any[]): { updatedStakes: any[]; driftLog: string[]; thresholdEvents: any[] } {
  const driftLog: string[] = [];
  const thresholdEvents: any[] = [];
  const updatedStakes = stakes.map((s: any) => {
    const drift = s.passiveDrift || 0;
    if (drift === 0) return s;
    
    const oldValue = s.value;
    const newValue = Math.max(0, Math.min(s.max || 5, oldValue + drift));
    if (newValue === oldValue) return s;
    
    driftLog.push(`PASSIVE DRIFT: ${s.name} [${s.id}] ${drift > 0 ? '+' : ''}${drift} (${oldValue}→${newValue}/${s.max}) — ${s.driftReason || 'world pressure'}`);
    
    const updated = { ...s, value: newValue };
    
    if (s.thresholdConsequence) {
      if (newValue === 0 && oldValue > 0 && s.thresholdConsequence.at0) {
        const tc = s.thresholdConsequence.at0;
        thresholdEvents.push({
          stakeId: s.id,
          stakeName: s.name,
          threshold: 0,
          event: tc.event,
          irreversible: tc.irreversible || false,
          forksTo: tc.forksTo || null
        });
        driftLog.push(`THRESHOLD BREACHED (0): ${s.name} — ${tc.event}${tc.irreversible ? ' [IRREVERSIBLE]' : ''}`);
      }
      if (newValue >= (s.max || 5) && oldValue < (s.max || 5) && s.thresholdConsequence.at5) {
        const tc = s.thresholdConsequence.at5;
        thresholdEvents.push({
          stakeId: s.id,
          stakeName: s.name,
          threshold: s.max || 5,
          event: tc.event,
          irreversible: tc.irreversible || false,
          forksTo: tc.forksTo || null
        });
        driftLog.push(`THRESHOLD BREACHED (max): ${s.name} — ${tc.event}${tc.irreversible ? ' [IRREVERSIBLE]' : ''}`);
      }
    }
    
    return updated;
  });
  
  return { updatedStakes, driftLog, thresholdEvents };
}

export async function recordTrace(
  campaignId: number,
  kind: TraceEventKind,
  payload: any,
  options?: { sessionId?: string; who?: string; where?: string; note?: string }
): Promise<void> {
  try {
    const eventCount = await storage.getTraceEventCount(campaignId);
    const eid = generateEventId(eventCount + 1);
    
    await storage.recordTraceEvent({
      campaignId,
      sessionId: options?.sessionId,
      eid,
      kind,
      payload,
      ts: new Date().toISOString(),
      who: options?.who,
      locationRef: options?.where,
      note: options?.note
    });
  } catch (error) {
    console.error("Failed to record trace event:", error);
  }
}

// Validate player choice against game rules and campaign constraints
export function validatePlayerChoice(
  choice: string,
  user: any,
  campaign: any,
  participants: any[]
): { valid: boolean; reason?: string; suggestion?: string } {
  if (!choice || typeof choice !== 'string') {
    return { valid: true }; // Empty choices are handled elsewhere
  }
  
  const lowerChoice = choice.toLowerCase().trim();
  
  // Check for rule-breaking actions
  const forbiddenPatterns = [
    { pattern: /\b(kill|murder|attack)\s+(myself|my\s+character)/i, reason: "You cannot intentionally kill your own character through narrative choice. Use the death saving throws system.", suggestion: "Try an action that your character would actually take in the situation." },
    { pattern: /\b(i\s+win|we\s+win|instant\s+victory|automatically\s+succeed)/i, reason: "Actions must be resolved through proper game mechanics, not declared outcomes.", suggestion: "Describe what your character attempts to do, then let the dice and DM determine the outcome." },
    { pattern: /\b(spawn|summon|create)\s+\d+\s+(gold|coins|items|weapons)/i, reason: "You cannot create items or currency out of nothing.", suggestion: "Look for treasure through exploration or earn gold through quests." },
    { pattern: /\b(teleport|fly|cast)\b.*\b(without|no\s+spell)/i, reason: "Magical abilities require proper spells, class features, or items.", suggestion: "Use abilities your character actually possesses based on their class and level." },
    { pattern: /\b(i\s+am\s+now\s+level\s*\d+|level\s+up\s+instantly)/i, reason: "Character progression happens through XP earned in gameplay.", suggestion: "Continue adventuring to earn experience points." },
  ];
  
  for (const fp of forbiddenPatterns) {
    if (fp.pattern.test(lowerChoice)) {
      return { valid: false, reason: fp.reason, suggestion: fp.suggestion };
    }
  }
  
  // Check for metagaming (using out-of-character knowledge)
  const metagamingPatterns = [
    { pattern: /\b(according\s+to\s+the\s+rules|by\s+the\s+book|RAW|rules\s+as\s+written)/i, reason: "Describe your character's actions in-character, not rules references.", suggestion: "Describe what your character does or says, not rule mechanics." },
    { pattern: /\b(i\s+read\s+ahead|i\s+know\s+this\s+module|spoiler)/i, reason: "Please avoid using out-of-character knowledge.", suggestion: "React to the story as your character would, based on what they know." },
  ];
  
  for (const mp of metagamingPatterns) {
    if (mp.pattern.test(lowerChoice)) {
      return { valid: false, reason: mp.reason, suggestion: mp.suggestion };
    }
  }
  
  // Check character status constraints
  const currentParticipant = participants.find(p => p.userId === user.id);
  if (currentParticipant) {
    // Additional character-specific validation could go here
    // For example, checking if a dead character is trying to act
  }
  
  return { valid: true };
}

// Reputation system helper functions
export interface StoryArcData {
  profiles: any[];
  recentEvents: any[];
}

export function generateNarrativeSummary(storyArc: StoryArcData): string {
  const { profiles, recentEvents } = storyArc;
  
  if (profiles.length === 0 && recentEvents.length === 0) {
    return "Your story is just beginning. The world doesn't know you yet, but every adventure shapes how others will come to see you.";
  }
  
  const summaryParts: string[] = [];
  
  // Add world perception if exists
  const worldProfile = profiles.find(p => !p.factionId);
  if (worldProfile) {
    if (worldProfile.trustDescriptor) {
      summaryParts.push(worldProfile.trustDescriptor);
    }
    if (worldProfile.behaviorDescriptor) {
      summaryParts.push(worldProfile.behaviorDescriptor);
    }
  }
  
  // Add notable deeds from recent events
  const significantEvents = recentEvents.filter(e => e.significance === 'major' || e.significance === 'defining');
  if (significantEvents.length > 0) {
    const deedsSummary = significantEvents.slice(0, 2).map(e => e.narrativeSummary).join(' ');
    if (deedsSummary) {
      summaryParts.push(deedsSummary);
    }
  }
  
  // Faction standings
  const factionProfiles = profiles.filter(p => p.factionId);
  if (factionProfiles.length > 0) {
    const standingNotes = factionProfiles
      .filter(f => f.trustLevel && f.trustLevel !== 'unknown')
      .slice(0, 2)
      .map(f => f.trustDescriptor || `Your standing with some factions has been noted.`);
    summaryParts.push(...standingNotes);
  }
  
  if (summaryParts.length === 0) {
    return "The world is beginning to take notice of your deeds. Keep adventuring to see how your reputation develops.";
  }
  
  return summaryParts.join(' ');
}

export function generateCharacterArcSummaryForDM(signal: { characterName: string; profiles: any[]; recentEvents: any[] }): string {
  const { characterName, profiles, recentEvents } = signal;
  
  if (profiles.length === 0 && recentEvents.length === 0) {
    return `${characterName} has no notable reputation yet.`;
  }
  
  const insights: string[] = [];
  
  // Analyze trust patterns
  const worldProfile = profiles.find(p => !p.factionId);
  if (worldProfile?.trustLevel) {
    const trustLabels: Record<string, string> = {
      'distrusted': 'NPCs may hesitate before trusting',
      'cautious': 'NPCs approach with caution',
      'neutral': 'NPCs have no strong opinions',
      'trusted': 'NPCs generally trust their word',
      'respected': 'NPCs hold in high regard'
    };
    if (trustLabels[worldProfile.trustLevel]) {
      insights.push(trustLabels[worldProfile.trustLevel]);
    }
  }
  
  // Analyze behavioral tendencies
  if (worldProfile?.tendencies) {
    const tendencies = worldProfile.tendencies as Record<string, number>;
    if (tendencies.merciful_vs_ruthless !== undefined) {
      if (tendencies.merciful_vs_ruthless < 0.3) {
        insights.push('Shows mercy to enemies');
      } else if (tendencies.merciful_vs_ruthless > 0.7) {
        insights.push('Quick to use force');
      }
    }
    if (tendencies.selfless_vs_selfish !== undefined) {
      if (tendencies.selfless_vs_selfish < 0.3) {
        insights.push('Often puts others first');
      } else if (tendencies.selfless_vs_selfish > 0.7) {
        insights.push('Prioritizes self-interest');
      }
    }
  }
  
  // Recent patterns
  if (recentEvents.length > 0) {
    const recentTypes = recentEvents.slice(0, 3).map(e => e.triggerType);
    const typeCount: Record<string, number> = {};
    recentTypes.forEach(t => { typeCount[t] = (typeCount[t] || 0) + 1; });
    
    const dominantType = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0];
    if (dominantType && dominantType[1] >= 2) {
      const typeDescriptions: Record<string, string> = {
        'kept_promise': 'Pattern of keeping promises',
        'broken_trust': 'Has broken trust recently',
        'showed_mercy': 'Tends to show mercy',
        'used_force': 'Pattern of using force',
        'helped_stranger': 'Helps those in need',
        'betrayal': 'Recent acts of betrayal noted'
      };
      if (typeDescriptions[dominantType[0]]) {
        insights.push(typeDescriptions[dominantType[0]]);
      }
    }
  }
  
  if (insights.length === 0) {
    return `${characterName}'s reputation is still forming.`;
  }
  
  return insights.join('. ') + '.';
}

// PROCEDURAL QUEST GENERATION SYSTEM
// Evaluates quest triggers against current world state and generates quests when conditions are met
export async function evaluateProceduralQuestTriggers(
  campaignId: number,
  campaign: any,
  worldState: any[],
  npcAttitudes: any[],
  pressureMeters: any[],
  normativeResidues: any[],
  currentNarrative: string,
  storageRef: any
): Promise<void> {
  try {
    const config = campaign.proceduralQuestConfig;
    if (!config || !config.triggers || !config.templates) {
      return; // No procedural quest config
    }
    
    const { triggers, templates, globalSettings } = config;
    const currentSceneNumber = campaign.currentSession || 1;
    const lastQuestScene = campaign.lastProceduralQuestScene || 0;
    
    // Check minimum scene gap between procedural quests
    if (currentSceneNumber - lastQuestScene < (globalSettings?.minScenesBetweenQuests || 2)) {
      return;
    }
    
    // Check max active procedural quests
    const existingQuests = await storageRef.getCampaignQuests(campaignId);
    const activeProceduralQuests = existingQuests.filter((q: any) => 
      q.discoveredByAI && q.status === 'active' && q.discoveryContext?.includes('Procedural')
    );
    if (activeProceduralQuests.length >= (globalSettings?.maxActiveProceduralQuests || 3)) {
      return;
    }
    
    // Sort triggers by priority (higher first)
    const sortedTriggers = [...triggers].sort((a: any, b: any) => (b.priority || 1) - (a.priority || 1));
    
    for (const trigger of sortedTriggers) {
      // Check if trigger has hit max generations
      if (trigger.maxGenerations > 0 && (trigger.generationCount || 0) >= trigger.maxGenerations) {
        continue;
      }
      
      // Check cooldown
      const lastTriggeredScene = trigger.lastTriggeredScene || 0;
      if (currentSceneNumber - lastTriggeredScene < (trigger.cooldownScenes || 3)) {
        continue;
      }
      
      // Evaluate trigger condition
      const conditionMet = evaluateQuestTriggerCondition(
        trigger,
        worldState,
        npcAttitudes,
        pressureMeters,
        normativeResidues
      );
      
      if (!conditionMet) {
        continue;
      }
      
      // Apply chance modifier
      const chanceRoll = Math.random() * 100;
      if (chanceRoll > (globalSettings?.questChanceModifier || 70)) {
        continue;
      }
      
      // Find matching template
      const template = templates.find((t: any) => t.id === trigger.questTemplateId);
      if (!template) {
        console.warn(`Procedural quest trigger ${trigger.id} references unknown template ${trigger.questTemplateId}`);
        continue;
      }
      
      // Generate the quest from template
      const generatedQuest = instantiateQuestTemplate(
        template,
        campaign,
        worldState,
        npcAttitudes,
        currentNarrative
      );
      
      if (generatedQuest) {
        // Create the quest
        await storageRef.createCampaignQuest({
          campaignId,
          title: generatedQuest.title,
          description: generatedQuest.description,
          questType: "side",
          status: "active",
          objectives: generatedQuest.objectives,
          xpReward: generatedQuest.xpReward,
          goldReward: generatedQuest.goldReward,
          difficultyRating: template.difficulty || "moderate",
          estimatedDuration: template.estimatedDuration || "1 session",
          isPostedToBoard: true,
          postedAt: new Date().toISOString(),
          discoveredByAI: true,
          discoveryContext: `Procedural: ${trigger.id} triggered by world state`,
          questGiver: generatedQuest.questGiver || null,
          createdAt: new Date().toISOString(),
        });
        
        // Update trigger state
        trigger.generationCount = (trigger.generationCount || 0) + 1;
        trigger.lastTriggeredScene = currentSceneNumber;
        
        // Update campaign with modified triggers and last quest scene
        await storageRef.updateCampaign(campaignId, {
          proceduralQuestConfig: { ...config, triggers },
          lastProceduralQuestScene: currentSceneNumber,
          updatedAt: new Date().toISOString()
        });
        
        console.log(`PROCEDURAL QUEST GENERATED: "${generatedQuest.title}" from trigger ${trigger.id}`);
        
        // Only generate one quest per scene advancement
        break;
      }
    }
  } catch (error) {
    console.error("Error evaluating procedural quest triggers:", error);
    // Don't fail the main request
  }
}

export function evaluateQuestTriggerCondition(
  trigger: any,
  worldState: any[],
  npcAttitudes: any[],
  pressureMeters: any[],
  normativeResidues: any[]
): boolean {
  const { triggerType, condition } = trigger;
  if (!condition) return false;
  
  let currentValue: number | null = null;
  
  switch (triggerType) {
    case "state_threshold":
      const stateFact = worldState.find((s: any) => s.key === condition.stateKey);
      currentValue = stateFact?.value ?? null;
      break;
      
    case "npc_attitude":
      const npc = npcAttitudes.find((n: any) => n.name === condition.npcName);
      currentValue = npc?.attitude ?? null;
      break;
      
    case "pressure_meter":
      const meter = pressureMeters.find((m: any) => m.name === condition.meterName);
      currentValue = meter?.current ?? null;
      break;
      
    case "residue_level":
      const residue = normativeResidues.find((r: any) => r.id === condition.residueId);
      currentValue = residue?.severity ?? null;
      break;
      
    default:
      return false;
  }
  
  if (currentValue === null) return false;
  
  const threshold = condition.threshold;
  switch (condition.operator) {
    case ">=": return currentValue >= threshold;
    case "<=": return currentValue <= threshold;
    case ">": return currentValue > threshold;
    case "<": return currentValue < threshold;
    case "==": return currentValue === threshold;
    default: return false;
  }
}

export function instantiateQuestTemplate(
  template: any,
  campaign: any,
  worldState: any[],
  npcAttitudes: any[],
  currentNarrative: string
): { title: string; description: string; objectives: any[]; xpReward: number; goldReward: number; questGiver?: string } | null {
  try {
    // Extract context from campaign and narrative
    const location = campaign.startingLocation || "the area";
    const mainNPC = campaign.mainNPC || "a mysterious figure";
    const threat = extractThreatFromNarrative(currentNarrative) || "lurking danger";
    
    // Find an available NPC for quest giver (prefer neutral/friendly)
    const availableNPCs = npcAttitudes.filter((n: any) => n.attitude > -50);
    const questGiver = availableNPCs.length > 0 ? availableNPCs[0].name : mainNPC;
    
    // Pick a random title pattern and fill placeholders
    const titlePattern = template.titlePatterns[Math.floor(Math.random() * template.titlePatterns.length)];
    const title = fillPlaceholders(titlePattern, { NPC: questGiver, LOCATION: location, THREAT: threat });
    
    // Fill description pattern
    const description = fillPlaceholders(template.descriptionPattern, { 
      NPC: questGiver, 
      LOCATION: location, 
      THREAT: threat,
      CONTEXT: currentNarrative.slice(0, 100)
    });
    
    // Generate objectives from patterns
    const objectives = template.objectivePatterns.slice(0, 3).map((pattern: string, idx: number) => ({
      text: fillPlaceholders(pattern, { NPC: questGiver, LOCATION: location, THREAT: threat }),
      completed: false
    }));
    
    // Calculate rewards with some variance
    const xpVariance = Math.floor(Math.random() * 50) - 25;
    const goldVariance = Math.floor(Math.random() * 20) - 10;
    
    return {
      title,
      description,
      objectives,
      xpReward: Math.max(25, (template.rewards?.xpBase || 100) + xpVariance),
      goldReward: Math.max(10, (template.rewards?.goldBase || 50) + goldVariance),
      questGiver
    };
  } catch (error) {
    console.error("Error instantiating quest template:", error);
    return null;
  }
}

export function fillPlaceholders(template: string, context: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(context)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

export function extractThreatFromNarrative(narrative: string): string | null {
  const threatPatterns = [
    /(?:attacked by|threatened by|chased by|confronted by)\s+(?:a |an |the )?([^,.]+)/i,
    /(?:danger|threat|menace)\s+(?:of |from )?(?:a |an |the )?([^,.]+)/i,
    /(?:monsters?|creatures?|enemies?|bandits?|cultists?|undead|orcs?|goblins?)/i
  ];
  
  for (const pattern of threatPatterns) {
    const match = narrative.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }
  return null;
}

export async function updateReputationProfileFromEvent(
  characterId: number,
  campaignId: number,
  factionId: number | null,
  event: any
): Promise<void> {
  // Get or create the reputation profile
  let profile = await storage.getCharacterReputationProfile(characterId, factionId, campaignId);
  
  // Calculate pattern deltas based on trigger type
  const patternDeltas: Record<string, Record<string, number>> = {
    'kept_promise': { trust: 0.1, selfless_vs_selfish: -0.05 },
    'broken_trust': { trust: -0.2, selfless_vs_selfish: 0.1 },
    'showed_mercy': { merciful_vs_ruthless: -0.15 },
    'used_force': { merciful_vs_ruthless: 0.1, cautious_vs_reckless: 0.05 },
    'helped_stranger': { trust: 0.05, selfless_vs_selfish: -0.1 },
    'betrayal': { trust: -0.3, selfless_vs_selfish: 0.2 },
    'completed_quest': { trust: 0.05 },
    'abandoned_quest': { trust: -0.1 },
    'negotiated_peace': { merciful_vs_ruthless: -0.1, cautious_vs_reckless: -0.1 },
    'started_fight': { merciful_vs_ruthless: 0.1, cautious_vs_reckless: 0.1 }
  };
  
  const delta = patternDeltas[event.triggerType] || {};
  
  if (!profile) {
    // Create new profile
    const tendencies: Record<string, number> = {
      cautious_vs_reckless: 0.5,
      merciful_vs_ruthless: 0.5,
      selfless_vs_selfish: 0.5
    };
    
    // Apply delta
    Object.entries(delta).forEach(([key, value]) => {
      if (key !== 'trust' && tendencies[key] !== undefined) {
        tendencies[key] = Math.max(0, Math.min(1, tendencies[key] + value));
      }
    });
    
    await storage.createCharacterReputationProfile({
      characterId,
      campaignId,
      factionId,
      trustLevel: delta.trust ? (delta.trust > 0 ? 'neutral' : 'cautious') : 'unknown',
      tendencies,
      notableDeeds: [{ deed: event.narrativeSummary, impact: delta.trust && delta.trust > 0 ? 'positive' : 'neutral', timestamp: new Date().toISOString() }],
      lastEventId: event.id
    });
  } else {
    // Update existing profile
    const currentTendencies = (profile.tendencies as Record<string, number>) || {
      cautious_vs_reckless: 0.5,
      merciful_vs_ruthless: 0.5,
      selfless_vs_selfish: 0.5
    };
    
    // Apply delta with diminishing returns
    Object.entries(delta).forEach(([key, value]) => {
      if (key !== 'trust' && currentTendencies[key] !== undefined) {
        currentTendencies[key] = Math.max(0, Math.min(1, currentTendencies[key] + value * 0.8));
      }
    });
    
    // Update trust level based on accumulated trust changes
    let newTrustLevel = profile.trustLevel;
    if (delta.trust) {
      const trustLevels = ['distrusted', 'cautious', 'unknown', 'neutral', 'trusted', 'respected'];
      const currentIdx = trustLevels.indexOf(profile.trustLevel || 'unknown');
      const newIdx = Math.max(0, Math.min(trustLevels.length - 1, currentIdx + Math.sign(delta.trust)));
      newTrustLevel = trustLevels[newIdx];
    }
    
    // Add to notable deeds if significant
    const notableDeeds = (profile.notableDeeds as any[]) || [];
    if (event.significance === 'major' || event.significance === 'defining') {
      notableDeeds.push({
        deed: event.narrativeSummary,
        impact: delta.trust && delta.trust > 0 ? 'positive' : delta.trust && delta.trust < 0 ? 'negative' : 'neutral',
        timestamp: new Date().toISOString()
      });
    }
    
    await storage.updateCharacterReputationProfile(profile.id, {
      tendencies: currentTendencies,
      trustLevel: newTrustLevel,
      notableDeeds: notableDeeds.slice(-10), // Keep last 10
      lastEventId: event.id
    });
  }
  
  // Mark the event as processed
  await storage.markReputationEventProcessed(event.id);
}

// === City Map & Trek Helpers ===

export interface CityBuilding {
  id: string;
  name: string;
  type: string;
  description: string;
  x: number;
  y: number;
  size: number;
  district: string;
  services: string[];
  npcHint?: string;
}

export interface CityDistrict {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CityLayout {
  districts: CityDistrict[];
  buildings: CityBuilding[];
  gates: Array<{ id: string; name: string; x: number; y: number; direction: string }>;
  size: string;
}

export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function generateCityLayout(locationName: string, locationType: string, seed: number): CityLayout {
  const rng = seededRandom(seed);
  
  const sizeMap: Record<string, { districts: number; buildings: number; size: string }> = {
    city: { districts: 4, buildings: 12, size: "large" },
    town: { districts: 3, buildings: 8, size: "medium" },
    village: { districts: 2, buildings: 5, size: "small" },
    landmark: { districts: 1, buildings: 3, size: "tiny" },
    ruins: { districts: 1, buildings: 4, size: "small" },
    dungeon: { districts: 1, buildings: 2, size: "tiny" },
  };
  
  const config = sizeMap[locationType] || sizeMap.town;
  
  const districtTemplates = [
    { name: "Market Quarter", desc: "Bustling streets lined with merchant stalls and the aroma of exotic spices." },
    { name: "Temple District", desc: "Sacred grounds where clergy tend to the spiritual needs of the populace." },
    { name: "Docks Ward", desc: "The waterfront area where sailors and traders come ashore." },
    { name: "Noble Quarter", desc: "Grand estates and manicured gardens of the city's elite." },
    { name: "Artisan Row", desc: "Workshops and forges fill the air with the sounds of craftsmanship." },
    { name: "Old Town", desc: "Ancient cobblestone streets wind through the oldest part of the settlement." },
  ];
  
  const buildingTemplates: Array<{ name: string; type: string; desc: string; services: string[]; npc: string }> = [
    { name: "The Hearth & Flagon", type: "tavern", desc: "A warm tavern where adventurers gather to share tales.", services: ["rest", "rumors", "food"], npc: "A gregarious barkeep" },
    { name: "Iron Anvil Smithy", type: "blacksmith", desc: "Sparks fly as weapons and armor are forged.", services: ["weapons", "armor", "repair"], npc: "A burly smith" },
    { name: "Arcane Emporium", type: "magic_shop", desc: "Shelves lined with potions, scrolls, and mysterious artifacts.", services: ["potions", "scrolls", "identify"], npc: "A mysterious enchantress" },
    { name: "General Goods", type: "general_store", desc: "Everything an adventurer needs for the road ahead.", services: ["supplies", "gear", "trade"], npc: "A friendly merchant" },
    { name: "Temple of Light", type: "temple", desc: "A serene sanctuary offering healing and divine guidance.", services: ["healing", "blessings", "cure_disease"], npc: "A devoted cleric" },
    { name: "Guild Hall", type: "guild", desc: "The headquarters of the local adventurers' guild.", services: ["quests", "bounties", "training"], npc: "A veteran guild master" },
    { name: "The Sage's Library", type: "library", desc: "Ancient tomes and scrolls contain forgotten knowledge.", services: ["lore", "research", "maps"], npc: "An aged scholar" },
    { name: "Stables", type: "stables", desc: "Mounts and pack animals for those journeying beyond the walls.", services: ["mounts", "storage", "travel"], npc: "A weathered stablehand" },
    { name: "City Watch Barracks", type: "barracks", desc: "Guards maintain order from this fortified building.", services: ["bounties", "protection", "information"], npc: "A stern captain" },
    { name: "Apothecary", type: "apothecary", desc: "Herbs and remedies for all manner of ailments.", services: ["potions", "herbs", "antidotes"], npc: "A wise herbalist" },
    { name: "Jeweler's Workshop", type: "jeweler", desc: "Precious gems and fine jewelry gleam in the lamplight.", services: ["gems", "appraise", "enchant"], npc: "A meticulous jeweler" },
    { name: "Arena", type: "arena", desc: "Warriors test their mettle in organized combat.", services: ["combat", "training", "wagers"], npc: "An arena champion" },
    { name: "Thieves' Den", type: "underworld", desc: "A hidden meeting place known only to the shady few.", services: ["rumors", "lockpicks", "fences"], npc: "A shadowy figure" },
    { name: "Cartographer", type: "cartographer", desc: "Detailed maps of the known world cover every wall.", services: ["maps", "exploration", "navigation"], npc: "A traveling cartographer" },
  ];
  
  // Shuffle templates
  const shuffledDistricts = [...districtTemplates].sort(() => rng() - 0.5);
  const shuffledBuildings = [...buildingTemplates].sort(() => rng() - 0.5);
  
  const districts: CityDistrict[] = [];
  for (let i = 0; i < config.districts; i++) {
    const template = shuffledDistricts[i % shuffledDistricts.length];
    const cols = Math.ceil(Math.sqrt(config.districts));
    const col = i % cols;
    const row = Math.floor(i / cols);
    districts.push({
      id: `district-${i}`,
      name: template.name,
      description: template.desc,
      x: col * 250 + Math.floor(rng() * 30),
      y: row * 250 + Math.floor(rng() * 30),
      width: 220 + Math.floor(rng() * 40),
      height: 220 + Math.floor(rng() * 40),
    });
  }
  
  const buildings: CityBuilding[] = [];
  for (let i = 0; i < config.buildings; i++) {
    const template = shuffledBuildings[i % shuffledBuildings.length];
    const district = districts[i % districts.length];
    buildings.push({
      id: `building-${i}`,
      name: template.name,
      type: template.type,
      description: template.desc,
      x: district.x + 20 + Math.floor(rng() * (district.width - 60)),
      y: district.y + 20 + Math.floor(rng() * (district.height - 60)),
      size: 30 + Math.floor(rng() * 20),
      district: district.id,
      services: template.services,
      npcHint: template.npc,
    });
  }
  
  const gateDirections = ["north", "south", "east", "west"];
  const gates = gateDirections.slice(0, config.districts > 2 ? 4 : 2).map((dir, i) => ({
    id: `gate-${i}`,
    name: `${dir.charAt(0).toUpperCase() + dir.slice(1)} Gate`,
    x: dir === "east" ? 480 : dir === "west" ? 20 : 250,
    y: dir === "south" ? 480 : dir === "north" ? 20 : 250,
    direction: dir,
  }));
  
  return { districts, buildings, gates, size: config.size };
}

export function generateCapitalCityLayout(locationName: string, seed: number): CityLayout {
  const rng = seededRandom(seed);

  const capitalDistricts = [
    { name: "Royal Quarter", desc: "Towering spires and marble halls house the seat of power. Nobles stroll through manicured gardens under the watchful eyes of the Royal Guard." },
    { name: "Grand Market", desc: "The commercial heart of the realm. Hundreds of stalls, shops, and warehouses line cobblestone streets buzzing with trade from every corner of the world." },
    { name: "Temple Row", desc: "A sacred avenue lined with temples to every deity. Incense drifts through the air, and pilgrims seek blessings at towering shrines." },
    { name: "Thieves' Quarter", desc: "Narrow alleys wind between leaning buildings. What happens here stays here — for a price. The Shadow Guild runs everything from the rooftops." },
    { name: "Harbor Ward", desc: "Ships from distant lands crowd the docks. Sailors, fishmongers, and smugglers mingle in seaside taverns reeking of brine and opportunity." },
    { name: "Artisan Heights", desc: "Master craftsmen maintain prestigious workshops here. The ring of hammers and hum of enchantment echo through wide, clean streets." },
    { name: "Scholar's Enclave", desc: "The great university and its surrounding libraries dominate this quiet district. Knowledge-seekers and mages study ancient texts behind ivy-covered walls." },
    { name: "Old City", desc: "The original settlement, now a maze of ancient tunnels, crumbling walls, and stubborn residents who refuse to leave. History seeps from every stone." },
  ];

  const capitalBuildings: Array<{ name: string; type: string; desc: string; services: string[]; npc: string; district: string }> = [
    // Royal Quarter
    { name: "The Royal Palace", type: "palace", desc: "The grand seat of the realm's sovereign. Petitioners gather in the great hall seeking audience.", services: ["audience", "decrees", "political_favors"], npc: "The Royal Steward", district: "Royal Quarter" },
    { name: "Royal Bank of the Realm", type: "bank", desc: "A fortified institution where the realm's wealth is stored. Vaults descend deep underground.", services: ["deposit", "withdraw", "loans", "interest"], npc: "The Head Banker, a meticulous gnome", district: "Royal Quarter" },
    { name: "Crown Estates Office", type: "real_estate", desc: "Properties throughout the capital can be purchased or rented here, from modest apartments to noble manors.", services: ["buy_house", "sell_house", "rent", "upgrades"], npc: "A shrewd halfling estate agent", district: "Royal Quarter" },
    { name: "Royal Guard Barracks", type: "barracks", desc: "The elite soldiers who protect the crown train and muster here.", services: ["bounties", "protection", "military_contracts"], npc: "Captain of the Royal Guard", district: "Royal Quarter" },
    // Grand Market
    { name: "The Golden Bazaar", type: "general_store", desc: "The largest general store in the realm. If it exists, they sell it.", services: ["supplies", "gear", "exotic_goods", "trade"], npc: "A boisterous merchant prince", district: "Grand Market" },
    { name: "Enchanted Armory", type: "magic_shop", desc: "Rare magical weapons and armor displayed behind shimmering wards. Prices match the quality.", services: ["magic_weapons", "magic_armor", "enchanting", "identify"], npc: "An elven arcane smith", district: "Grand Market" },
    { name: "Potioneer's Paradise", type: "apothecary", desc: "Walls lined with bubbling vials and exotic ingredients. Custom brews available on request.", services: ["potions", "herbs", "custom_brews", "antidotes"], npc: "A tiefling alchemist", district: "Grand Market" },
    { name: "Curiosities & Wonders", type: "jeweler", desc: "Gemstones, enchanted trinkets, and mysterious artifacts from distant lands.", services: ["gems", "appraise", "enchant", "rare_items"], npc: "A drow collector", district: "Grand Market" },
    { name: "The Auction House", type: "auction", desc: "Rare items and estate treasures go under the hammer weekly. Fortunes change hands in moments.", services: ["auctions", "consignment", "rare_trades"], npc: "A theatrical auctioneer", district: "Grand Market" },
    // Temple Row
    { name: "Cathedral of the Dawn", type: "temple", desc: "The grandest temple in the city, its stained glass catching the first light of every sunrise.", services: ["healing", "blessings", "resurrection", "divine_guidance"], npc: "The High Priestess", district: "Temple Row" },
    { name: "Shrine of Shadows", type: "dark_temple", desc: "A discreet temple where followers of less conventional deities come to pray — or bargain.", services: ["dark_blessings", "curses", "forbidden_knowledge"], npc: "A hooded acolyte", district: "Temple Row" },
    // Thieves' Quarter
    { name: "The Velvet Dagger", type: "tavern", desc: "A dimly-lit establishment where information is the most valuable currency. Ask for the 'special menu.'", services: ["rumors", "black_market", "assassin_contracts", "fences"], npc: "A one-eyed barkeep who sees everything", district: "Thieves' Quarter" },
    { name: "Shadow Guild Hall", type: "underworld", desc: "The headquarters of the city's organized crime. Membership has its privileges — and its costs.", services: ["theft_contracts", "smuggling", "lockpicks", "disguises"], npc: "The Guildmaster (identity unknown)", district: "Thieves' Quarter" },
    { name: "The Whispering Wall", type: "information_broker", desc: "A nondescript wall where coded messages are exchanged. The city's secrets flow through here.", services: ["intelligence", "blackmail", "espionage", "rumors"], npc: "Nobody visible — messages appear overnight", district: "Thieves' Quarter" },
    // Harbor Ward
    { name: "The Salty Anchor", type: "tavern", desc: "The roughest tavern on the waterfront. Sailors arm-wrestle for drinks and captains recruit crew.", services: ["rest", "rumors", "recruitment", "sea_passage"], npc: "A retired pirate captain", district: "Harbor Ward" },
    { name: "Harbormaster's Office", type: "guild", desc: "All ships entering port register here. Trade routes, cargo manifests, and travel arrangements.", services: ["travel", "shipping", "trade_routes", "cargo"], npc: "A stern harbormaster", district: "Harbor Ward" },
    // Artisan Heights
    { name: "Masterwork Forge", type: "blacksmith", desc: "The finest weapons and armor in the realm are crafted here by guild-certified masters.", services: ["masterwork_weapons", "masterwork_armor", "repair", "custom_orders"], npc: "A dwarven master smith", district: "Artisan Heights" },
    { name: "The Gilded Needle", type: "tailor", desc: "Fine clothing and enchanted garments for nobility and adventurers who want to look the part.", services: ["clothing", "disguise_kits", "enchanted_garments"], npc: "A fashionable half-elf designer", district: "Artisan Heights" },
    // Scholar's Enclave
    { name: "The Grand Library", type: "library", desc: "The largest repository of knowledge in the realm. Restricted sections require special clearance.", services: ["lore", "research", "restricted_archives", "spell_scrolls"], npc: "The Head Librarian, an ancient elf", district: "Scholar's Enclave" },
    { name: "Arcane University", type: "academy", desc: "Where aspiring wizards study the arcane arts. The faculty offers specialized training.", services: ["training", "spell_research", "arcane_consulting"], npc: "The Archmage Provost", district: "Scholar's Enclave" },
    // Old City
    { name: "The Ratskeller", type: "tavern", desc: "A centuries-old tavern in the basement of a crumbling tower. The regulars have stories older than the walls.", services: ["rest", "rumors", "underground_access", "food"], npc: "An ageless gnome barkeep", district: "Old City" },
    { name: "Undercity Entrance", type: "dungeon_entrance", desc: "A gated passage leading to the old sewers and catacombs beneath the city. Monsters lurk below.", services: ["dungeon_access", "treasure_rumors", "monster_bounties"], npc: "A scarred veteran dungeon guide", district: "Old City" },
    { name: "Stables of the Sun", type: "stables", desc: "The largest stable complex in the capital. Exotic mounts and swift horses available.", services: ["mounts", "exotic_mounts", "storage", "fast_travel"], npc: "A centaur stablemaster", district: "Old City" },
  ];

  // Layout districts in a larger grid
  const districts: CityDistrict[] = capitalDistricts.map((d, i) => {
    const cols = 3;
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      id: `district-${i}`,
      name: d.name,
      description: d.desc,
      x: col * 320 + Math.floor(rng() * 20),
      y: row * 320 + Math.floor(rng() * 20),
      width: 300 + Math.floor(rng() * 30),
      height: 300 + Math.floor(rng() * 30),
    };
  });

  // Place buildings in their named districts
  const buildings: CityBuilding[] = capitalBuildings.map((b, i) => {
    const districtIndex = capitalDistricts.findIndex(d => d.name === b.district);
    const district = districts[districtIndex >= 0 ? districtIndex : 0];
    return {
      id: `building-${i}`,
      name: b.name,
      type: b.type,
      description: b.desc,
      x: district.x + 20 + Math.floor(rng() * (district.width - 60)),
      y: district.y + 20 + Math.floor(rng() * (district.height - 60)),
      size: 35 + Math.floor(rng() * 15),
      district: district.id,
      services: b.services,
      npcHint: b.npc,
    };
  });

  // Streets connecting districts
  const streets = [
    { name: "King's Road", from: "Royal Quarter", to: "Grand Market" },
    { name: "Pilgrim's Way", from: "Grand Market", to: "Temple Row" },
    { name: "Shadowgate Lane", from: "Grand Market", to: "Thieves' Quarter" },
    { name: "Wharf Street", from: "Thieves' Quarter", to: "Harbor Ward" },
    { name: "Artisan's Promenade", from: "Grand Market", to: "Artisan Heights" },
    { name: "Scholar's Walk", from: "Artisan Heights", to: "Scholar's Enclave" },
    { name: "Ancient Way", from: "Old City", to: "Royal Quarter" },
    { name: "Market Bridge", from: "Harbor Ward", to: "Grand Market" },
  ].map((s, i) => ({
    id: `street-${i}`,
    name: s.name,
    fromDistrict: s.from,
    toDistrict: s.to,
  }));

  const gates = [
    { id: "gate-0", name: "North Gate — King's Highway", x: 480, y: 20, direction: "north" },
    { id: "gate-1", name: "South Gate — Old Road", x: 480, y: 960, direction: "south" },
    { id: "gate-2", name: "East Gate — Harbor Entrance", x: 960, y: 480, direction: "east" },
    { id: "gate-3", name: "West Gate — Pilgrim's Gate", x: 20, y: 480, direction: "west" },
  ];

  return { districts, buildings, gates, streets, size: "capital" } as CityLayout;
}

export function computeTrekPath(startQ: number, startR: number, endQ: number, endR: number): Array<{ q: number; r: number }> {
  const path: Array<{ q: number; r: number }> = [{ q: startQ, r: startR }];
  let cq = startQ;
  let cr = startR;
  const maxSteps = Math.abs(endQ - startQ) + Math.abs(endR - startR) + 20;
  
  for (let i = 0; i < maxSteps && (cq !== endQ || cr !== endR); i++) {
    const dq = endQ - cq;
    const dr = endR - cr;
    
    if (Math.abs(dq) >= Math.abs(dr)) {
      cq += dq > 0 ? 1 : -1;
      if (Math.abs(dr) > 0 && i % 2 === 0) {
        cr += dr > 0 ? 1 : -1;
      }
    } else {
      cr += dr > 0 ? 1 : -1;
      if (Math.abs(dq) > 0 && i % 2 === 0) {
        cq += dq > 0 ? 1 : -1;
      }
    }
    
    path.push({ q: cq, r: cr });
  }
  
  return path;
}

export async function generateLocationQuests(campaignId: number, location: any, layout: CityLayout) {
  const questTemplates: Array<{ title: string; desc: string; type: string; xp: number; gold: number }> = [];
  
  const hasGuild = layout.buildings.some(b => b.type === "guild");
  const hasTavern = layout.buildings.some(b => b.type === "tavern");
  const hasTemple = layout.buildings.some(b => b.type === "temple");
  const hasUnderworld = layout.buildings.some(b => b.type === "underworld");
  
  if (hasGuild) {
    questTemplates.push({
      title: `${location.name} Guild Contract`,
      desc: `The adventurers' guild in ${location.name} seeks brave souls to handle a dangerous situation in the surrounding area.`,
      type: "combat",
      xp: 200,
      gold: 50,
    });
  }
  
  if (hasTavern) {
    questTemplates.push({
      title: `Rumors at the Hearth`,
      desc: `A mysterious stranger at the tavern speaks of a hidden treasure near ${location.name}. The tale seems too good to be true, but the rewards could be extraordinary.`,
      type: "exploration",
      xp: 150,
      gold: 75,
    });
  }
  
  if (hasTemple) {
    questTemplates.push({
      title: `Sacred Relic Recovery`,
      desc: `The temple clergy beseech you to recover a sacred relic stolen from their sanctum. Dark forces are at work.`,
      type: "side",
      xp: 175,
      gold: 40,
    });
  }
  
  if (hasUnderworld) {
    questTemplates.push({
      title: `Shadow Network`,
      desc: `The underground contacts in ${location.name} offer lucrative work—for those willing to bend the rules.`,
      type: "side",
      xp: 125,
      gold: 100,
    });
  }
  
  // Capital-specific political intrigue quests
  const hasPalace = layout.buildings.some(b => b.type === "palace");
  const hasBank = layout.buildings.some(b => b.type === "bank");
  const hasInfoBroker = layout.buildings.some(b => b.type === "information_broker");
  const hasAuction = layout.buildings.some(b => b.type === "auction");
  const hasDarkTemple = layout.buildings.some(b => b.type === "dark_temple");
  const hasDungeonEntrance = layout.buildings.some(b => b.type === "dungeon_entrance");
  const hasAcademy = layout.buildings.some(b => b.type === "academy");

  if (hasPalace) {
    questTemplates.push({
      title: "A Court in Turmoil",
      desc: "Whispers of conspiracy echo through the Royal Palace. A noble faction plots to undermine the crown. An audience with the Royal Steward could reveal who can be trusted.",
      type: "side",
      xp: 350,
      gold: 200,
    });
    questTemplates.push({
      title: "The King's Errand",
      desc: "The Royal Guard has posted a discreet bounty — a diplomat has gone missing in the Thieves' Quarter, and the crown needs them found before a treaty collapses.",
      type: "side",
      xp: 400,
      gold: 250,
    });
  }

  if (hasInfoBroker) {
    questTemplates.push({
      title: "Threads of the Web",
      desc: "Coded messages on the Whispering Wall point to a smuggling ring operating from the Harbor. Unravel the network before the next shipment arrives at dawn.",
      type: "side",
      xp: 300,
      gold: 175,
    });
  }

  if (hasAuction) {
    questTemplates.push({
      title: "The Stolen Heirloom",
      desc: "A suspiciously rare artifact has appeared at the Auction House. Its true owner — a powerful mage — wants it recovered before it sells, and they're willing to pay handsomely.",
      type: "side",
      xp: 250,
      gold: 300,
    });
  }

  if (hasDarkTemple) {
    questTemplates.push({
      title: "Pact of Shadows",
      desc: "The Shrine of Shadows seeks a willing soul to retrieve a forbidden text from the Old City catacombs. The reward defies mortal currency — the price may be equally unusual.",
      type: "side",
      xp: 500,
      gold: 100,
    });
  }

  if (hasDungeonEntrance) {
    questTemplates.push({
      title: "Depths of the Undercity",
      desc: "Something stirs in the ancient catacombs beneath the Old City. The dungeon guide offers his services — for a share of whatever treasure lies within.",
      type: "combat",
      xp: 450,
      gold: 150,
    });
  }

  if (hasAcademy) {
    questTemplates.push({
      title: "The Archmage's Test",
      desc: "The Arcane University extends a rare invitation: prove your worth through a series of magical trials, and gain access to spells and knowledge unavailable anywhere else.",
      type: "side",
      xp: 350,
      gold: 50,
    });
  }

  if (hasBank) {
    questTemplates.push({
      title: "Vault Breach Investigation",
      desc: "The Royal Bank has suffered an impossible theft — gold vanished from a sealed vault. The Head Banker suspects an inside job and offers a generous finder's fee.",
      type: "side",
      xp: 300,
      gold: 400,
    });
  }

  // Always add a generic exploration quest
  questTemplates.push({
    title: `Explore ${location.name}`,
    desc: `Discover the secrets and hidden corners of ${location.name}. Visit every district and uncover what lies within.`,
    type: "exploration",
    xp: 100,
    gold: 25,
  });
  
  // Check for existing quests at this location to avoid duplicates
  const existingQuests = await storage.getCampaignQuests(campaignId);
  const existingTitles = new Set(existingQuests.map(q => q.title));
  
  for (const template of questTemplates) {
    if (existingTitles.has(template.title)) continue;
    
    await storage.createCampaignQuest({
      campaignId,
      title: template.title,
      description: template.desc,
      questType: template.type,
      status: "active",
      objectives: [{ text: template.desc, completed: false }],
      xpReward: template.xp,
      goldReward: template.gold,
      isPostedToBoard: true,
      postedAt: new Date().toISOString(),
      discoveredByAI: false,
      discoveryContext: `Posted at ${location.name} quest board`,
      locationContext: location.name,
    });
  }
}
