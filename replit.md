# Everdice - Fantasy RPG Companion

## Overview
Everdice is an AI-enhanced full-stack web application designed for tabletop RPGs, primarily leveraging D&D 5th Edition SRD 5.1 rules. It provides comprehensive tools for character creation, campaign management, dice rolling, and AI-powered storytelling. The platform aims to enhance accessibility for new players while offering advanced features for experienced players and Game Masters. Its core vision is to create an immersive, user-friendly, and legally compliant environment for D&D 5th Edition, making TTRPGs more engaging and manageable through intelligent automation and dynamic content generation.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a welcoming landing page, streamlined navigation, and a quick start wizard. The visual design incorporates warm amber/orange accents, gradient headers, improved card designs, and consistent visual hierarchies. Key sections like the Dashboard, DM Toolkit, and Live Manager have redesigned hero sections, D&D-inspired decorative icons, and narrative-first layouts. The Live Manager specifically focuses on a clear DM workflow. A persistent social hub, the Hearth system, offers personalized greetings and interactive elements.

### Technical Implementations
Everdice utilizes a React frontend with TypeScript, Wouter for routing, TanStack React Query for state management, shadcn/ui (Radix UI) for components, and Tailwind CSS for styling. The backend is built with Express.js (TypeScript), using Drizzle ORM for PostgreSQL (Neon serverless). Authentication is handled by Passport.js, and real-time functionalities are powered by WebSockets. AI integration uses a flexible provider abstraction (`server/lib/aiProvider.ts`) supporting user-configurable LLMs (OpenAI, Anthropic, local/self-hosted) with automatic fallback to the app's OpenAI GPT-4o subscription. DALL-E 3 image generation exclusively uses the app's OpenAI key.

### Feature Specifications
Core features include user and character management, a campaign system with AI-generated storylines, session tracking, and a procedural exploration map system. The exploration system uses narrative-aware hex maps with dynamic generation based on AI input. A persistent Shared World system tracks community-wide events and discoveries, influencing all campaigns. The dice rolling engine supports standard RPG dice with real-time WebSocket updates.

AI-powered functionalities extend to campaign generation, dynamic narrative, character backgrounds, and DM assistance, with a focus on exploration, discovery, mystery, and social encounters. The DM Toolkit provides generators for NPCs, locations, quests, and monsters, alongside an invitation system and Discord integration. The DM Trust System in the Live Manager offers DMs granular control over AI suggestions and game flow.

The system incorporates advanced AI narrative control mechanisms such as Anti-Repetition & Narrative Pacing (using scene history digests and CAML Story Spine) and Chapter Progression Nudging to ensure dynamic and varied storytelling. Chapter advancement is gate-driven, either by AI response or a hard-cap failsafe (12 scenes per chapter). Campaigns feature a Completion System with forked endings based on accumulated choices. A "Session 1 Retention Contract" ensures early player engagement and identity formation.

Campaign Anti-Cycling & Forced Conclusion System: Prevents campaigns from endlessly cycling. Per-chapter hard cap is 12 scenes (force-advances to next chapter). Overall campaign scene hard cap is totalChapters × 10 (auto-completes campaign). On the final chapter: urgency prompts at 6+ scenes, forced finale decision at 8+ scenes (AI must present 3-4 ending choices), auto-complete at 12 scenes. Completion awards difficulty-scaled rewards (Heroic 2x, Challenging 1.5x, Relaxed 0.8x multipliers on XP/gold/silver), permanent character titles (e.g., "Gatekeeper of Campaign Title"), earned traits based on playstyle (Fate-Forged, Decision-Maker, Questborne, Battle-Tested), and automatic level-up checks with HP gains using D&D hit dice averages.

Momentous Choice Tracking: Campaign-defining decisions (absorbing artifact power, betraying factions, making pacts, etc.) are permanently recorded in `storyState.momentousChoices`. The AI prompt includes all previously-made momentous choices with explicit instructions to NEVER re-offer them, and to reflect their ongoing consequences (powers granted, reputation effects, world changes) in all future narrative. When the AI detects a momentous choice, it returns `momentousChoiceResolution` with consequence details, world changes, and optional `isCampaignTerminus` flag. If terminus is flagged, it triggers the campaign completion flow with forked endings. Duplicate detection prevents the same choice from being recorded twice. Both the main advance-story and streaming narrative prompts include momentous choice context.

A persistent Combat Log (Battle tab) records all player actions, AI narratives, combat rolls, and chapter starts across sessions. The log is stored per-session in `campaign_sessions.actionLog` (JSONB, capped at 200 entries per session) and served via `GET /api/campaigns/:id/action-log`. The frontend `CombatLogPanel` component offers filtered views (All/Combat/Actions/Story) with expandable narrative entries.

Post-Combat Rewards Engine automatically generates loot, gold, and XP based on combat outcomes and boss detection. Crafting, an Expanded SRD Shop, and a Player Market provide in-game economy and item management. Dedicated "Wander Mode" and "Delve Mode" offer distinct exploration and dungeon-crawling experiences with curated content and mechanics. Performance optimizations include response compression, structured logging, route-level code splitting, and streaming AI narrative with a Continuity Lock to prevent divergence between streamed and final AI outputs.

