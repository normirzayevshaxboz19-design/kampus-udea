import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { SCHEMA } from "./schema";

const globalForDb = globalThis as unknown as { __kampusDb?: Database.Database };

export function db(): Database.Database {
  if (!globalForDb.__kampusDb) {
    const file = process.env.DATABASE_FILE ?? "data/kampus.db";
    const dir = path.dirname(path.resolve(file));
    fs.mkdirSync(dir, { recursive: true });
    const database = new Database(file);
    database.pragma("journal_mode = WAL");
    database.pragma("foreign_keys = ON");
    database.exec(SCHEMA);
    migrate(database);
    globalForDb.__kampusDb = database;
  }
  return globalForDb.__kampusDb;
}

/** Mavjud bazaga keyin qo'shilgan ustun/jadvalarni moslashtiradi (sxema o'zgarganda). */
function migrate(database: Database.Database) {
  const columns = database.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!columns.some((c) => c.name === "avatar_url")) {
    database.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT");
  }
  if (!columns.some((c) => c.name === "is_admin")) {
    database.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
  }

  // Ro'yxatdan o'tish holatlariga 'pending' va 'rejected' qo'shildi — jadvalni qayta quramiz.
  const regSql = (
    database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'registrations'").get() as
      | { sql?: string }
      | undefined
  )?.sql;
  if (regSql && !regSql.includes("'pending'")) {
    database.pragma("foreign_keys = OFF");
    database.exec(`
      BEGIN;
      CREATE TABLE registrations_new (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','confirmed','waitlist','rejected','cancelled','attended','no_show')),
        ticket_code TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        checked_in_at TEXT,
        UNIQUE(event_id, user_id)
      );
      INSERT INTO registrations_new (id, event_id, user_id, status, ticket_code, created_at, checked_in_at)
        SELECT id, event_id, user_id, status, ticket_code, created_at, checked_in_at FROM registrations;
      DROP TABLE registrations;
      ALTER TABLE registrations_new RENAME TO registrations;
      CREATE INDEX IF NOT EXISTS idx_reg_event ON registrations(event_id);
      COMMIT;
    `);
    database.pragma("foreign_keys = ON");
  }
  // Navbatdan tasdiqlangan paytni saqlash uchun ustun (waitlist promotion).
  const regColumns = database.prepare("PRAGMA table_info(registrations)").all() as { name: string }[];
  if (!regColumns.some((c) => c.name === "promoted_at")) {
    database.exec("ALTER TABLE registrations ADD COLUMN promoted_at TEXT");
  }

  // Always ensure unique index on ticket_code exists (for new databases or after migration)
  if (!regSql || regSql.includes("'pending'")) {
    database.pragma("foreign_keys = OFF");
    // Check if unique index already exists
    const existingIdx = database.prepare("SELECT name FROM sqlite_master WHERE type='index' AND sql LIKE '%ticket_code%' AND sql LIKE '%unique%'").all();
    if (existingIdx.length === 0) {
      database.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_reg_ticket ON registrations(ticket_code);
      `);
    }
    database.pragma("foreign_keys = ON");
  }
}

/** Foydalanuvchining shu klub/jamoada a'zoligi haqidagi ma'lumotni olish. */
export function membershipOf(userId: string, orgId: string) {
  return one<{ id: string; status: string; role_key: string }>(
    "SELECT id, status, role_key FROM memberships WHERE user_id = ? AND org_id = ?",
    userId,
    orgId
  );
}

/** Clubs/jamoalarga qo'shilish arizasi yuborish. */
export function joinClub(userId: string, orgId: string) {
  const existing = membershipOf(userId, orgId);
  if (existing) {
    if (existing.status === "pending") return { ok: false, error: "Arizangiz allaqachon yuborilgan" };
    if (existing.status === "active") return { ok: false, error: "Siz allaqachon a'zosiz" };
    run("UPDATE memberships SET status = 'pending' WHERE id = ?", existing.id);
    return { ok: true };
  }
  run(
    "INSERT INTO memberships (id, user_id, org_id, role_key, status, joined_at) VALUES (?,?,?,'pending',datetime('now'))",
    `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId,
    orgId
  );
  return { ok: true };
}

export function all<T>(sql: string, ...params: unknown[]): T[] {
  return db().prepare(sql).all(...params) as T[];
}

export function one<T>(sql: string, ...params: unknown[]): T | undefined {
  return db().prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, ...params: unknown[]) {
  return db().prepare(sql).run(...params);
}