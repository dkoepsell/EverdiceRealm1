# Everdice - Fantasy RPG Companion

## Overview
Everdice is a full-stack web application designed as an AI-enhanced companion for tabletop RPGs. It leverages open rules from the D&D 5th Edition System Reference Document (SRD 5.1) to offer character creation, campaign management, dice rolling, and AI-powered storytelling tools. The platform aims to make tabletop RPGs more accessible for new players and provides advanced features for experienced players and Game Masters, integrating a React frontend with an Express.js backend. The project focuses on creating an immersive, user-friendly, and legally compliant (SRD 5.1, Fan Content Policy) environment for D&D 5th Edition.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a welcoming landing page with clear calls to action, simplified navigation, and a quick start wizard for onboarding. Visual polish includes warm amber/orange accents, gradient headers, improved card designs, and consistent visual hierarchies. Specific pages like the Dashboard and DM Toolkit have redesigned hero sections with D&D-inspired decorative icons and streamlined, narrative-first layouts. The Live Manager offers a complete UX redesign focused on a clear DM workflow, guiding users through managing scenes and player interactions with visual cues and onboarding hints. The Hearth system provides a persistent social hub with personalized greetings, interactive elements, and a cozy aesthetic.

### Technical Implementations
Everdice is built with a React frontend using TypeScript, Wouter for routing, TanStack React Query for state management, shadcn/ui (Radix UI) for components, and Tailwind CSS for styling. The backend is an Express.js application, also in TypeScript, utilizing Drizzle ORM for database interactions with PostgreSQL (Neon serverless). Authentication is handled via Passport.js, and real-time features like dice rolls and campaign updates use WebSockets. AI integration is powered by OpenAI GPT-4o for dynamic story and character assistance, including DALL-E 3 for portrait generation.

### Feature Specifications
Core features include comprehensive user and character management, a sophisticated campaign system with AI-generated storylines, session tracking, and a procedural exploration map system. The exploration system uses narrative-aware hex maps with HexMetaV2 metadata, generating hexes dynamically as players explore rather than pre-generating full maps. This creates stronger narrative-map cohesion by:
- Starting with a single origin hex and revealing adjacent areas based on AI narrative mentions (e.g., "to the north lies a forest")
- Parsing AI responses for directional hints (n, ne, se, s, sw, nw) and environment keywords (forest, cave, village, etc.)
- Generating new hexes on-demand when players click unexplored areas, triggering AI scene generation
- Using fog-of-war to hide unexplored territories with HexMetaV2 semantic metadata (narrative tones, importance types, environment tags, hex affordances, tension system)
A World Map system tracks user exploration across regions. The dice rolling engine supports standard RPG dice with real-time WebSocket communication.

AI-powered features extend to campaign generation, dynamic narrative, character backgrounds, and DM assistance, with a focus on exploration, discovery, mystery, and social encounters. The DM Toolkit includes generators for NPCs, locations, quests, and monsters, along with an invitation system and Discord integration. The DM Trust System (Live Manager) provides DMs with control over AI suggestions and game flow through a control bar, event queue, AI whisper panel, session modes, and checkpointing. The Dice Tab in the Live Manager sidebar offers a full DM Dice Roller (d4-d100, advantage rolls, modifiers, purpose labels, public/hidden toggle), Initiative Tracker (turn management, round counter, "Roll All" for party initiative), and Roll Queue (roll history with critical/fumble detection, request rolls from players for ability checks or saving throws). Public rolls display dramatically in the Current Scene area with animations for critical hits and natural 1s. An SRD Library integration allows browsing and linking D&D 5e SRD content from open5e.com.

Discord integration enables playing campaigns directly through Discord channels with slash commands for rolling dice, recaps, and status updates. A Campaign Dashboard provides DMs with AI-powered narrative insights. The Hearth system acts as a social hub for player interaction, while the Tavern system offers between-campaign activities like shopping, inventory management, and equipment repair.

The Trading Post is a free community marketplace where users can share and discover adventures, custom items, and homebrew content. Features include: browsing/searching shared adventures and items with filters (difficulty, genre, rarity, item type), star ratings and reviews, auto-generated cover art via DALL-E 3, one-click import of CAML adventure data, download tracking, and a trending section on the dashboard. The Player Market tab enables player-to-player item trading: list inventory items for gold, buy from other players, cancel listings (returns item to inventory). Routes are in `server/tradingPostRoutes.ts` and `server/economyRoutes.ts`, page at `client/src/pages/trading-post.tsx`, database tables: `shared_adventures`, `shared_items`, `trading_post_reviews`, `player_listings`, `market_item_stats`.

