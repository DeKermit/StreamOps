// services/giveawayService.js
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { drawWinners } = require('./drawEngine');
const { logActivity } = require('./activityLog');

// Matches a keyword as a standalone "word" in a chat message, the way a
// viewer actually types a giveaway command - e.g. keyword "!enter" must
// match "!enter to win" and "please !enter", surrounded only by
// whitespace or the start/end of the message. \b word-boundary regex
// does NOT work here: \b only fires between a word character and a
// non-word character, so a keyword that starts with punctuation (like
// the very "!enter" example this app suggests) sits between two
// non-word characters (space, "!") and \b never matches at all - this
// was silently breaking every punctuation-prefixed keyword.
function matchesKeyword(message, keyword) {
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i');
  return re.test(message);
}

// Called for every chat message on a session that has at least one
// open 'keyword' giveaway. Entry is deduped per giveaway by channel id
// (or display name if a channel id isn't available), via a UNIQUE index -
// same "try insert, react to the constraint" pattern used for CoC tags.
function tryEnterKeywordGiveaways(sessionId, author, channelId, message) {
  const openGiveaways = db
    .prepare("SELECT * FROM giveaways WHERE session_id = ? AND status = 'open' AND entry_mode = 'keyword'")
    .all(sessionId);

  for (const giveaway of openGiveaways) {
    if (!giveaway.keyword) continue;
    if (!matchesKeyword(message, giveaway.keyword)) continue;

    const dedupeKey = channelId || author.toLowerCase();
    try {
      db.prepare(
        `INSERT INTO entries (id, giveaway_id, channel_id, display_name, dedupe_key, entered_at) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(uuidv4(), giveaway.id, channelId || '', author, dedupeKey, new Date().toISOString());
      logActivity(sessionId, 'entry', `🎟️ @${author} entered "${giveaway.title}"`);
    } catch {
      // already entered - ignore silently, this is expected and frequent
    }
  }
}

// Manual entry management for keyword-mode giveaways. CoC-tag giveaways
// pull their pool from the participants table instead, which already has
// its own full manual add/edit/delete/confirm workflow in Tag Manager -
// this is intentionally only for the general "keyword" entry list.
function listEntries(giveawayId) {
  return db.prepare('SELECT * FROM entries WHERE giveaway_id = ? ORDER BY entered_at DESC').all(giveawayId);
}

function addManualEntry(giveaway, displayName, channelId) {
  if (giveaway.entry_mode !== 'keyword') {
    throw new Error('Manual entries can only be added to keyword-entry giveaways. Manage Clash of Clans entries from Tag Manager.');
  }
  const dedupeKey = (channelId || displayName).trim().toLowerCase();
  try {
    const id = uuidv4();
    db.prepare(
      `INSERT INTO entries (id, giveaway_id, channel_id, display_name, dedupe_key, entered_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, giveaway.id, channelId || '', displayName.trim(), dedupeKey, new Date().toISOString());
    logActivity(giveaway.session_id, 'entry', `🎟️ @${displayName.trim()} manually added to "${giveaway.title}"`);
    return db.prepare('SELECT * FROM entries WHERE id = ?').get(id);
  } catch {
    throw new Error(`"${displayName}" is already entered in this giveaway.`);
  }
}

function removeEntry(giveaway, entryId) {
  const row = db.prepare('SELECT * FROM entries WHERE id = ? AND giveaway_id = ?').get(entryId, giveaway.id);
  if (!row) throw new Error('Entry not found.');
  db.prepare('DELETE FROM entries WHERE id = ?').run(entryId);
  logActivity(giveaway.session_id, 'entry', `🗑️ @${row.display_name} removed from "${giveaway.title}"`);
  return { success: true };
}

function eligiblePool(giveaway) {
  if (giveaway.entry_mode === 'keyword') {
    const entries = db.prepare('SELECT * FROM entries WHERE giveaway_id = ?').all(giveaway.id);
    return entries.map((e) => ({ id: e.id, label: `@${e.display_name}`, groupKey: e.dedupe_key }));
  }

  // coc_tag / coc_user modes draw from confirmed CoC participants of the
  // linked session - entry_mode decides whether duplicates are
  // collapsed by player tag (one winner per tag) or by YouTube user
  // (one winner per person, even if they registered several tags).
  const participants = db
    .prepare("SELECT * FROM participants WHERE session_id = ? AND status = 'confirmed'")
    .all(giveaway.session_id);
  return participants.map((p) => ({
    id: p.id,
    label: `@${p.youtube_username} (${p.normalized_player_tag})`,
    groupKey: giveaway.entry_mode === 'coc_user' ? p.youtube_username.toLowerCase() : p.normalized_player_tag,
  }));
}

function runDraw(giveaway) {
  const pool = eligiblePool(giveaway);
  const mode = giveaway.entry_mode === 'keyword' ? 'independent' : 'per_group';
  const { poolSize, winners, backups } = drawWinners(pool, giveaway.winner_count, giveaway.backup_count, {
    mode,
    allowDuplicates: !!giveaway.allow_duplicate_winners,
  });

  const priorDraws = db.prepare('SELECT MAX(draw_number) as n FROM draws WHERE giveaway_id = ?').get(giveaway.id);
  const drawNumber = (priorDraws.n || 0) + 1;
  const id = uuidv4();
  const now = new Date().toISOString();
  const winnerStatus = {};
  winners.forEach((w) => (winnerStatus[w.id] = 'pending'));

  db.prepare(
    `INSERT INTO draws (id, giveaway_id, draw_number, timestamp, pool_size, winner_entry_ids, backup_entry_ids, winner_status, next_backup_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
  ).run(id, giveaway.id, drawNumber, now, poolSize, JSON.stringify(winners), JSON.stringify(backups), JSON.stringify(winnerStatus));

  db.prepare("UPDATE giveaways SET status = 'drawn' WHERE id = ?").run(giveaway.id);
  logActivity(giveaway.session_id, 'draw', `🎲 Draw #${drawNumber} for "${giveaway.title}": ${winners.length} winner(s)`);

  return db.prepare('SELECT * FROM draws WHERE id = ?').get(id);
}

// role: 'accepted' | 'rejected'. On rejection, backfills that winner
// slot from the next unused backup, by index pointer rather than
// re-running the random draw - the replacement was already drawn
// randomly at draw time, just not yet revealed.
function setWinnerRole(drawId, entryId, role) {
  const draw = db.prepare('SELECT * FROM draws WHERE id = ?').get(drawId);
  if (!draw) throw new Error('Draw not found.');

  const winners = JSON.parse(draw.winner_entry_ids);
  const backups = JSON.parse(draw.backup_entry_ids);
  const status = JSON.parse(draw.winner_status);

  if (role === 'rejected' && status[entryId] !== 'rejected' && draw.next_backup_index < backups.length) {
    const replacement = backups[draw.next_backup_index];
    const idx = winners.findIndex((w) => w.id === entryId);
    if (idx !== -1) {
      winners[idx] = replacement;
      status[replacement.id] = 'pending';
    }
    status[entryId] = 'rejected';
    db.prepare('UPDATE draws SET winner_entry_ids = ?, winner_status = ?, next_backup_index = ? WHERE id = ?').run(
      JSON.stringify(winners),
      JSON.stringify(status),
      draw.next_backup_index + 1,
      drawId
    );
  } else {
    status[entryId] = role;
    db.prepare('UPDATE draws SET winner_status = ? WHERE id = ?').run(JSON.stringify(status), drawId);
  }

  return db.prepare('SELECT * FROM draws WHERE id = ?').get(drawId);
}

module.exports = { tryEnterKeywordGiveaways, eligiblePool, runDraw, setWinnerRole, listEntries, addManualEntry, removeEntry };
