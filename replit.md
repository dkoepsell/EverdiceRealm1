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

The system incorporates advanced AI narrative control mechanisms such as Anti-Repetition & Narrative Pacing (using scene history digests and CAML Story Spine) and Chapter Progression Nudging to ensure dynamic and varied storytelling. Chapter advancement is gate-driven, either by AI response or a hard-cap failsafe. Campaigns feature a Completion System with forked endings based on accumulated choices. A "Session 1 Retention Contract" ensures early player engagement and identity formation.

A persistent Combat Log (Battle tab) records all player actions, AI narratives, combat rolls, and chapter starts across sessions. The log is stored per-session in `campaign_sessions.actionLog` (JSONB, capped at 200 entries per session) and served via `GET /api/campaigns/:id/action-log`. The frontend `CombatLogPanel` component offers filtered views (All/Combat/Actions/Story) with expandable narrative entries.

Post-Combat Rewards Engine automatically generates loot, gold, and XP based on combat outcomes and boss detection. Crafting, an Expanded SRD Shop, and a Player Market provide in-game economy and item management. Dedicated "Wander Mode" and "Delve Mode" offer distinct exploration and dungeon-crawling experiences with curated content and mechanics. Performance optimizations include response compression, structured logging, route-level code splitting, and streaming AI narrative with a Continuity Lock to prevent divergence between streamed and final AI outputs.

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