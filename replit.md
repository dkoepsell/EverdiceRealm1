# Everdice - Fantasy RPG Companion

## Overview
Everdice is an AI-enhanced full-stack web application for tabletop RPGs, primarily D&D 5th Edition. It offers tools for character creation, campaign management, dice rolling, and AI-powered storytelling, aiming to provide an immersive, user-friendly, and legally compliant environment. The platform enhances accessibility for new players while offering advanced features for experienced players and Game Masters through intelligent automation and dynamic content generation.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a welcoming landing page, streamlined navigation, a quick start wizard, and a consistent visual design with warm amber/orange accents. Key sections like the Dashboard, DM Toolkit, and Live Manager have redesigned hero sections, D&D-inspired icons, and narrative-first layouts. A persistent social hub, the Hearth system, provides personalized greetings and interactive elements.

### Technical Implementations
The frontend uses React with TypeScript, Wouter for routing, TanStack React Query for state management, shadcn/ui (Radix UI) components, and Tailwind CSS. The backend is Express.js (TypeScript) with Drizzle ORM for PostgreSQL (Neon serverless), Passport.js for authentication, and WebSockets for real-time features. AI integration uses a flexible provider abstraction for user-configurable LLMs (OpenAI, Anthropic, local/self-hosted) with automatic fallback, and DALL-E 3 image generation uses the app's OpenAI key.

### Feature Specifications
Core features include user and character management, an AI-generated campaign system with session tracking, and a procedural exploration map. The exploration system uses narrative-aware hex maps with dynamic generation. A persistent Shared World tracks community-wide events. The dice rolling engine supports standard RPG dice with real-time updates.

AI functionalities provide campaign generation, dynamic narrative, character backgrounds, and DM assistance, focusing on exploration, discovery, mystery, and social encounters. The DM Toolkit includes generators for NPCs, locations, quests, and monsters, plus an invitation system and Discord integration. The DM Trust System in the Live Manager offers DMs control over AI suggestions. Advanced AI narrative control mechanisms include Anti-Repetition & Narrative Pacing (using scene history and CAML Story Spine) and Chapter Progression Nudging. Campaigns feature a Completion System with forked endings based on choices, and a "Session 1 Retention Contract."

The Campaign Anti-Cycling & Forced Conclusion System prevents endless campaigns with per-chapter and overall campaign scene hard caps. Momentous Choice Tracking records critical decisions, influencing future narrative and preventing repetition, potentially triggering campaign completion with forked endings.

The CAML2 Adventure & Campaign Creation Guide integration (`/api/campaigns/generate-complete`) generates reactive adventures with mandatory architecture including a Reactive Villain Model, Framing Event, Complications Queue, Encounter Budget System, Active Stakes, Conditional Process Activation, and Failure-as-Advancement. A persistent Combat Log records all actions, narratives, and rolls, providing filtered views. Post-Combat Rewards Engine automatically generates loot, gold, and XP. Crafting, an Expanded SRD Shop, and a Player Market support in-game economy. "Wander Mode" and "Delve Mode" offer distinct exploration experiences. Performance optimizations include response compression, structured logging, code splitting, and streaming AI narrative with Continuity Lock.

A procedural World Hex Map (100x100 hex grid) is generated from 8 world regions with terrain variety, positioned locations, and dynamic rivers/roads. It supports zoom/pan, fog-of-war, and hex details. Interactive City Maps are procedurally generated for settlements, featuring districts and interactive buildings with services and discovery mechanics. The Trek System allows players to select a character and travel step-by-step toward a destination, with a chance for enriched encounters (ambush, discovery, loot_find) that can trigger AI-powered D&D scenes. The Capital City System features a 30x30 hex-based exploration map with 8 districts, buildings, and random street encounters. It includes an Interactive Bank system (deposit/withdraw gold with interest) and an Interactive Housing system (buy/sell houses, item storage). Capital Political Intrigue Quests and Location-based Quest Generation provide context-appropriate quests based on building types and settlement context.

