import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { attachDatabasePool } from "@vercel/functions";
import * as schema from "./schema";

let instance: ReturnType<typeof drizzle<typeof schema>> | undefined;
export function getDb() {
  if (instance) return instance;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for persistence.");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 4,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 10000,
    statement_timeout: 15000,
  });
  pool.on("error", () => console.error("[database] Idle connection failed"));
  if (process.env.VERCEL) attachDatabasePool(pool);
  instance = drizzle(pool, { schema });
  return instance;
}

export type Database = ReturnType<typeof getDb>;
export type DatabaseSession = Pick<Database, "select" | "insert" | "update" | "delete" | "execute">;
