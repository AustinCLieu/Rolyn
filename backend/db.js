// db.js — single source of truth for the SQLite connection.
//
// Why a separate file? Both server.js (posts routes) and routes/auth.js (user routes)
// need to query the database. Node's node:sqlite opens a file-level lock, so we want
// exactly ONE DatabaseSync instance shared across the whole app. Exporting it from here
// lets any file import `db` without re-opening the file or duplicating the schema setup.

import { DatabaseSync } from 'node:sqlite';
import path             from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// In production (Railway), the database lives on a persistent volume mounted at
// /app/data so it survives server restarts. Locally it stays next to this file.
// DATABASE_PATH is set as an environment variable on Railway pointing to /app/data/rolyn.db.
const dbPath = process.env.DATABASE_PATH ?? path.join(__dirname, 'rolyn.db');

export const db = new DatabaseSync(dbPath);

// ── Schema ──
// IF NOT EXISTS makes every CREATE safe to run on every startup.
// Adding a new table here is all that's needed — no migration scripts for a class project.

// users — one row per Supabase auth user.
// id is the Supabase UUID so it matches req.user.id from our JWT middleware.
// We don't store passwords here; Supabase Auth owns authentication entirely.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    email      TEXT NOT NULL,
    full_name  TEXT,
    location   TEXT,
    phone      TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// messages — one row per message sent between two users about a specific post.
// post_id ties the message to the listing it's about so threads are per-listing.
// sender_id and receiver_id are both Supabase UUIDs (foreign keys to users.id).
// read tracks whether the receiver has opened the message (0 = unread, 1 = read).
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id     INTEGER NOT NULL,
    sender_id   TEXT    NOT NULL,
    receiver_id TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    read        INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);

// posts — job listings and service/item listings.
// user_id is a foreign key to users.id but SQLite doesn't enforce FK constraints by default,
// so we keep it as TEXT and handle integrity in application code.
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT,
    author_name TEXT    NOT NULL DEFAULT 'Anonymous',
    title       TEXT    NOT NULL,
    category    TEXT    NOT NULL,
    description TEXT    NOT NULL,
    region      TEXT    NOT NULL,
    term        TEXT    NOT NULL,
    price_min   INTEGER,
    price_max   INTEGER,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);
