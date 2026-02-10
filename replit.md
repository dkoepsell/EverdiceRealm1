# Everdice - Fantasy RPG Companion

## Overview
Everdice is an AI-enhanced full-stack web application for tabletop RPGs, leveraging D&D 5th Edition SRD 5.1 rules. It offers character creation, campaign management, dice rolling, and AI-powered storytelling tools. The platform aims to make TTRPGs accessible to new players and provide advanced features for experienced players and Game Masters, integrating a React frontend with an Express.js backend. The project focuses on an immersive, user-friendly, and legally compliant environment for D&D 5th Edition.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a welcoming landing page with clear calls to action, simplified navigation, and a quick start wizard. Visuals include warm amber/orange accents, gradient headers, improved card designs, and consistent visual hierarchies. The Dashboard, DM Toolkit, and Live Manager feature redesigned hero sections, D&D-inspired decorative icons, and streamlined, narrative-first layouts. The Live Manager offers a complete UX redesign focused on a clear DM workflow. The Hearth system provides a persistent social hub with personalized greetings and interactive elements.

### Technical Implementations
Everdice uses a React frontend with TypeScript, Wouter for routing, TanStack React Query for state management, shadcn/ui (Radix UI) for components, and Tailwind CSS for styling. The backend is an Express.js application (TypeScript) with Drizzle ORM for PostgreSQL (Neon serverless). Authentication uses Passport.js, and real-time features use WebSockets. AI integration is powered by OpenAI GPT-4o for dynamic story/character assistance and DALL-E 3 for portrait generation.

### Feature Specifications
Core features include user and character management, a campaign system with AI-generated storylines, session tracking, and a procedural exploration map system. The exploration system uses narrative-aware hex maps with HexMetaV2 metadata, generating hexes dynamically based on AI narrative mentions and directional hints. A World Map system tracks user exploration with a persistent shared world. The dice rolling engine supports standard RPG dice with real-time WebSocket communication.

**Persistent Shared World System**: The world of Everdice is a living, shared world where every campaign's choices generate world events that affect all campaigns. Key components:
- `worldEvents` table: Stores cross-campaign events generated from stake thresholds, adventure completions, critical rolls, and narrative milestones. Events carry pressure effects (instability, danger, opportunity, mystery) that shift regional gradients.
- `worldDiscoveries` table: Aggregates exploration hex discoveries from all campaigns into a shared map layer, showing what the community has found.
- `worldWhispers` table: Notifications to active campaigns in affected regions when world events fire, so DMs can weave consequences into their narratives.
- World Event Engine (`server/lib/worldEventEngine.ts`): Scans campaigns for triggering conditions — stake thresholds hit, campaigns completed, natural 20 rolls, narrative keywords (war, dragon, treaty, ruins) — and generates themed world events with mechanical pressure effects.
- The World Map page displays interactive region markers with hover tooltips showing pressure bars, discovery counts, and active event indicators. A tabbed side panel offers Regions, Events, and Discoveries views. A World Events Chronicle section below the map shows recent events in a card grid.

AI-powered features extend to campaign generation, dynamic narrative, character backgrounds, and DM assistance, focusing on exploration, discovery, mystery, and social encounters. The DM Toolkit includes generators for NPCs, locations, quests, and monsters, plus an invitation system and Discord integration. The DM Trust System (Live Manager) provides DMs with control over AI suggestions and game flow via a control bar, event queue, AI whisper panel, session modes, and checkpointing. It also includes a DM Dice Roller, Initiative Tracker, and Roll Queue. Public rolls display dramatically in the Current Scene area. An SRD Library integrates open5e.com content.

Discord integration allows playing campaigns via slash commands. A Campaign Dashboard provides DMs with AI-powered narrative insights. The Hearth system facilitates player interaction, and the Tavern system offers between-campaign activities. The Trading Post is a community marketplace for sharing adventures and homebrew content with star ratings, auto-generated cover art, one-click CAML import, and a trending section. It also supports player-to-player item trading with inventory integration.

The dynamic economy engine (`server/economyEngine.ts`) implements market-aware pricing based on demand, gold inflation, hourly demand decay, and real-time trend indicators. Tavern Liar's Dice is rebalanced with asymmetric dice split and binomial probability-based payouts.

AI-Discovered Side Quests are short, thematic quests generated naturally by AI during gameplay, posted to the Quest Board with CAML 2.0 compatible objectives. CAML 2.0 (Canonical Adventure Markup Language) provides an ontological framework for adventures. The World Deterioration System includes global stakes tracks, unreliable NPCs, and foreclosures. The Normative Residue system tracks lasting consequences from player choices, with repair pathways. Scene Schema v2 ensures varied gameplay. RPG systems include automatic XP and skill progression, D&D combat, rest mechanics, inventory, death saving throws, and a structured quest system. A comprehensive Spell Book System integrates D&D 5e spellcasting.

**DM Authoring Doctrine**: A stakes-driven campaign system where every choice has consequences. Schema fields: `campaignQuestion`, `campaignStakes`, `chapterGates`, `narrativeLog`. AI prompt enforces "no free actions, combat as consequence." Chapter advancement uses meaning-based gates. `improviseDoctrine()` auto-generates doctrine fields. Passive Stake Drift automatically degrades or escalates stakes. Threshold Consequences define events when stakes hit floor or ceiling. AI Prompt Doctrine Rules: "Victory Is Incomplete," "NPCs Are Agents," "Processes Create New Problems."

