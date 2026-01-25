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

## Recent UX Improvements (January 2026)
- **Landing Page**: New welcoming hero section with gradient styling, feature showcase, and clear CTAs
- **Navigation**: Simplified to 3 main items (Play, Characters, Learn) with icons and "More" dropdown for advanced features
- **Quick Start Wizard**: 3-step onboarding flow for new users - choose hero template, select character, pick adventure theme
- **Character Templates**: Pre-built hero templates (Warrior, Wizard, Paladin, Rogue, Cleric, Sorcerer) for quick character creation
- **Visual Polish**: Warmer amber/orange accent colors, gradient headers, improved card designs, better whitespace
- **Page Headers**: Consistent gradient text styling across pages for visual hierarchy
- **Dashboard (Play page)**: Redesigned hero with warm amber gradients, D&D-inspired decorative icons (sword, shield, scroll), Everdice brand mark, live "adventurers online" badge, streamlined narrative-first layout with compact character stats bar
- **DM Toolkit**: New purple/blue gradient hero section with fantasy icons (book, wand, map), "DM" brand mark, "AI-Powered Tools" badge, reorganized tool grid into 3 categories (Essential Tools, Create Content, Utilities) with color-coded icons
- **Simplified UX**: Removed dice roller from Play page, replaced tabbed character sheet with compact stats display, adventure narrative now central focus
- **Live Manager Overhaul**: Complete UX redesign with clear workflow: "Cast & World" sidebar (People/Places/Threats) → "Current Scene" (elevated amber spine) → "Likely Player Moves" (purple foresight) → "Tell Your Story" (narration payoff). Onboarding hint guides first-time DMs with 3-step workflow. Empty states include icons and instructional text. Drag-drop shows amber glow feedback.

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
- **HexMetaV2 Dungeon System**: Narrative-aware hex maps where each tile carries semantic metadata that influences AI scene generation:
    - **Narrative Tones**: 10 atmospheric types (Whispering, Menacing, Sacred, Cursed, Ancient, Corrupted, Peaceful, Treacherous, Mysterious, Echoing) displayed as icons on hex corners
    - **Importance Types**: Visual distinction with color-coded outlines - Revelation (gold), Risk (dashed red), LostKnowledge (faded), Sanctuary (green), Convergence (purple pulse)
    - **Environment Tags**: frost-touched, overgrown, flooded, dust-choked, blood-stained, arcane-residue synced between map visuals and AI narrative
    - **Hex Affordances**: 0-5 ratings for exploration/social/investigation/puzzle/combat that guide AI away from combat-default
    - **Tension System**: Starts 10-70 based on room type, increases on failed skill checks, changes hexState (Dormant→Stirring→Active), propagates to adjacent hexes when ≥80
    - **Region Names**: Map subtitle updates based on player location within themed environmental zones
    - **Persistence**: Hex state mutations (tension, hexState) saved to backend to survive refresh
