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
The Live Manager (`LiveManagerPanel.tsx`) uses a "world tension first" layout:
1. **World Pressure Overview** - Top of center column, collapsible panel showing campaign stakes (with color-coded urgency bars), active tensions, rival agent status, and urgent unresolved threads. Data from `GET /api/campaigns/:id/world-pressure`.
2. **Do Nothing Forecast** - Collapsible panel showing AI-free consequence predictions if the party stalls (derived from stakes, rival agents, factions, meters).
3. **Collapsed DM Controls** - Pause/Undo/Checkpoint/Inject/Override moved to a collapsible bottom toolbar (collapsed by default), showing current mode in collapsed label.
4. **Emerging Consequences** - Right sidebar "Ripples" tab (was "Event Queue") shows consequence cards with trigger source, narrative impact, escalation-if-ignored, and time elapsed.
5. **Map-Backed VTT Table** - The drag-and-drop table uses the procedural exploration map as a 30% opacity background, with dragged artifacts rendered as backdrop-blur cards over the map.

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