### Analytics System
The `useAnalytics` hook (client/src/hooks/use-analytics.ts) provides page view, feature usage, campaign action, character action, DM tool, AI request, dice roll, and combat action tracking. It is wired into all major pages (dashboard, characters, campaigns, world-map, dm-toolkit, wander, delve, trading-post, hearth, dice-roller) and sends events to `/api/analytics/event`. Admin analytics dashboard (`/admin`) queries `userActivityEvents` and `userSessionsAnalytics` tables.

### CAML Cover Art
Both `/api/caml/generate` and `/api/campaigns/generate-complete` routes generate DALL-E 3 cover art via `generateCAMLCoverArt()` in server/routes.ts. Images are stored in object storage under `public/caml-covers/`. The CAMLManager frontend displays cover art alongside generated adventure details.

### DM Toolkit Campaign Selection
The DM Toolkit auto-selects a campaign (from localStorage or first active campaign) and displays a prominent "Active Campaign" card at the top of the page. Selection is persisted in `dm_toolkit_campaign_id` localStorage key and cleaned up when campaigns are archived/deleted.

### Live Session Manager UX (World-Tension-First Design)
The Live Manager (`LiveManagerPanel.tsx`) uses a "world tension first" layout with DM creativity prioritized over auto-generated content:
1. **World Pressure Overview** - Top of center column, collapsible panel. DM-created pressures and clocks always display first. "Add Pressure" and "Add Clock" are primary actions. Campaign stakes, active tensions, rival agents, and urgent threads shown below DM content. Auto-seeded suggested pressures only appear when DM has created nothing, with adopt/edit/dismiss controls. Data from `GET /api/campaigns/:id/world-pressure`.
2. **Escalation Clocks** - Visible progress tracks (filled/empty blocks) with stage count, "advances in X days" label, trigger conditions, and +1/remove controls. DMs create and manage their own clocks. Color-coded: green (early) -> amber (mid) -> red (near completion).
3. **Spark Buttons** - "Need inspiration?" collapsible section with 6 themed one-tap buttons (Political Intrigue, Natural Disaster, Faction Conflict, Religious Tension, Criminal Underworld, Arcane Anomaly). One click seeds 2 clocks + 1 hidden variable, all fully editable by the DM.
4. **Do Nothing Forecast** - Collapsible panel showing AI-free consequence predictions if the party stalls (derived from clocks, stakes, rival agents, factions, meters).
5. **DM Controls** - Pause/Undo/Checkpoint/Inject/Override in a permanently visible bottom toolbar, showing current session and narrative mode.
6. **Emerging Consequences** - Right sidebar "Ripples" tab shows DM-created consequences above suggested "World Force" events. World Forces are proactive events players didn't trigger (faction movements, seasonal shifts, rival actions), tagged with Globe icon and "World Force" badge, with accept/edit/dismiss controls.
7. **Map-Backed VTT Table** - The drag-and-drop table uses the procedural exploration map as a 30% opacity background, with dragged artifacts rendered as backdrop-blur cards over the map.

Backend endpoints for DM pressure/clock management:
- `POST /api/campaigns/:id/dm-pressures` - Create DM pressure
- `PATCH /api/campaigns/:id/dm-pressures/:pressureId` - Update DM pressure
- `DELETE /api/campaigns/:id/dm-pressures/:pressureId` - Delete DM pressure
- `POST /api/campaigns/:id/dm-clocks` - Create escalation clock
- `PATCH /api/campaigns/:id/dm-clocks/:clockId` - Update clock (advance stage, edit)
- `DELETE /api/campaigns/:id/dm-clocks/:clockId` - Delete clock
- `POST /api/campaigns/:id/spark` - Apply spark template (seeds 2 pressures + 2 clocks + hidden variable)

### Theme Detection System
Content generation uses a weighted scoring theme detection system across 4 detection points (doctrine improvisation, encounter narrative, streaming narrative, and tile descriptions). The system supports 14 themes: nautical, forest, undead, desert, mountain, urban, swamp, arctic, feywild, underdark, planar, dungeon, plus exploration/wilderness for the doctrine system. Theme detection uses keyword frequency scoring with a minimum confidence threshold of 2 keyword matches — below this, it falls back to a neutral default (exploration or dungeon depending on context). Theme blending activates when a secondary theme scores at least 50% of the primary, adding ~20-30% secondary flavor to content. Ambiguous keywords like "captain", "port", "island" have been removed from nautical detection to prevent false positives.

