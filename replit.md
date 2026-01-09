# Everdice - Fantasy RPG Companion

## Overview
Everdice is a full-stack web application designed as an AI-enhanced companion for tabletop RPGs. It uses open rules from the D&D 5th Edition System Reference Document (SRD 5.1) under the Creative Commons Attribution 4.0 International License. The platform integrates a React frontend with an Express.js backend to offer character creation, campaign management, dice rolling, and AI-powered storytelling tools. It aims to make tabletop RPGs more accessible to new players while providing advanced features for experienced players and Game Masters.

## Legal & Licensing
- **Fan Content Policy**: Everdice is unofficial fan content permitted under the Wizards of the Coast Fan Content Policy.
- **SRD 5.1 License**: Game mechanics and content from the SRD 5.1 are used under Creative Commons Attribution 4.0.
- **Disclaimer**: Not approved/endorsed by Wizards of the Coast. ©Wizards of the Coast LLC.
- **IP Compliance**: Proprietary content (Beholder, Mind Flayer, Forgotten Realms, etc.) is avoided; only SRD-compatible content is used.
- See `/legal` page in the app for full license information.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript (Vite)
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **UI Framework**: shadcn/ui (Radix UI)
- **Styling**: Tailwind CSS
- **Authentication**: Context-based system

### Backend
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM
- **Authentication**: Passport.js (local strategy, sessions)
- **Real-time**: WebSocket for dice rolls and campaign updates
- **AI Integration**: OpenAI GPT-4o for story and character assistance

### Database
- **Primary**: PostgreSQL (Neon serverless)
- **Schema Management**: Drizzle Kit
- **Session Storage**: `connect-pg-simple`

### Core Features
- **User Management**: Registration, authentication, profile management.
- **Character Management**: D&D 5e character creation, XP tracking, progression, AI-powered portrait generation (DALL-E 3), computed stats (AC, attack/damage bonuses).
- **Campaign System**: Creation, management, session tracking, AI-generated storylines, turn-based support, archiving, deployment. Persistent dungeon maps with interactive grid, fog of war, and generator. Enhanced chapter progression with AI-generated chapter titles, narratives, and objectives tied to campaign arc. Story continuity preserved through previous chapter context in AI prompts. Dynamic chapter pacing prevents premature final chapters.
- **World Map System**: Persistent realm-wide map showing all regions of Everdice. Tracks user exploration progress across regions and locations. Adventures/campaigns link to world locations, automatically updating user progress when playing. Public visibility for all users to envision the realm. Visit counts persist across sessions.
- **Dice Rolling Engine**: Standard RPG dice, real-time WebSocket rolls, history, critical hit/fumble detection, advantage/disadvantage mechanics.
- **AI-Powered Features**: Campaign/story generation, dynamic narrative, character backgrounds/portraits, DM assistance (NPCs, locations, quests, monsters). AI focuses on exploration, discovery, mystery, and social encounters.
- **DM Toolkit**: NPC/location/quest/monster generators, campaign notes, invitation system.
- **CAML 2.0 Integration**: Full support for CAML 2.0 (Canonical Adventure Markup Language) with ontological layers:
    - **world**: Independent continuants (characters, locations, items, factions, connections) - includes intrinsic properties like statblock/abilities
    - **state**: Dependent continuants (status facts with bearer, type, value) - includes mutable properties like NPC attitude, current HP, quest status
    - **roles**: Revocable role assignments (quest givers, faction leaders)
    - **processes**: Occurrents (events, encounters, gameplay sessions with timeboxes) - encounters are processes, not static objects
    - **transitions**: State changes caused by processes
    - **snapshots**: Timestamped timeline for audit and replay
    - Backward compatible with CAML 1.x import (auto-migration)
    - Export campaigns as CAML 2.0 YAML/JSON for Foundry VTT and other tools
    - AI-generated structured adventures in CAML 2.0 format
    - Adventure graph visualization showing entity relationships
    - Flagship examples: `caml-2.0/examples/the-lost-temple-ethereal.caml2.json`, `caml-2.0/examples/the-lost-temple-whispers.caml2.json`, `caml-2.0/examples/whispers-in-the-shadows.caml2.json`
- **RPG Systems**:
    - **Progression**: Automatic XP, random item drops, character progression tracking, skill progression (+1 bonus every 5 uses, max +5).
    - **Combat**: D&D mechanics, HP tracking (party/enemies), visual health bars, tactical options, combat end detection, bonus XP for defeating enemies.
    - **Rest & Inventory**: Short/Long rests, inventory management (view, add, remove), item equip/unequip, item transfer between party members.
    - **Death & Status**: Death saving throws (conscious, unconscious, stabilized, dead), critical rolls (Nat 20/1), stabilize/heal actions.
    - **Quests**: Structured quest system with status tracking, AI-generated initial quests, rewards (XP, gold, items), persistence, and UI display.

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

### Development
- **typescript**: Type checking
- **vite**: Build tool
- **drizzle-kit**: Database schema management
- **tsx**: TypeScript execution