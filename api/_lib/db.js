// Tiny database layer, no dependencies.
// Production: Neon Postgres over its HTTPS SQL endpoint (DATABASE_URL=postgres://...).
// Local dev/tests: Node's built-in SQLite (DATABASE_URL=sqlite:path/to/file.db).
// Write SQL with $1, $2 ... placeholders; it is translated for SQLite.

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, phone TEXT,
    role TEXT NOT NULL DEFAULT 'seller', account_type TEXT NOT NULL DEFAULT 'individual',
    is_demo INTEGER NOT NULL DEFAULT 0, created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS otps (
    email TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at BIGINT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0, created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, plan TEXT NOT NULL, status TEXT NOT NULL,
    starts_at BIGINT, expires_at BIGINT, created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, brand TEXT NOT NULL, model TEXT NOT NULL, title TEXT NOT NULL,
    condition TEXT NOT NULL, storage TEXT, color TEXT, price BIGINT NOT NULL,
    county TEXT NOT NULL, constituency TEXT NOT NULL, area TEXT NOT NULL, description TEXT,
    photos TEXT NOT NULL DEFAULT '[]', imei TEXT, package TEXT, rank INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL, reject_reason TEXT, expires_at BIGINT, approved_at BIGINT,
    views INTEGER NOT NULL DEFAULT 0, contacts INTEGER NOT NULL DEFAULT 0,
    is_demo INTEGER NOT NULL DEFAULT 0, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS listings_status ON listings (status, rank, created_at)`,
  `CREATE INDEX IF NOT EXISTS listings_user ON listings (user_id)`,
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, target_id TEXT NOT NULL,
    package TEXT NOT NULL, amount BIGINT NOT NULL, method TEXT NOT NULL, reference TEXT,
    status TEXT NOT NULL, verified_by TEXT, created_at BIGINT NOT NULL, paid_at BIGINT)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS payments_reference ON payments (reference)`,
  `CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, name TEXT, contact TEXT, page TEXT,
    status TEXT NOT NULL DEFAULT 'open', unread_staff INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL, last_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, sender TEXT NOT NULL, staff_name TEXT,
    body TEXT NOT NULL, created_at BIGINT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS chat_messages_chat ON chat_messages (chat_id, created_at)`,
];

// Postgres type OIDs we convert from text: int8, int2, int4, numeric, bool, float4, float8
const NUMERIC = new Set([20, 21, 23, 1700, 700, 701]);

let driver = null;
let schemaReady = null;

function sqliteDriver(file) {
  const { DatabaseSync } = require("node:sqlite");
  const fs = require("fs"), path = require("path");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  return {
    async query(sql, params = []) {
      const text = sql.replace(/\$(\d+)/g, "?$1");
      const stmt = db.prepare(text);
      const args = params.map((p) => (typeof p === "boolean" ? (p ? 1 : 0) : p));
      if (/^\s*(select|with)\b/i.test(text) || /\breturning\b/i.test(text)) return stmt.all(...args);
      stmt.run(...args);
      return [];
    },
  };
}

function neonDriver(url) {
  const u = new URL(url);
  const candidates = [`https://${u.hostname.replace(/^[^.]+\./, "api.")}/sql`, `https://${u.hostname}/sql`];
  let endpoint = null;
  async function call(ep, sql, params) {
    const res = await fetch(ep, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Neon-Connection-String": url, "Neon-Raw-Text-Output": "true", "Neon-Array-Mode": "true" },
      body: JSON.stringify({ query: sql, params: params.map((p) => (p == null ? null : typeof p === "boolean" ? (p ? "1" : "0") : String(p))) }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(body.message || `Database error ${res.status}`); err.status = res.status; throw err; }
    return body;
  }
  return {
    async query(sql, params = []) {
      let body;
      if (endpoint) body = await call(endpoint, sql, params);
      else {
        let lastErr;
        for (const ep of candidates) {
          try { body = await call(ep, sql, params); endpoint = ep; break; } catch (e) { lastErr = e; if (e.status && e.status < 500 && e.status !== 404) { endpoint = ep; throw e; } }
        }
        if (!endpoint) throw lastErr;
      }
      const fields = body.fields || [];
      return (body.rows || []).map((row) => {
        const o = {};
        fields.forEach((f, i) => { const v = row[i]; o[f.name] = v == null ? null : NUMERIC.has(f.dataTypeID) ? Number(v) : f.dataTypeID === 16 ? v === "t" || v === "true" : v; });
        return o;
      });
    },
  };
}

function getDriver() {
  if (driver) return driver;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
  if (!url) { const e = new Error("Marketplace database is not configured yet"); e.code = "NO_DB"; throw e; }
  driver = url.startsWith("sqlite:") ? sqliteDriver(url.slice(7)) : neonDriver(url);
  return driver;
}

async function q(sql, params) {
  const d = getDriver();
  if (!schemaReady) schemaReady = (async () => { for (const s of SCHEMA) await d.query(s); })().catch((e) => { schemaReady = null; throw e; });
  await schemaReady;
  return d.query(sql, params);
}
async function one(sql, params) { return (await q(sql, params))[0] || null; }

module.exports = { q, one };
