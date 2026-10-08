// routes/session.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../database/db');
const requireAuth = require('../middleware/requireAuth');
const { logActivity } = require('../services/activityLog');

router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db
    .prepare("SELECT * FROM stream_sessions WHERE streamer_id = ? AND connection_status != 'archived' ORDER BY created_at DESC")
    .all(req.streamerId);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Session name is required.' });
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO stream_sessions (id, streamer_id, name, connection_status, created_at) VALUES (?, ?, ?, 'disconnected', ?)`
  ).run(id, req.streamerId, name.trim(), now);
  logActivity(id, 'session', `🆕 Session created: ${name.trim()}`, req.streamerId);
  res.json(db.prepare('SELECT * FROM stream_sessions WHERE id = ?').get(id));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM stream_sessions WHERE id = ? AND streamer_id = ?').get(req.params.id, req.streamerId);
  if (!row) return res.status(404).json({ error: 'Session not found.' });
  res.json(row);
});

router.patch('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM stream_sessions WHERE id = ? AND streamer_id = ?').get(req.params.id, req.streamerId);
  if (!row) return res.status(404).json({ error: 'Session not found.' });

  const { cocTrackingEnabled, voteCommand } = req.body || {};
  const updates = {};
  if (cocTrackingEnabled !== undefined) updates.coc_tracking_enabled = cocTrackingEnabled ? 1 : 0;
  if (voteCommand !== undefined && voteCommand.trim()) updates.vote_command = voteCommand.trim();

  const keys = Object.keys(updates);
  if (keys.length) {
    db.prepare(`UPDATE stream_sessions SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(
      ...keys.map((k) => updates[k]),
      row.id
    );
  }
  res.json(db.prepare('SELECT * FROM stream_sessions WHERE id = ?').get(row.id));
});

// Clears live participant data but keeps winner history (draws reference
// giveaways, not raw participant rows that disappear here), matching how
// a streamer resets between stream days without losing past winners.
router.post('/:id/clear', (req, res) => {
  const row = db.prepare('SELECT * FROM stream_sessions WHERE id = ? AND streamer_id = ?').get(req.params.id, req.streamerId);
  if (!row) return res.status(404).json({ error: 'Session not found.' });
  if (req.body?.confirm !== 'CLEAR') return res.status(400).json({ error: 'Confirmation required.' });

  db.prepare('DELETE FROM participants WHERE session_id = ?').run(row.id);
  db.prepare('DELETE FROM duplicate_attempts WHERE session_id = ?').run(row.id);
  logActivity(row.id, 'session', '🧹 Participant list cleared (winner history kept)', req.streamerId);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM stream_sessions WHERE id = ? AND streamer_id = ?').get(req.params.id, req.streamerId);
  if (!row) return res.status(404).json({ error: 'Session not found.' });
  db.prepare("UPDATE stream_sessions SET connection_status = 'archived', ended_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    row.id
  );
  res.json({ success: true });
});

module.exports = router;