**Anti-Repetition & Narrative Pacing System** (Feb 2026): Three prompt-injection systems prevent repetitive AI content and ensure story progression:
1. *Scene History Digest*: Extracts last 5-8 session titles, locations, scene types, and narrative motifs (via regex extraction with 60+ tracked keywords). Injects "DO NOT REPEAT" lists into the AI prompt. Narrative text capped at 500 chars/session, motif lists capped at 10-15 items for token budget.
2. *CAML Story Spine*: Injects a "narrative compass" showing campaign question, current chapter objective (gate condition), completed milestones, and upcoming arc foreshadowing. Content Variety Rules require every scene to introduce at least one new element (NPC, location, challenge type, or narrative motif).
3. *Chapter Progression Nudging*: After 5 scenes in the same chapter → gentle nudge. After 8 → moderate urgency ("converge within 2-3 scenes"). After 11 → urgent ("resolve NOW"). Scene count estimated by proportional chapter distribution. Applied in both advance-story routes (simple and authenticated).

**Campaign Completion System (Forked Endings)**: Campaigns have defined chapter structures. Final chapter detection triggers AI finale prompts offering 3-4 choices representing different answers to the campaign question, reflecting accumulated consequences. Completion is triggered by `isCampaignFinale: true`, records `endingType`, `stakesSummary`, and `campaignQuestion`, and marks the campaign as completed.

**Session 1 Retention Contract**: A system ensuring first-session players form character identity through three pillars: (1) Interpretive Growth — AI shows trajectory not stats ("you notice your grip is steadier"), (2) Tool Competence Arcs — a simple tool assigned early is narrated from clumsy → learning → competent, (3) Deferred Consequences — unresolved hooks planted that surface later. Tracking lives in `storyState.session1Retention` (no schema changes). At 7+ scenes, "The Quiet Reckoning" triggers: a 5-paragraph AI-generated reflective ending acknowledging growth, tool mastery, unresolved threads, a frozen moment, and a return promise. Frontend displays as a styled dialog with growth/unresolved summary cards.

**Post-Combat Rewards Engine** (`server/postCombatRewards.ts`): Automatically generates loot, gold, XP bonuses, and chapter advancement when combat ends in victory. Boss detection uses CR thresholds, solo enemy heuristics, named creature keywords, and explicit `type: 'boss'` flags. CR-scaled gold tables and 5-tier loot tables (common through legendary, 30+ items) generate level-appropriate rewards. Victory tiers (minor/standard/major/epic) scale item drop counts. Boss fights award 1.5x XP and 2.5x gold, with guaranteed loot drops (1-4 items). Boss defeats at major/epic tier trigger chapter advancement (persisted to campaign). The frontend displays rewards in a styled panel within the combat log dialog, with rarity-coded item cards and XP/gold summary. Rewards are only granted on confirmed victory (all enemies defeated), not retreat/disengage.

The Crafting System in the tavern workshop offers 25+ recipes for weapons, armor, potions, and ammunition, with required skills, tools, gold cost, and a crafting DC. The Expanded SRD Shop features 80+ items with accurate D&D 5e SRD pricing and dynamic pricing. The Player Market allows players to list any inventory item for sale.

**Wander Mode (Free-Explore)** (`server/wanderEngine.ts`, `server/wanderRoutes.ts`, `client/src/pages/wander.tsx`): A low-pressure hex exploration mode ("Wander the Wilds") where players move across the map, discover points of interest, and trigger light narrative moments. Features curated outcome tables for 11 biomes (89+ entries), danger rating calculator based on biome/fatigue/proximity/level, weighted outcome roller (Discovery 45%, Quiet 25%, Risk 20%, Nothing 10%), investigation micro-scenes, map markers (landmark/trace/hazard/resource/npc_echo/opportunity), and a time-tick/fatigue system. Designed for 2-10 minute micro-play sessions. REST API: start/move/choose/end plus marker and hex state queries. Routes at `/wander`.

**Delve Mode (Dungeon Crawl)** (`server/delveEngine.ts`, `server/delveRoutes.ts`, `client/src/pages/delve.tsx`): A contained hex-dungeon experience ("Enter the Depths") with fog of war, tactical fights, traps, puzzles, and boss encounters. Includes an authored "Goblin Warren" dungeon (17 nodes: entrance, 4 encounters, 3 traps, 2 puzzles, 2 lore, 1 cache, 1 safe room, 1 boss, 1 chest). Features resource pressure (light ticks, supplies), retreat with consequences (enemy respawn, boss advantage), chest reward system (3 choices: safe/risk/knowledge), and post-run rating (novice/adventurer/veteran/master). Designed for 10-30 minute sessions. REST API: dungeons/start/move/action/chest/rest/retreat/end plus run state queries. Routes at `/delve`.

## External Dependencies

### Core
- **@neondatabase/serverless**: PostgreSQL connection
- **drizzle-orm**: Database ORM
- **express**: Web application framework
- **passport**: Authentication middleware
- **ws**: WebSocket implementation
- **openai**: AI integration
- **js-yaml**: YAML parsing for CAML adventure files

### Frontend
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: UI component primitives
- **wouter**: React router
- **framer-motion**: Animation library
- **tailwindcss**: CSS framework