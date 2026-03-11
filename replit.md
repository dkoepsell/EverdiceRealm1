# Everdice - Fantasy RPG Companion

## Overview
Everdice is an AI-enhanced full-stack web application designed for tabletop RPGs, particularly Dungeons & Dragons 5th Edition. It provides comprehensive tools for character creation, campaign management, dice rolling, and AI-powered storytelling. The platform aims to deliver an immersive, user-friendly, and legally compliant experience, making RPGs more accessible for new players while offering advanced features and intelligent automation for experienced players and Game Masters.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a welcoming landing page, streamlined navigation, a quick start wizard, and a consistent visual design with warm amber/orange accents. Key sections like the Dashboard, DM Toolkit, and Live Manager include redesigned hero sections, D&D-inspired icons, and narrative-first layouts. A persistent social hub, the Hearth system, provides personalized greetings and interactive elements.

### Technical Implementations
The frontend is built with React and TypeScript, using Wouter for routing, TanStack React Query for state management, shadcn/ui (Radix UI) components, and Tailwind CSS. The backend utilizes Express.js (TypeScript) with Drizzle ORM for PostgreSQL (Neon serverless), Passport.js for authentication, and WebSockets for real-time functionalities. AI integration supports user-configurable LLMs (OpenAI, Anthropic, local/self-hosted) with automatic fallback, and DALL-E 3 image generation.

### Feature Specifications
Core features include user and character management, AI-generated campaigns with session tracking, and a procedural exploration map. The exploration system uses narrative-aware hex maps with dynamic generation, contributing to a persistent Shared World. A robust dice rolling engine supports standard RPG dice with real-time updates.

AI functionalities provide campaign generation, dynamic narrative, character backgrounds, and DM assistance, focusing on exploration, discovery, mystery, and social encounters. The DM Toolkit includes generators for NPCs, locations, quests, and monsters, alongside an invitation system and Discord integration. The DM Trust System in the Live Manager gives DMs control over AI suggestions. Advanced AI narrative controls include Anti-Repetition & Narrative Pacing (using scene history and CAML Story Spine) and Chapter Progression Nudging. Campaigns feature a Completion System with forked endings based on choices, a "Session 1 Retention Contract," and a Campaign Anti-Cycling & Forced Conclusion System with scene hard caps. Momentous Choice Tracking records critical decisions to influence future narratives and trigger campaign completion.

The CAML2 Adventure & Campaign Creation Guide integration generates reactive adventures with mandatory architecture including a Reactive Villain Model, Framing Event, Complications Queue, Encounter Budget System, Active Stakes, Conditional Process Activation, and Failure-as-Advancement. A persistent Combat Log records all actions, narratives, and rolls, providing filtered views. A Post-Combat Rewards Engine automatically generates loot, gold, and XP. Crafting, an Expanded SRD Shop, and a Player Market support an in-game economy. "Wander Mode" and "Delve Mode" offer distinct exploration experiences. Performance optimizations include response compression, structured logging, code splitting, and streaming AI narrative with Continuity Lock.

A procedural World Hex Map (100x100 hex grid) is generated from 8 world regions with terrain variety, positioned locations, and dynamic rivers/roads, supporting zoom/pan, fog-of-war, and hex details. Interactive City Maps are procedurally generated for settlements, featuring districts and interactive buildings with services and discovery mechanics. The Trek System allows players to travel step-by-step toward a destination, with chances for enriched encounters that trigger AI-powered D&D scenes. The Capital City System features a 30x30 hex-based exploration map with 8 districts, buildings, random street encounters, an Interactive Bank system, and an Interactive Housing system. Capital Political Intrigue Quests and Location-based Quest Generation provide context-appropriate quests.

The `useAnalytics` hook provides tracking for page views, feature usage, campaign and character actions, DM tools, AI requests, dice rolls, and combat actions, with an admin dashboard for analysis. Both CAML generation routes (`/api/caml/generate` and `/api/campaigns/generate-complete`) generate DALL-E 3 cover art stored in object storage. The DM Toolkit automatically selects an active campaign for display.

The Live Session Manager UX prioritizes DM creativity with a "world tension first" design. It features a World Pressure Overview for DM-created pressures and clocks, Escalation Clocks with visible progress tracks, "Spark Buttons" for quick inspiration, a "Do Nothing Forecast" for AI-free consequence predictions, and DM Controls for narrative management. Emerging Consequences display both DM-created and AI-suggested "World Force" events. A Map-Backed VTT Table uses the procedural exploration map as a background for dragged artifacts.

A weighted scoring theme detection system across 4 detection points (doctrine improvisation, encounter narrative, streaming narrative, and tile descriptions) supports 14 themes, with theme blending for secondary flavors. AI prompts include explicit anti-repetition directives and alternative description categories for enhanced variety. A Waypoint Travel System detects travel-intent actions and limits AI responses to short, grounded transitions. The Puzzle Encounter System integrates 12 varied puzzle templates into both campaign encounters and Delve mode, each with multiple solution approaches. Chapter progression uses meaning-based gates with tuned thresholds (3-10 scenes per chapter) for optimal pacing, aiming for approximately one chapter per play-hour. A live Chapter Objective Card provides players with real-time progress, hints, and urgency levels. A "Good stopping point" notice appears after key narrative events or extended play, and Feature Discovery Popups introduce players to key mechanics like Wander Mode, Delve Mode, and Trek.

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