### Dynamic Economy System
The economy engine (`server/economyEngine.ts`) drives market-aware pricing across the tavern shop. Features include: demand-based price multipliers (0.7x-2.5x) tracking purchase/sale volume per item, gold inflation tracking based on total gold in circulation vs expected baseline (0.8x-2.0x multiplier), automatic hourly demand decay (DEMAND_DECAY_RATE=0.02), and real-time trend indicators (rising/falling/stable) in the shop UI. Tavern Liar's Dice is rebalanced with asymmetric 3v7 dice split (player sees 3, house has 7 hidden), binomial probability-based payouts (1.05x safe bets to 8x desperate gambles), 0.9x house edge, session profit cap (100gp), max bet (50gp), and live odds/payout display during the guessing phase.

AI-Discovered Side Quests: The AI naturally discovers optional side quests during gameplay (~20-25% frequency) when players enter new locations, meet NPCs, or explore. These quests are brief (1-2 sessions), thematically appropriate, and auto-post to the Quest Board with a "Discovered" badge. All discovered quests include CAML 2.0 compatible objectives arrays and optional questGiver fields for proper state fact conversion and role assignments.

CAML 2.0 (Canonical Adventure Markup Language) integration provides a robust ontological framework for adventures, supporting various entity types and state transitions, with backward compatibility and export options. The World Deterioration System includes global stakes tracks that auto-advance each scene, unreliable NPCs with trust thresholds and breaking points, and foreclosures for permanent losses. The Normative Residue system tracks lasting consequences from player choices (failure, delay, refusal, recklessness, betrayal) with severity levels 0→3, where max severity is unrecoverable. Residue effects include revoke_role, lock_access, flip_attitude, enable_process, and block_path. Repair pathways are costly, risky (can fail and worsen residue), and NPCs can refuse them. Non-reset constraints explicitly block long rest, spells, explanations, and time passage from removing residue. The Scene Schema v2 ensures varied gameplay by preventing consecutive combat encounters and enforcing diverse scene types (Combat, Exploration, Social, Puzzle, Discovery, Travel, Downtime) and resolution modes. RPG systems include automatic XP and skill progression, D&D combat mechanics with HP and status tracking, rest mechanics, inventory management, death saving throws, and a structured quest system. A comprehensive Spell Book System integrates D&D 5e spellcasting for all spellcaster classes, including spell learning, preparation, slot tracking, and detailed spell information.

### Campaign Completion System
Campaigns have defined chapter structures (currentChapter/totalChapters) to prevent endless stories. The system includes:
- Final chapter detection (`isOnFinalChapter`) that triggers special AI instructions to drive toward conclusion
- AI finale prompts that prevent new plot threads and resolve main conflicts within 2-3 story beats
- Campaign completion ONLY triggered when AI explicitly returns `isCampaignFinale: true`
- Idempotency guard: completion only processed if `campaign.isCompleted` is false
- Automatic campaign marking as completed with timestamp in database
- Adventure completion records created for XP tracking per participant
- Response includes `campaignCompletion` data with epilogue, XP summary, and completion message
- Chapter progress visible in advance-story response (currentChapter, totalChapters, isOnFinalChapter)

### Crafting System
The tavern workshop (Crafting tab) offers 25+ recipes spanning weapons, armor, potions, consumables, and ammunition. Each recipe specifies requiredLevel, requiredSkills (proficiency in Medicine/Arcana/etc.), requiredTools (Smith's Tools, Herbalism Kit, etc. must be in inventory), goldCost (consumed on attempt), and a craftingDC. Crafting rolls d20 + proficiency bonus (floor((level+7)/4)) vs DC. Success adds the item to equipment; failure consumes gold. Routes: GET /api/crafting/recipes, POST /api/crafting/craft. Recipes and logic live in `server/economyRoutes.ts`.

### Expanded SRD Shop & Dynamic Pricing
The tavern shop has 80+ items with accurate D&D 5e SRD pricing (e.g., club 0.1gp, musket 500gp, plate armor 1500gp). Server-side base prices in `server/economyEngine.ts` SHOP_ITEM_PRICES. syncMarketItemStats() on startup syncs all items to the market_item_stats table for demand-based dynamic pricing.

### Player Market (Trading Post)
Players can list ANY inventory item for sale, including equipped items. Listing an equipped item automatically unequips it. The UI shows an "[Equipped]" badge and warning message. Routes in `server/economyRoutes.ts`, page at `client/src/pages/trading-post.tsx`.

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