A procedural World Hex Map (`client/src/lib/worldHexGenerator.ts`, `client/src/components/world/WorldHexMap.tsx`) generates a 100x100 hex grid from the 8 existing world regions (scaled from their gridX/gridY/width/height at REGION_SCALE=8). Terrain variety within each region uses simplex noise (elevation + moisture layers). All 16 existing world locations are placed at their correct posX/posY within region bounds. Rivers flow from mountains to coast, roads follow noise-based winding paths between settlements. Region boundaries use Voronoi-based assignment with noise-warped distances for organic transitions. The canvas-based renderer supports zoom/pan, fog-of-war toggle, minimap, and hex hover/click details. Accessible via Illustrated/Hex Map toggle on the World Map page.

Interactive City Maps (`client/src/components/world/CityMap.tsx`, `city_maps` table) are procedurally generated when entering a city/town/village hex. Each city layout includes districts (Market Quarter, Temple District, etc.) and interactive buildings (tavern, blacksmith, magic shop, guild hall, temple, library, stables, apothecary, etc.) with services, NPC hints, and a discovery mechanic. City maps are stored per campaign+location in the database. Backend endpoints: `POST /api/campaigns/:id/enter-location/:locId` generates layout and quests, `GET /api/campaigns/:id/city-map/:locId` retrieves it, `POST .../discover` marks buildings as discovered.

Trek System (`trek_routes` table, with `pending_encounter` JSONB column, `originQ`/`originR` fields, `lootFound` JSONB array, `characterId`/`characterName` fields) allows players to select a character from their campaign party before starting a trek, then travel toward a destination hex step by step. A character selection dialog appears when clicking "Trek Here" showing all player characters in the campaign with their portraits, stats, and class info. The trek path is computed and visualized as a dashed golden line on the hex map. Each step has a 25% chance to trigger enriched encounters (ambush, traveler, discovery, weather, wildlife, loot_find) with descriptions, hooks, scene types, and narrative categories. The "loot_find" encounter type generates random items (weapons, potions, gear) with rarity/value/effects and bonus gold. When an encounter triggers, the trek status changes to "encounter" and the encounter data is persisted in `pending_encounter`. Players can "Enter Narrative" to generate AI-powered D&D scenes or "Pass By" to dismiss. Trek auto-return: saves origin hex at trek start, automatically returns party to origin on completion/cancel. Backend endpoints: `POST /api/campaigns/:id/trek/start`, `POST .../trek/step`, `GET .../trek/active`, `POST .../trek/cancel`, `POST .../trek/enter-narrative`, `POST .../trek/dismiss-encounter`.

Capital City System: "Crownhaven — The Capital" (location_type="capital") now features a hex-based exploration map (`client/src/components/world/CapitalHexMap.tsx`, `client/src/lib/capitalHexGenerator.ts`, `capital_exploration` table). A 30x30 hex grid with 8 districts (Royal Quarter, Grand Market, Temple Row, Thieves' Quarter, Harbor Ward, Artisan Heights, Scholar's Enclave, Old City) is procedurally generated from a deterministic seed. Players explore by clicking adjacent hexes to move, with fog-of-war revealing hexes within radius 2 of the player position. Buildings are discovered by walking near them (within 1 hex). Random street encounters (15% chance per move) add flavor. The exploration state (position, revealed hexes, discovered buildings) is persisted per user per campaign. Backend validates campaign membership, uses server-side hex layout generation (not client-supplied), and proper offset-coordinate hex adjacency. Capital-specific building types include palace, bank, real_estate, dark_temple, auction, academy, dungeon_entrance, information_broker, tailor. Backend endpoints: `GET /api/campaigns/:id/capital/:locId/exploration`, `POST .../enter`, `POST .../move`. Interactive Bank system (`player_bank` table): deposit/withdraw gold with 1% daily interest, transaction history. Interactive Housing system (`player_houses` table): buy/sell houses across 5 tiers (200gp modest to 15,000gp manor), store items in your home.

Capital Political Intrigue Quests: When entering the capital, the system auto-generates 8+ political intrigue quests tied to building types: "A Court in Turmoil" (palace), "The King's Errand" (palace+barracks), "Threads of the Web" (information broker), "The Stolen Heirloom" (auction house), "Pact of Shadows" (dark temple), "Depths of the Undercity" (dungeon entrance), "The Archmage's Test" (academy), "Vault Breach Investigation" (bank).

Location-based Quest Generation: When entering a settlement (city, town, village, capital), the system auto-generates context-appropriate quests (guild contracts, tavern rumors, temple relic recovery, shadow network jobs, exploration quests, plus capital-specific political intrigue) based on which building types are present. Quests are posted to the campaign quest board with deduplication.

## External Dependencies

### Core
- **@neondatabase/serverless**: PostgreSQL connection
- **drizzle-orm**: Database ORM
- **express**: Web application framework
- **passport**: Authentication middleware
- **ws**: WebSocket implementation
- **openai**: AI integration
- **js-yaml**: YAML parsing for CAML files

### Frontend
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: UI component primitives
- **wouter**: React router
- **framer-motion**: Animation library
- **tailwindcss**: CSS framework