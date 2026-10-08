// services/participantService.js
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { normalizeTag } = require('./tagDetector');
const { logActivity } = require('./activityLog');

// Lazy require to sidestep any accidental require cycle with socket.js,
// which itself pulls in several of the other services in this folder.
function broadcast(sessionId) {
  const { broadcastParticipants, broadcastStats } = require('../websocket/socket');
  broadcastParticipants(sessionId);
  broadcastStats(sessionId);
}

// Duplicate prevention relies on the database's own UNIQUE index
// (session_id, normalized_player_tag), not a check-then-insert in
// JavaScript. Two chat messages claiming the same tag can arrive
// within milliseconds of each other; only a DB-level constraint is
// safe against that race. We always attempt the insert and react to
// the constraint violation, never pre-check with a SELECT first.
function insertParticipant({ sessionId, youtubeUsername, youtubeChannelId, rawTag, status, source }) {
  const normalized = normalizeTag(rawTag);
  if (!normalized) return { result: 'invalid' };

  const id = uuidv4();
  const now = new Date().toISOString();

  try {
    db.prepare(
      `INSERT INTO participants (id, session_id, youtube_username, youtube_channel_id, player_tag, normalized_player_tag, status, source, detected_at, confirmed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      sessionId,
      youtubeUsername,
      youtubeChannelId || null,
      rawTag,
      normalized,
      status || 'pending',
      source || 'chat',
      now,
      status === 'confirmed' ? now : null
    );
  } catch (err) {
    // UNIQUE constraint violation -> someone already owns this tag.
    const owner = db
      .prepare('SELECT youtube_username FROM participants WHERE session_id = ? AND normalized_player_tag = ?')
      .get(sessionId, normalized);
    const ownedBy = owner ? owner.youtube_username : 'unknown';

    db.prepare(
      `INSERT INTO duplicate_attempts (id, session_id, youtube_username, normalized_player_tag, owned_by_username, attempted_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(uuidv4(), sessionId, youtubeUsername, normalized, ownedBy, now);

    logActivity(sessionId, 'duplicate', `♻️ @${youtubeUsername} tried ${normalized} - already owned by @${ownedBy}`);
    broadcast(sessionId);
    return { result: 'duplicate', ownedBy };
  }

  const participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(id);
  logActivity(sessionId, 'detected', `${status === 'confirmed' ? '🟢' : '🟡'} @${youtubeUsername} registered ${normalized}`);
  broadcast(sessionId);
  return { result: 'created', participant };
}

module.exports = { insertParticipant };
