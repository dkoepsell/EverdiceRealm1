# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Everdice Realm** is a full-stack TypeScript web application — a TTRPG (D&D 5e) campaign companion and solo/cooperative play platform. It features AI-assisted storytelling, procedural world generation, combat resolution, economy simulation, and Discord integration.

## Dev Commands

```bash
npm run dev            # Start dev server (Express + Vite HMR) on port 5000
npm run build          # Production build: Vite → dist/public/, esbuild → dist/index.js
npm run start          # Run production build
npm run check          # TypeScript type-check without emit (raw tsc — prints the whole backlog)
npm run check:gate     # Fail only on NEW type errors, vs the committed baseline
npm run check:baseline # Re-record the baseline after fixing or knowingly adding errors
npm run db:push        # Apply Drizzle schema changes to PostgreSQL
```

**The build is type-gated.** `prebuild` runs `check:gate`, so `npm run build` refuses
to produce `dist/` if any file gained type errors it did not have before. This matters
because the server bundle is built by **esbuild, which does not type-check** — without
the gate a compile error ships silently. One did: `ctx.userId` in thirteen handlers that
never defined `ctx` threw `ReferenceError` and 500'd every request to them in production,
while `tsc` had been reporting it as `Cannot find name 'ctx'` the whole time.

`npm run check` alone is **not** a usable gate — the repo carries a backlog of ~341
pre-existing errors, so a raw run is always red and a new error hides in the noise. The
gate keys errors by `file|TScode` and compares counts against
`scripts/typecheck-baseline.json`. Re-record it only when you understand what changed.

⚠️ Building the server bundle by invoking `esbuild` directly (the server-only deploy path,
when shipping `dist/` to the box is blocked) **bypasses the gate** — run `npm run check:gate`
by hand first.

Tests: no runner is configured, but plain assertion suites under `/tests` run directly,
e.g. `npx tsx tests/turnOrder.test.ts`.

## Required Environment Variables

```
DATABASE_URL=postgres://...       # PostgreSQL (Neon serverless)
OPENAI_API_KEY=sk-...             # Optional — enables AI narrative/image features
ANTHROPIC_API_KEY=sk-ant-...      # Optional — fallback AI provider
DISCORD_BOT_TOKEN=...             # Optional — enables Discord bot
```

## Architecture

Single Express server on port 5000 serves both the REST/WebSocket API and (in production) the built React client.

**Entry points:**
- `server/index.ts` — Express setup, middleware, Vite integration, graceful shutdown
- `client/src/main.tsx` — React entry, routes via Wouter

**Path aliases** (configured in `tsconfig.json` and `vite.config.ts`):
- `@/*` → `client/src/`
- `@shared/*` → `shared/`

### Key Layers

| Layer | Location | Notes |
|---|---|---|
| API routes | `server/routes.ts` | ~28k LOC — monolithic route file; new endpoints go here |
| Database interface | `server/storage.ts` | All DB queries abstracted here |
| DB schema + Zod types | `shared/schema.ts` | Source of truth for all types; ~120k LOC |
| DB connection | `server/db.ts` | Drizzle + Neon serverless pool |
| Auth | `server/auth.ts` | Passport.js local + Discord OAuth strategies |

### Server-Side Engines

| Engine | File | Purpose |
|---|---|---|
| Combat | `server/combatManager.ts` | Turn-based combat resolution |
| Wander | `server/wanderEngine.ts` + `server/wanderRoutes.ts` | Procedural exploration |
| Delve | `server/delveEngine.ts` + `server/delveRoutes.ts` | Dungeon delving |
| Economy | `server/economyEngine.ts` + `server/economyRoutes.ts` | Market/crafting/trading |
| Trading Post | `server/tradingPostRoutes.ts` | Player-to-player trading |
| CAML Parser | `server/caml.ts` | Campaign Adventure Markup Language parser |
| Hex Map | `server/narrativeHexParser.ts` | Narrative → world hex tile conversion |
| World Events | `server/lib/worldEventEngine.ts` | Dynamic world state |
| AI Provider | `server/lib/aiProvider.ts` | OpenAI/Anthropic abstraction |
| Story Streaming | `server/storyStreaming.ts` | Chunked AI narrative responses |
| Discord | `server/discord.ts` | Discord bot for remote play |
| Post-Combat | `server/postCombatRewards.ts` | Loot/XP generation |

### Frontend Pages & Components

Pages live in `client/src/pages/`. Notable: `dm-toolkit.tsx` and `tavern.tsx` are very large files (~270k and ~153k LOC respectively).

Components are organized by domain under `client/src/components/`:
- `ui/` — shadcn/ui primitives (Radix-based)
- `adventure/`, `campaign/`, `combat/`, `dm/`, `dungeon/`, `character/` — domain components

Custom hooks in `client/src/hooks/`:
- `use-auth.tsx` — auth context
- `use-story-stream.ts` — AI narrative streaming
- `use-upload.ts` — file upload (Uppy + GCS)

### Data Flow Patterns

- **Server state**: TanStack React Query — all API calls go through `queryClient` in `client/src/lib/queryClient.ts`
- **Real-time**: WebSocket client in `client/src/lib/websocket.ts` — used for live combat/dice/presence
- **Shared types**: Zod schemas in `shared/schema.ts` are used by both client and server; import from `@shared/schema`
- **AI calls**: Always route through `server/lib/aiProvider.ts` — supports OpenAI and Anthropic; narrative responses use streaming with a 5-minute TTL cache
- **Images**: AI-generated portraits/cover art stored in Google Cloud Storage via `server/replit_integrations/object_storage/`

## CAML Format

CAML (Campaign Adventure Markup Language) is a YAML/JSON-based DSL for defining structured campaigns with branching paths, reactive villains, encounter budgeting, and choice tracking. Spec lives in `/caml-2.0/`. Parser in `server/caml.ts`.

## Database

Migrations are Drizzle-generated SQL in `/migrations/`. Schema changes: edit `shared/schema.ts`, then run `npm run db:push`. The schema is large — use `db:push` for dev; review generated migrations before applying to production.
