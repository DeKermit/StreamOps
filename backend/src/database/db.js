// database/db.js
// Uses Node's built-in node:sqlite (DatabaseSync) instead of better-sqlite3,
// so there is no native module to compile - this is what makes the
// one-click Windows launcher actually work without Visual Studio Build Tools.
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'streamops.sqlite');

const raw = new DatabaseSync(DB_PATH);
raw.exec('PRAGMA journal_mode = WAL;');
raw.exec('PRAGMA foreign_keys = ON;');

// Thin wrapper so the rest of the codebase can use the familiar
// better-sqlite3-style `db.prepare(sql).all/get/run(...)` API everywhere,
// even though the underlying driver is node:sqlite.
function prepare(sql) {
  const stmt = raw.prepare(sql);
  return {
    all: (...params) => stmt.all(...params),
    get: (...params) => stmt.get(...params),
    run: (...params) => stmt.run(...params),
  };
}

function exec(sql) {
  raw.exec(sql);
}

exec(`
  CREATE TABLE IF NOT EXISTS streamers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    brand_name TEXT,
    theme_preset TEXT DEFAULT 'streamelements_dark',
    dashboard_theme TEXT,
    youtube_api_key TEXT,
    avatar_url TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stream_sessions (
    id TEXT PRIMARY KEY,
    streamer_id TEXT NOT NULL REFERENCES streamers(id),
    name TEXT NOT NULL,
    youtube_video_url TEXT,
    youtube_live_chat_id TEXT,
    connection_status TEXT NOT NULL DEFAULT 'disconnected',
    coc_tracking_enabled INTEGER NOT NULL DEFAULT 0,
    vote_command TEXT NOT NULL DEFAULT '!vote',
    created_at TEXT NOT NULL,
    ended_at TEXT
  );

  CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES stream_sessions(id),
    youtube_username TEXT NOT NULL,
    youtube_channel_id TEXT,
    player_tag TEXT NOT NULL,
    normalized_player_tag TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    source TEXT NOT NULL DEFAULT 'chat',
    detected_at TEXT NOT NULL,
    confirmed_at TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_unique_tag
    ON participants (session_id, normalized_player_tag);

  CREATE TABLE IF NOT EXISTS duplicate_attempts (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES stream_sessions(id),
    youtube_username TEXT NOT NULL,
    normalized_player_tag TEXT NOT NULL,
    owned_by_username TEXT NOT NULL,
    attempted_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS giveaways (
    id TEXT PRIMARY KEY,
    streamer_id TEXT NOT NULL REFERENCES streamers(id),
    session_id TEXT REFERENCES stream_sessions(id),
    title TEXT NOT NULL,
    entry_mode TEXT NOT NULL DEFAULT 'keyword',   -- 'keyword' | 'coc_tag' | 'coc_user'
    keyword TEXT,
    winner_count INTEGER NOT NULL DEFAULT 1,
    backup_count INTEGER NOT NULL DEFAULT 1,
    allow_duplicate_winners INTEGER NOT NULL DEFAULT 0,
    draw_animation_enabled INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'open',            -- 'open' | 'drawn' | 'closed'
    brand_accent TEXT DEFAULT 'gold',
    prize_name TEXT,
    prize_description TEXT,
    prize_image_url TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    giveaway_id TEXT NOT NULL REFERENCES giveaways(id),
    channel_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    dedupe_key TEXT NOT NULL,
    entered_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_unique
    ON entries (giveaway_id, dedupe_key);

  CREATE TABLE IF NOT EXISTS draws (
    id TEXT PRIMARY KEY,
    giveaway_id TEXT NOT NULL REFERENCES giveaways(id),
    draw_number INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    pool_size INTEGER NOT NULL,
    winner_entry_ids TEXT NOT NULL,     -- JSON array of {id, label}
    backup_entry_ids TEXT NOT NULL,     -- JSON array of {id, label}
    winner_status TEXT NOT NULL DEFAULT '{}',  -- JSON map entryId -> accepted|rejected|pending
    next_backup_index INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS alert_configs (
    streamer_id TEXT PRIMARY KEY REFERENCES streamers(id),
    config TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS alert_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES stream_sessions(id),
    type TEXT NOT NULL,      -- 'member' | 'super_chat' | 'super_sticker' | 'gift_membership' | 'test'
    title TEXT NOT NULL,
    message TEXT,
    amount TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS polls (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES stream_sessions(id),
    question TEXT NOT NULL,
    options TEXT NOT NULL,     -- JSON array of strings
    status TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'live' | 'closed'
    created_at TEXT NOT NULL,
    closed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS poll_votes (
    id TEXT PRIMARY KEY,
    poll_id TEXT NOT NULL REFERENCES polls(id),
    voter_key TEXT NOT NULL,
    option_index INTEGER NOT NULL,
    voted_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_poll_votes_unique
    ON poll_votes (poll_id, voter_key);

  CREATE TABLE IF NOT EXISTS mod_settings (
    session_id TEXT PRIMARY KEY REFERENCES stream_sessions(id),
    banned_words TEXT NOT NULL DEFAULT '[]',
    auto_flag_links INTEGER NOT NULL DEFAULT 1,
    auto_flag_caps INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS mod_flags (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES stream_sessions(id),
    author TEXT NOT NULL,
    channel_id TEXT,
    message TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'dismissed' | 'actioned'
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES stream_sessions(id),
    author TEXT NOT NULL,
    channel_id TEXT,
    message TEXT NOT NULL,
    bucket_minute TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chat_messages_session_bucket
    ON chat_messages (session_id, bucket_minute);

  CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    streamer_id TEXT,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TEXT NOT NULL
  );
`);

// CREATE TABLE IF NOT EXISTS only creates a table on its first run - it does
// NOT add new columns to a table that already exists on disk from an older
// version of this schema. Any column added to the CREATE TABLE statements
// above after the app has already shipped needs to also be listed here, or
// it will silently be missing on every existing local database file.
function ensureColumn(table, column, definition) {
  const existing = raw.prepare(`PRAGMA table_info(${table})`).all();
  const hasColumn = existing.some((col) => col.name === column);
  if (!hasColumn) {
    raw.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('streamers', 'avatar_url', 'TEXT');
ensureColumn('giveaways', 'prize_name', 'TEXT');
ensureColumn('giveaways', 'prize_description', 'TEXT');
ensureColumn('giveaways', 'prize_image_url', 'TEXT');

module.exports = { prepare, exec, raw };
