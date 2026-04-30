/**
 * Storage layer — dual mode:
 *   - If DATABASE_URL is set → use PostgreSQL (production / Railway)
 *   - Otherwise → fallback to local JSON file (for local development)
 *
 * Public async API:
 *   init()                       — create tables / seed defaults if needed
 *   getAll()                     — { registrations, winners, settings }
 *   addRegistration(entry)       — push a new registration
 *   findByPhone(phone)           — duplicate-phone check
 *   removeRegistration(id)       — true if removed
 *   addWinnerRound(round)        — append a new draw round
 *   clearWinners()               — wipe history
 *   setSetting(key, value)       — upsert setting
 */

const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
const isPostgres = !!DATABASE_URL;

// Where to put the JSON file. Override with DATA_DIR env var when running
// behind a persistent volume (e.g. Railway Volume mounted at /data).
// Falls back to the project root for local dev.
const DATA_DIR = process.env.DATA_DIR || __dirname;
const JSON_FILE = path.join(DATA_DIR, 'registrations.json');

if (!isPostgres) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('❌ Could not create DATA_DIR:', DATA_DIR, e.message);
  }
}

const DEFAULT_SETTINGS = { baseOffset: 0, totalTarget: 10 };

let pool = null;

if (isPostgres) {
  const { Pool } = require('pg');
  // Railway / managed Postgres typically requires SSL; auto-detect via env
  const needsSSL =
    process.env.NODE_ENV === 'production' ||
    DATABASE_URL.includes('sslmode=require') ||
    DATABASE_URL.includes('railway') ||
    DATABASE_URL.includes('supabase') ||
    DATABASE_URL.includes('amazonaws');
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: needsSSL ? { rejectUnauthorized: false } : false,
  });
}

// ────────────────────────────────────────
// Init / migrations
// ────────────────────────────────────────
async function init() {
  if (!isPostgres) {
    if (!fs.existsSync(JSON_FILE)) {
      writeJSON({ registrations: [], winners: [], settings: { ...DEFAULT_SETTINGS } });
    }
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registrations (
      id            TEXT        PRIMARY KEY,
      name          TEXT        NOT NULL,
      phone         TEXT        NOT NULL UNIQUE,
      department    TEXT        DEFAULT '',
      registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS winner_rounds (
      id       SERIAL      PRIMARY KEY,
      drawn_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      winners  JSONB       NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  // Seed default settings if missing
  await pool.query(
    `INSERT INTO settings (key, value) VALUES
       ('baseOffset',  $1),
       ('totalTarget', $2)
     ON CONFLICT (key) DO NOTHING`,
    [String(DEFAULT_SETTINGS.baseOffset), String(DEFAULT_SETTINGS.totalTarget)]
  );
}

// ────────────────────────────────────────
// JSON helpers (local mode)
// ────────────────────────────────────────
function readJSON() {
  try {
    if (!fs.existsSync(JSON_FILE)) return null;
    const raw = fs.readFileSync(JSON_FILE, 'utf-8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    return null;
  }
}
function writeJSON(d) {
  fs.writeFileSync(JSON_FILE, JSON.stringify(d, null, 2));
}
function defaultJSON() {
  return { registrations: [], winners: [], settings: { ...DEFAULT_SETTINGS } };
}

// ────────────────────────────────────────
// Reads
// ────────────────────────────────────────
async function getAll() {
  if (isPostgres) {
    const [regsRes, winsRes, setsRes] = await Promise.all([
      pool.query(
        'SELECT id, name, phone, department, registered_at FROM registrations ORDER BY registered_at ASC'
      ),
      pool.query(
        'SELECT drawn_at, winners FROM winner_rounds ORDER BY drawn_at DESC'
      ),
      pool.query('SELECT key, value FROM settings'),
    ]);
    const settingsMap = {};
    for (const row of setsRes.rows) settingsMap[row.key] = row.value;
    return {
      registrations: regsRes.rows.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        department: r.department || '',
        registeredAt: new Date(r.registered_at).toISOString(),
      })),
      winners: winsRes.rows.map((r) => ({
        drawnAt: new Date(r.drawn_at).toISOString(),
        winners: r.winners,
      })),
      settings: {
        baseOffset:
          parseInt(settingsMap.baseOffset, 10) >= 0
            ? parseInt(settingsMap.baseOffset, 10)
            : DEFAULT_SETTINGS.baseOffset,
        totalTarget:
          parseInt(settingsMap.totalTarget, 10) > 0
            ? parseInt(settingsMap.totalTarget, 10)
            : DEFAULT_SETTINGS.totalTarget,
      },
    };
  }
  const d = readJSON() || defaultJSON();
  return {
    registrations: Array.isArray(d.registrations) ? d.registrations : [],
    winners: Array.isArray(d.winners) ? d.winners : [],
    settings: {
      baseOffset:
        d.settings && Number.isFinite(d.settings.baseOffset)
          ? d.settings.baseOffset
          : DEFAULT_SETTINGS.baseOffset,
      totalTarget:
        d.settings && Number.isFinite(d.settings.totalTarget) && d.settings.totalTarget > 0
          ? d.settings.totalTarget
          : DEFAULT_SETTINGS.totalTarget,
    },
  };
}

async function findByPhone(phone) {
  if (isPostgres) {
    const r = await pool.query('SELECT id FROM registrations WHERE phone = $1', [phone]);
    return r.rows[0] || null;
  }
  const d = readJSON() || defaultJSON();
  return d.registrations.find((r) => r.phone === phone) || null;
}

// ────────────────────────────────────────
// Writes
// ────────────────────────────────────────
async function addRegistration(entry) {
  if (isPostgres) {
    await pool.query(
      `INSERT INTO registrations (id, name, phone, department, registered_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [entry.id, entry.name, entry.phone, entry.department || '', entry.registeredAt]
    );
    return;
  }
  const d = readJSON() || defaultJSON();
  d.registrations.push(entry);
  writeJSON(d);
}

async function removeRegistration(id) {
  if (isPostgres) {
    const r = await pool.query('DELETE FROM registrations WHERE id = $1', [id]);
    return r.rowCount > 0;
  }
  const d = readJSON() || defaultJSON();
  const before = d.registrations.length;
  d.registrations = d.registrations.filter((r) => r.id !== id);
  if (d.registrations.length === before) return false;
  writeJSON(d);
  return true;
}

async function addWinnerRound(round) {
  if (isPostgres) {
    await pool.query(
      'INSERT INTO winner_rounds (drawn_at, winners) VALUES ($1, $2)',
      [round.drawnAt, JSON.stringify(round.winners)]
    );
    return;
  }
  const d = readJSON() || defaultJSON();
  d.winners.unshift(round);
  writeJSON(d);
}

async function clearWinners() {
  if (isPostgres) {
    await pool.query('DELETE FROM winner_rounds');
    return;
  }
  const d = readJSON() || defaultJSON();
  d.winners = [];
  writeJSON(d);
}

async function setSetting(key, value) {
  if (isPostgres) {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, String(value)]
    );
    return;
  }
  const d = readJSON() || defaultJSON();
  d.settings = d.settings || { ...DEFAULT_SETTINGS };
  d.settings[key] = value;
  writeJSON(d);
}

module.exports = {
  isPostgres,
  jsonPath: isPostgres ? null : JSON_FILE,
  init,
  getAll,
  findByPhone,
  addRegistration,
  removeRegistration,
  addWinnerRound,
  clearWinners,
  setSetting,
};
