// routes/participants.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const requireAuth = require('../middleware/requireAuth');
const { insertParticipant } = require('../services/participantService');
const { logActivity } = require('../services/activityLog');
const { broadcastParticipants, broadcastStats } = require('../websocket/socket');

router.use(requireAuth);

const SORT_COLUMNS = {
  newest: 'detected_at DESC',
  oldest: 'detected_at ASC',
  username: 'youtube_username COLLATE NOCASE ASC',
  player_tag: 'normalized_player_tag ASC',
  status: 'status ASC, detected_at DESC',
};

function ownSession(req, sessionId) {
  return db.prepare('SELECT * FROM stream_sessions WHERE id = ? AND streamer_id = ?').get(sessionId, req.streamerId);
}

router.get('/', (req, res) => {
  const { sessionId, status, search, sort } = req.query;
  if (!sessionId || !ownSession(req, sessionId)) return res.status(404).json({ error: 'Session not found.' });

  let sql = 'SELECT * FROM participants WHERE session_id = ?';
  const params = [sessionId];
  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (search && search.trim()) {
    sql += ' AND (youtube_username LIKE ? OR normalized_player_tag LIKE ?)';
    const like = `%${search.trim().replace(/^#/, '').toUpperCase()}%`;
    params.push(`%${search.trim()}%`, like);
  }
  sql += ` ORDER BY ${SORT_COLUMNS[sort] || SORT_COLUMNS.newest}`;
  res.json(db.prepare(sql).all(...params));
});

router.get('/duplicates', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId || !ownSession(req, sessionId)) return res.status(404).json({ error: 'Session not found.' });
  res.json(db.prepare('SELECT * FROM duplicate_attempts WHERE session_id = ? ORDER BY attempted_at DESC').all(sessionId));
});

router.get('/by-user/:username', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId || !ownSession(req, sessionId)) return res.status(404).json({ error: 'Session not found.' });
  res.json(
    db
      .prepare('SELECT * FROM participants WHERE session_id = ? AND youtube_username = ? ORDER BY detected_at ASC')
      .all(sessionId, req.params.username)
  );
});

router.post('/', (req, res) => {
  const { sessionId, youtubeUsername, playerTag, confirmImmediately } = req.body || {};
  if (!sessionId || !ownSession(req, sessionId)) return res.status(404).json({ error: 'Session not found.' });
  if (!youtubeUsername || !playerTag) return res.status(400).json({ error: 'YouTube username and player tag are required.' });

  const result = insertParticipant({
    sessionId,
    youtubeUsername: youtubeUsername.trim(),
    rawTag: playerTag,
    status: confirmImmediately ? 'confirmed' : 'pending',
    source: 'manual',
  });
  if (result.result === 'invalid') return res.status(400).json({ error: `"${playerTag}" is not a valid player tag.` });
  if (result.result === 'duplicate') return res.status(409).json({ error: `That tag is already registered by @${result.ownedBy}.` });
  res.json(result.participant);
});

function getOwned(id, sessionId) {
  return db.prepare('SELECT * FROM participants WHERE id = ? AND session_id = ?').get(id, sessionId);
}

router.patch('/:id', (req, res) => {
  const { sessionId, youtubeUsername, playerTag } = req.body || {};
  if (!sessionId || !ownSession(req, sessionId)) return res.status(404).json({ error: 'Session not found.' });
  const row = getOwned(req.params.id, sessionId);
  if (!row) return res.status(404).json({ error: 'Participant not found.' });

  const updates = {};
  if (youtubeUsername !== undefined) updates.youtube_username = youtubeUsername.trim();
  if (playerTag !== undefined) {
    const { normalizeTag } = require('../services/tagDetector');
    const normalized = normalizeTag(playerTag);
    if (!normalized) return res.status(400).json({ error: 'Not a validly formatted player tag.' });
    const clash = db
      .prepare('SELECT id FROM participants WHERE session_id = ? AND normalized_player_tag = ? AND id != ?')
      .get(sessionId, normalized, row.id);
    if (clash) return res.status(409).json({ error: 'Another participant already owns that tag.' });
    updates.player_tag = normalized;
    updates.normalized_player_tag = normalized;
  }
  const keys = Object.keys(updates);
  if (keys.length) {
    db.prepare(`UPDATE participants SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(
      ...keys.map((k) => updates[k]),
      row.id
    );
  }
  broadcastParticipants(sessionId);
  broadcastStats(sessionId);
  res.json(getOwned(row.id, sessionId));
});

router.delete('/:id', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId || !ownSession(req, sessionId)) return res.status(404).json({ error: 'Session not found.' });
  const row = getOwned(req.params.id, sessionId);
  if (!row) return res.status(404).json({ error: 'Participant not found.' });
  db.prepare('DELETE FROM participants WHERE id = ?').run(row.id);
  logActivity(sessionId, 'delete', `🗑️ Deleted @${row.youtube_username} ${row.normalized_player_tag}`);
  broadcastParticipants(sessionId);
  broadcastStats(sessionId);
  res.json({ success: true });
});

router.post('/:id/confirm', (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId || !ownSession(req, sessionId)) return res.status(404).json({ error: 'Session not found.' });
  const row = getOwned(req.params.id, sessionId);
  if (!row) return res.status(404).json({ error: 'Participant not found.' });
  const now = new Date().toISOString();
  db.prepare("UPDATE participants SET status = 'confirmed', confirmed_at = ? WHERE id = ?").run(now, row.id);
  logActivity(sessionId, 'confirmed', `🟢 @${row.youtube_username} ${row.normalized_player_tag} confirmed`);
  broadcastParticipants(sessionId);
  broadcastStats(sessionId);
  res.json(getOwned(row.id, sessionId));
});

router.post('/:id/pending', (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId || !ownSession(req, sessionId)) return res.status(404).json({ error: 'Session not found.' });
  const row = getOwned(req.params.id, sessionId);
  if (!row) return res.status(404).json({ error: 'Participant not found.' });
  db.prepare("UPDATE participants SET status = 'pending', confirmed_at = NULL WHERE id = ?").run(row.id);
  logActivity(sessionId, 'unpending', `🟡 @${row.youtube_username} ${row.normalized_player_tag} moved back to pending`);
  broadcastParticipants(sessionId);
  broadcastStats(sessionId);
  res.json(getOwned(row.id, sessionId));
});

router.post('/bulk', (req, res) => {
  const { sessionId, ids, action } = req.body || {};
  if (!sessionId || !ownSession(req, sessionId)) return res.status(404).json({ error: 'Session not found.' });
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'A non-empty ids array is required.' });
  if (!['confirm', 'pending', 'delete'].includes(action)) return res.status(400).json({ error: 'Invalid action.' });

  const now = new Date().toISOString();
  let affected = 0;
  for (const id of ids) {
    const row = getOwned(id, sessionId);
    if (!row) continue;
    if (action === 'confirm') db.prepare("UPDATE participants SET status = 'confirmed', confirmed_at = ? WHERE id = ?").run(now, id);
    else if (action === 'pending') db.prepare("UPDATE participants SET status = 'pending', confirmed_at = NULL WHERE id = ?").run(id);
    else db.prepare('DELETE FROM participants WHERE id = ?').run(id);
    affected++;
  }
  logActivity(sessionId, action === 'delete' ? 'delete' : action, `Bulk ${action}: ${affected} participant(s)`);
  broadcastParticipants(sessionId);
  broadcastStats(sessionId);
  res.json({ success: true, affected });
});

module.exports = router;
