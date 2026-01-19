# Everdice Realm

**Everdice Realm** is a lightweight web application for tabletop roleplaying games (TTRPGs), designed to help people learn, explore, and play Dungeons & Dragons–style games with minimal friction and minimal pressure.

Live app:  
https://everdice-realm-davidkoepsell.replit.app/
https://realmofeverdice.com

Repository:  
https://github.com/dkoepsell/EverdiceRealm1

---

## What This Is

Everdice Realm is a campaign companion and play environment that supports:

- Solo adventures as a low-pressure way to learn RPG mechanics  
- Guided narrative play with structured choices  
- Gradual on-ramps to cooperative play and Dungeon Mastering  
- Experimental uses of AI as a narrative facilitator, not a replacement for human play  

This repository contains the entire full-stack application, including frontend, backend, shared types, database migrations, and helper scripts.

Core design premise:  
Most people who are curious about tabletop RPGs do not start confident, social, or rules-fluent.  
Everdice treats solo play as onboarding, not as a dead end.

---

## What This Is Not

- Not a replacement for tabletop play  
- Not a rules-legal D&D clone or full rules engine  
- Not a content farm or monetized rules platform  
- Not a finished or “solved” product  

Everdice is intentionally exploratory, educational, and iterative.

---

## How People Usually Use Everdice

Observed usage so far shows a clear pattern:

- Most users begin with solo adventures  
- Solo play functions as a trust-building and learning phase  
- Exploration of co-op play and DM tools tends to follow later  

This progression is expected and intentional.

---

## Tech Stack

- TypeScript (full stack)  
- Node.js  
- Vite  
- Tailwind CSS  
- Drizzle ORM  
- Component tooling via components.json (shadcn/ui–style setup)

Note: Earlier references to a Python dice engine do not apply to this repository.

---

## Repository Structure

.
├─ client/  
├─ server/  
├─ shared/  
├─ migrations/  
├─ attached_assets/  
├─ drizzle.config.ts  
├─ vite.config.ts  
├─ tailwind.config.ts  
├─ postcss.config.js  
├─ tsconfig.json  
├─ components.json  
├─ apply-migrations.js  
├─ migrate.js / migrate.cjs  
├─ migrate-campaigns.js  
├─ migrate-npcs.js  
├─ package.json  
└─ package-lock.json  

---

## Getting Started

Install dependencies:

npm install

### Environment Variables

You will need a database connection string for Drizzle:

DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DBNAME

Additional environment variables may be required depending on enabled features.

---

### Run in Development

npm run dev

---

## Database and Migrations

This project uses Drizzle ORM for schema management.

Included helpers:

- apply-migrations.js  
- migrate.js / migrate.cjs  
- migrate-campaigns.js  
- migrate-npcs.js  

Always review migration scripts before running them against production data.

---

## Replit Deployment

Designed to run on Replit:

https://replit.com/@DavidKoepsell/EverdiceRealm

---

## Contributing

Issues and pull requests are welcome.

Please:
- Keep changes scoped and readable  
- Include reproduction steps for bugs  
- Avoid unnecessary complexity  
- Respect the project’s educational and non-extractive goals  

---

## Design Philosophy

Everdice is built around:

- Low pressure over optimization  
- Learning by doing  
- Narrative understanding over mechanical mastery  
- Human play over automation  

Solo play is a pedagogical entry point.

---

## Relationship to CAML

Everdice uses CAML (Campaign Adventure Markup Language), a structured, human-readable format for representing adventures, scenes, and choices.

CAML enables adventures to be authored incrementally and reused across solo, co-op, and DM-led play.

---

## License

This project is licensed under the Hippocratic License 3.0 (Modified).

You may use, study, modify, and share this software for non-harmful purposes, including education and personal projects.

You may not use this software to facilitate harm, surveillance without consent, coercion, manipulation, or extractive enclosure.

---

## LICENSE TEXT

Hippocratic License Version 3.0 (Modified)

Copyright (c) 2026 David R. Koepsell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, subject to the following conditions:

1. The Software may not be used to cause or facilitate harm.
2. The Software may not be used for surveillance, coercion, discrimination, or exploitation.
3. The Software may not be enclosed into proprietary systems that remove user agency or source access.
4. Educational, research, personal, and non-commercial uses are encouraged.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

---

## Author

David R. Koepsell  
J.D., Ph.D.  
Philosophy of Law, Ontology, and Technology

If you are curious about Everdice, the best way to understand it is to play a solo adventure first.