- **World Map System**: Persistent realm-wide map showing all regions of Everdice. Tracks user exploration progress across regions and locations. Adventures/campaigns link to world locations, automatically updating user progress when playing. Public visibility for all users to envision the realm. Visit counts persist across sessions.
- **Dice Rolling Engine**: Standard RPG dice, real-time WebSocket rolls, history, critical hit/fumble detection, advantage/disadvantage mechanics.
- **AI-Powered Features**: Campaign/story generation, dynamic narrative, character backgrounds/portraits, DM assistance (NPCs, locations, quests, monsters). AI focuses on exploration, discovery, mystery, and social encounters.
- **DM Toolkit**: NPC/location/quest/monster generators, campaign notes, invitation system, Discord integration.
- **Discord Integration**: Full bot integration (Everdice#1320) enabling D&D campaigns playable through Discord channels:
    - **Slash Commands**: `/everdice link`, `/everdice roll`, `/everdice recap`, `/everdice status`, `/everdice unlink`
    - **Campaign Linking**: Deploy campaigns to Discord channels using deployment codes
    - **Dice Rolling**: Support for standard notation (1d20+5, 2d6), advantage/disadvantage, critical detection
    - **Auto-posting**: Session events automatically posted to linked Discord channels
    - **Campaign Recaps**: AI-generated story recaps accessible via Discord commands
- **Campaign Dashboard**: DM-only tab in campaign panel with AI-powered narrative insights, quest tracking, party status overview, and story hook suggestions. Uses GPT-4o to analyze campaign state and highlight critical junctures.
- **Hearth System**: Persistent social hub at `/hearth` ("The Lantern Hall"):
    - **Arrival Experience**: Personalized welcome lines, return streak tracking, warm atmosphere
    - **The Room**: See who's "in the Hall" (up to 12 adventurers) with seat zones (fire, board, window, table)
    - **Noticeboard**: Post notes with categories (Message, Hook, LFG, DM Call, Gift), filter and delete own posts
    - **Hearth Memories**: Feed of shared continuity - toasts raised, marks left, milestones achieved
    - **Ritual Actions**: Raise a toast, leave a mark (d6, candle, bootprint, tankard, quill)
    - **World Murmur**: Rotating atmospheric text creating a living world feel
    - **Cozy UX**: Tavern background art, warm amber colors, non-performative social presence
- **Tavern System**: Between-campaign hub at `/tavern` for:
    - **Shop**: Buy weapons, armor, potions, and adventuring gear with gold/silver
    - **Inventory Management**: View equipment with damage/armor stats, sell unwanted items
    - **Blacksmith**: Repair damaged equipment based on rarity tier
    - **Social Hub**: Coming soon - chat, party finder, rumors, mini-games
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
    - Flagship examples: `caml-2.0/examples/the-lost-temple-ethereal.caml2.json`, `caml-2.0/examples/the-lost-temple-whispers.caml2.json`, `caml-2.0/examples/whispers-in-the-shadows.caml2.json`, `caml-2.0/examples/the-lost-temple-history.caml2.json`
- **Scene Schema v2**: Anti-combat-treadmill system ensuring varied gameplay experiences:
    - **Scene Types**: Combat, Exploration, Social, Puzzle, Discovery, Travel, Downtime (weighted toward non-combat)
    - **Resolution Modes**: Violence, Dialogue, Investigation, Ingenuity, Stealth, Endurance (choices include mode hints)
    - **AI Constraints**: Consecutive combat prevention, required non-violent options, scene variety enforcement
    - **Session Tracking**: sceneType and previousSceneType columns track progression to prevent repetitive encounters
    - **Choice Framing**: Every scene includes at least one Dialogue/Social option and one Investigation option
- **RPG Systems**:
    - **Progression**: Automatic XP, random item drops, character progression tracking, skill progression (+1 bonus every 5 uses, max +5).
    - **Combat**: D&D mechanics, HP tracking (party/enemies), visual health bars, tactical options, combat end detection, bonus XP for defeating enemies.
    - **Rest & Inventory**: Short/Long rests, inventory management (view, add, remove), item equip/unequip, item transfer between party members.
    - **Death & Status**: Death saving throws (conscious, unconscious, stabilized, dead), critical rolls (Nat 20/1), stabilize/heal actions.
    - **Quests**: Structured quest system with status tracking, AI-generated initial quests, rewards (XP, gold, items), persistence, and UI display.
- **Spell Book System**: Complete D&D 5e spellcasting for spellcaster classes (Wizard, Sorcerer, Cleric, Bard, Druid, Warlock, Paladin, Ranger):
    - **Spell Database**: 77+ SRD 5e spells from cantrips to 9th level across all schools of magic
    - **Spell Learning**: Learn spells based on class and level, with acquisition tracking
    - **Spell Preparation**: Prepare/unprepare spells for daily use (cantrips always prepared)
    - **Spell Slots**: Track spell slot usage per level with visual indicators
    - **Long Rest Reset**: Restore all spell slots on long rest
    - **Spell Details**: Full spell information including components (V/S/M), casting time, range, duration, school, damage/healing dice, concentration, ritual
    - **Character Integration**: Spells tab appears only for spellcasting classes in character sheet
    - **Learning Content**: Spellcasting educational path and quick references on Learn page

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