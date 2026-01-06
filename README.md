# Everdice Realm

Repository for the Everdice Realm web app (Replit project: `@DavidKoepsell/EverdiceRealm`).

**Live app:** https://everdice-realm-davidkoepsell.replit.app/

---

## What this is

Everdice Realm is a lightweight web app for tabletop RPG support: a campaign companion with a modern web UI and a TypeScript backend. This repository contains the full stack (client + server), shared types, database migrations, and helper scripts.

> Note: This codebase is a TypeScript full‑stack application. Earlier references to a Python dice engine do not apply to this repository.

---

## Tech stack

- **TypeScript**
- **Vite**
- **Tailwind CSS**
- **Drizzle ORM**
- **Node.js**
- Component tooling (via `components.json`, typical of shadcn/ui setups)

---

## Repository structure

```
.
├─ client/                 # Frontend application
├─ server/                 # Backend API / server
├─ shared/                 # Shared types and utilities
├─ migrations/             # Database migrations (Drizzle)
├─ attached_assets/        # Images and static assets
├─ drizzle.config.ts       # Drizzle configuration
├─ vite.config.ts          # Vite configuration
├─ tailwind.config.ts      # Tailwind configuration
├─ postcss.config.js       # PostCSS configuration
├─ tsconfig.json           # TypeScript configuration
├─ components.json         # UI/component tooling configuration
├─ apply-migrations.js     # Migration helper
├─ migrate.js / migrate.cjs
├─ migrate-campaigns.js    # Campaign data migration
├─ migrate-npcs.js         # NPC data migration
├─ package.json
└─ package-lock.json
```

---

## Getting started

### Install dependencies

```bash
npm install
```

### Environment variables

You will need a database connection string for Drizzle. Typically:

```bash
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DBNAME
```

Additional environment variables may be required depending on enabled features (authentication, AI integrations, etc.). See the server code for details.

### Run in development

```bash
npm run dev
```

If separate client/server scripts are defined in `package.json`, run those as needed.

---

## Database & migrations

This repository uses Drizzle for schema management.

Included helpers:
- `apply-migrations.js`
- `migrate.js` / `migrate.cjs`
- `migrate-campaigns.js`
- `migrate-npcs.js`

Example:

```bash
node apply-migrations.js
```

Always review migration scripts before running them against production data.

---

## Replit deployment

This project is designed to run on Replit:

https://replit.com/@DavidKoepsell/EverdiceRealm

Replit configuration files:
- `.replit`
- `replit.md`

---

## Contributing

Issues and pull requests are welcome. Please include clear reproduction steps and relevant logs where applicable.

---

## License

No license file is currently included. Add one if you intend this project to be reused or redistributed.

