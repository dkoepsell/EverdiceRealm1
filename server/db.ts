import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  // Recycle idle connections before Postgres/OS can silently drop them, which was
  // surfacing as intermittent ECONNRESET / "Connection terminated unexpectedly".
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // TCP keepalive so dead peers are detected and connections aren't reaped by an
  // idle firewall/NAT timeout on the box.
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

// node-postgres emits 'error' on IDLE clients (e.g. the DB drops a pooled connection,
// ECONNRESET). With no listener this throws as an uncaught exception and can crash the
// process. Log it and let the pool transparently discard the dead client and open a
// fresh one on the next query — so a reset idle connection no longer fails a turn.
pool.on("error", (err) => {
  console.error("[pg pool] idle client error (connection will be recycled):", err.message);
});

export const db = drizzle(pool, { schema });
