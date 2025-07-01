# Everdice - Fantasy RPG Companion

## Overview

Everdice is a full-stack web application that serves as an AI-enhanced companion for tabletop RPG experiences, specifically designed for Dungeons & Dragons. The platform combines a React-based frontend with an Express.js backend to provide character creation, campaign management, dice rolling mechanics, and AI-powered storytelling tools. The application bridges the gap between traditional tabletop gaming and modern digital assistance, making D&D more accessible to newcomers while providing valuable tools for experienced players and Dungeon Masters.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack React Query for server state management
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Authentication**: Context-based authentication system with protected routes

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Passport.js with local strategy and session management
- **Real-time Communication**: WebSocket implementation for live dice rolls and campaign updates
- **AI Integration**: OpenAI GPT-4o integration for story generation and character assistance

### Database Architecture
- **Primary Database**: PostgreSQL (Neon serverless)
- **Schema Management**: Drizzle Kit for migrations and schema evolution
- **Session Storage**: Database-backed sessions using connect-pg-simple

## Key Components

### User Management System
- User registration and authentication with password hashing (scrypt)
- Session-based authentication with persistent login
- User profile management with display names and last login tracking

### Character Management
- Comprehensive D&D 5e character creation with ability scores, races, and classes
- XP tracking and character progression system
- AI-powered character portrait generation using DALL-E 3
- Character sheet visualization with stat calculations

### Campaign System
- Campaign creation and management with metadata (difficulty, narrative style)
- Session tracking with AI-generated storylines
- Turn-based gameplay support with time limits
- Campaign archiving and completion tracking
- Deployment system for sharing campaigns with unique codes

### Dice Rolling Engine
- Support for standard RPG dice (d4, d6, d8, d10, d12, d20, d100)
- Real-time dice rolling with WebSocket broadcasting
- Roll history tracking and character-associated rolls
- Critical hit and fumble detection

### AI-Powered Features
- Campaign generation using OpenAI GPT-4o
- Dynamic story generation based on player choices
- Character background and portrait generation
- DM assistance tools for NPCs, locations, quests, and monsters

### DM Toolkit
- NPC creation and management with AI personalities
- Location, quest, and magic item generators
- Monster and encounter management
- Campaign notes and invitation system

## Data Flow

### Authentication Flow
1. User submits credentials via login form
2. Passport.js validates credentials against database
3. Session created and stored in PostgreSQL
4. Frontend receives user data and updates authentication context
5. Protected routes accessible via authentication middleware

### Campaign Session Flow
1. DM creates campaign with initial parameters
2. AI generates opening narrative based on campaign settings
3. Players make choices or perform dice rolls
4. Backend processes actions and updates campaign state
5. AI generates continuation based on previous context and player actions
6. WebSocket broadcasts updates to all connected participants

### Real-time Communication Flow
1. WebSocket connection established on client connection
2. Dice rolls and campaign updates broadcast to relevant participants
3. Connection management with automatic reconnection logic
4. Graceful degradation when WebSocket unavailable

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection
- **drizzle-orm**: Type-safe database ORM
- **express**: Web application framework
- **passport**: Authentication middleware
- **ws**: WebSocket implementation
- **openai**: AI integration for story and image generation

### Frontend Dependencies
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: Accessible UI component primitives
- **wouter**: Lightweight React router
- **framer-motion**: Animation library
- **tailwindcss**: Utility-first CSS framework

### Development Dependencies
- **typescript**: Type safety across the stack
- **vite**: Fast build tool and development server
- **drizzle-kit**: Database schema management
- **tsx**: TypeScript execution engine

## Deployment Strategy

The application is designed for deployment on Replit with the following considerations:

### Environment Configuration
- DATABASE_URL for PostgreSQL connection
- OPENAI_API_KEY for AI features
- SESSION_SECRET for secure session management
- NODE_ENV for environment-specific behavior

### Build Process
1. Frontend builds to `dist/public` using Vite
2. Backend compiles TypeScript to `dist` using esbuild
3. Database migrations run automatically on startup
4. Static assets served from build directory

### Database Management
- Migrations handled through Drizzle Kit
- Sample data initialization on first run
- Connection pooling for optimal performance
- Graceful error handling for database operations

### Production Considerations
- Session security with secure cookies in production
- WebSocket connection management with reconnection logic
- Error boundaries and graceful degradation
- API rate limiting considerations for OpenAI integration

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### Campaign Navigation Improvements (July 01, 2025)
- Added campaign selection dropdown to dashboard for multiple active campaigns
- Enhanced campaigns page layout to show full narrative and choice interface
- Improved user experience when switching between multiple campaigns
- Auto-selects most recent campaign when multiple are available
- Fixed black text on black background styling issues in party tabs across all components
- Enhanced HP and AC contrast in character cards with color-coded backgrounds and borders
- Improved choice button readability with proper contrast backgrounds and skill check tag visibility

### RPG Progression System (July 01, 2025)
- Implemented automatic XP awards (25-100 XP based on skill check difficulty)
- Added random item drops (15% chance per adventure action)
- Created character progression tracking with level-up detection
- Integrated progression rewards dialog to display found items
- Added toast notifications for XP gains and level-ups

## Changelog

Changelog:
- July 01, 2025. Initial setup
- July 01, 2025. Added RPG progression system with XP tracking and item drops
- July 01, 2025. Enhanced campaign navigation with selection dropdown