### Description Variety & Anti-Repetition
AI prompts include an explicit anti-repetition directive banning overused phrases ("glowing runes", "mystical energy", "arcane symbols pulse") and providing alternative description categories (carved stonework, mechanical contraptions, natural phenomena, crystal formations, weathered carvings). The `themeTileDescriptions` map covers all 11 themes (nautical, forest, urban, desert, mountain, swamp, arctic, feywild, underdark, planar, undead) plus default, each with 10 tile type descriptions.

### Waypoint Travel System
Travel-intent actions (walk, continue, head north, proceed, move on, trek, march) are detected by `isWaypointTravel()` in both `server/routes.ts` and `server/storyStreaming.ts`. When detected, the AI receives a WAYPOINT MOVE instruction limiting response to 20-35 words (1-2 sentences, grounded transition). This prevents simple movement from generating full dramatic scenes. The streaming narrative system uses a separate `waypoint` reveal category with short travel-themed texts.

### Puzzle Encounter System
Puzzles appear in two contexts:
1. **Campaign encounters** (server/routes.ts): 12 varied puzzle templates at 12% trigger chance during exploration — mirror rooms, riddle challenges, musical locks, flooded chambers, statue puzzles, tile patterns, restless spirits, shifting mazes, alchemical locks, gravity rooms, countdown bridges, and mechanical locks. Each has 3-4 solution approaches.
2. **Delve mode** (server/delveEngine.ts): 12 puzzle types in PUZZLE_POOL — runic door, totem gate, pressure tile maze, mirror room, musical lock, doppelganger tribunal, time loop chamber, never-ending corridor, empty-handed statues, murder mystery crypt, flooded trapdoor, countdown bridge. Each has hint, solution/failure narratives, and DC checks.

### Chapter Advancement Mechanics
Chapter progression uses meaning-based gates with tuned thresholds targeting ~1 chapter per play-hour:
- CHAPTER_MIN_SCENES = 3 (earliest possible advancement)
- GENTLE_THRESHOLD = 5 (AI starts steering toward gate)
- MODERATE_THRESHOLD = 7 (urgency increases)
- URGENT_THRESHOLD = 9 (must advance now)
- CHAPTER_HARD_CAP = 10 (forced advancement failsafe)
- `gateId` comparison uses `Number()` coercion to prevent type mismatch between AI string responses and numeric chapter IDs
- AI prompt instructs targeting 6-8 scenes per chapter
- Same thresholds apply to both Route 1 (doctrine-based) and Route 2 (main narrative streaming)

### Session Break Notice
The "Good stopping point" green notice appears when:
1. AI sets `sessionBreakpoint: true` AND player has been playing 40+ minutes (MIN_SESSION_MINUTES = 40), OR
2. A chapter just advanced (regardless of time played)
- Dismissible; won't reappear for 30 minutes after dismissal
- AI prompted with explicit examples of when to set sessionBreakpoint (after boss fights, arriving at safe havens, quest completions, campfire scenes, chapter gates)

### Feature Discovery Popups
`FeatureDiscoveryPopup` component (`client/src/components/ui/feature-discovery-popup.tsx`) shows periodic tips during campaign play:
- 4 tips: Wander Mode, Delve Mode, Trek, Hex Mode
- Shown after 5+ scenes played, max once each per user (tracked in localStorage)
- One tip per session, dismissible with "Got it!" button
- Amber/gold border styling to distinguish from green break notice

## External Dependencies

### Core
- @neondatabase/serverless: PostgreSQL connection
- drizzle-orm: Database ORM
- express: Web application framework
- passport: Authentication middleware
- ws: WebSocket implementation
- openai: AI integration
- js-yaml: YAML parsing

### Frontend
- @tanstack/react-query: Server state management
- @radix-ui/*: UI component primitives
- wouter: React router
- framer-motion: Animation library
- tailwindcss: CSS framework