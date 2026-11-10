import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

export type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

type GlobalDb = {
  pool?: pg.Pool;
  local?: Promise<PGlite>;
  ready?: Promise<void>;
};

const globalDb = globalThis as unknown as { __govclaw?: GlobalDb };
const state: GlobalDb = globalDb.__govclaw ?? (globalDb.__govclaw = {});

async function getLocal(): Promise<PGlite> {
  state.local ??= startLocal().catch((error: unknown) => {
    state.local = undefined;
    throw error;
  });
  return state.local;
}

async function startLocal(): Promise<PGlite> {
  const db = new PGlite();
  const dir = path.join(process.cwd(), "migrations");
  const files = (await readdir(dir).catch(() => [] as string[]))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(await readFile(path.join(dir, file), "utf8"));
  }
  return db;
}

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureSeeded();
  if (databaseUrl !== "") {
    state.pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    return (await state.pool.query(text, params)).rows as T[];
  }
  const db = await getLocal();
  return (await db.query<T>(text, params)).rows;
}

export async function withConnection<T>(fn: (q: Query) => Promise<T>): Promise<T> {
  if (databaseUrl !== "") {
    state.pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    const client = await state.pool.connect();
    const q: Query = async (text, params = []) => (await client.query(text, params)).rows as never;
    try {
      return await fn(q);
    } finally {
      client.release();
    }
  }
  const db = await getLocal();
  const q: Query = async <T,>(text: string, params: unknown[] = []) =>
    (await db.query<T>(text, params)).rows as T[];
  return fn(q);
}

export async function ensureSeeded(): Promise<void> {
  state.ready ??= seedIfEmpty().catch((error: unknown) => {
    state.ready = undefined;
    throw error;
  });
  await state.ready;
}

async function seedIfEmpty(): Promise<void> {
  await withConnection(async (q) => {
    let locked = false;
    try {
      await q("select pg_advisory_lock(7272742)");
      locked = true;
    } catch {
      locked = false;
    }
    try {
      const rows = await q<{ count: number | string }>("select count(*)::int as count from organizations");
      if (Number(rows[0]?.count ?? 0) === 0) {
        const { seedDatabase } = await import("./seed");
        await seedDatabase(q);
      }
    } finally {
      if (locked) {
        try {
          await q("select pg_advisory_unlock(7272742)");
        } catch {
          locked = false;
        }
      }
    }
  });
}
