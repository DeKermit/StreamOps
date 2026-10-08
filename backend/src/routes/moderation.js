// routes/moderation.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const requireAuth = require('../middleware/requireAuth');
const moderationService = require('../services/moderationService');

router.use(requireAuth);

function ownSession(req, sessionId) {
  return db.prepare('SELECT * FROM stream_sessions WHERE id = ? AND streamer_id = ?').get(sessionId, req.streamerId);
}

router.get('/settings', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId || !ownSession(req, sessionId)) return res.status(404).json({ error: 'Session not found.' });
  res.json(moderationService.getModSettings(sessionId));
});

router.put('/settings', (req, res) => {
  const { sessionId, bannedWords, autoFlagLinks, autoFlagCaps } = req.body || {};
  if (!sessionId || !ownSession(req, sessionId)) return res.status(404).json({ error: 'Session not found.' });
  res.json(moderationService.saveModSettings(sessionId, { bannedWords, autoFlagLinks, autoFlagCaps }));
});

router.get('/flags', (req, res) => {
  const { sessionId, status } = req.query;
  if (!sessionId || !ownSession(req, sessionId)) return res.status(404).json({ error: 'Session not found.' });
  res.json(moderationService.listFlags(sessionId, status));
});

router.patch('/flags/:id', (req, res) => {
  const { status } = req.body || {};
  if (!['open', 'dismissed', 'actioned'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  res.json(moderationService.setFlagStatus(req.params.id, status));
});

module.exports = router;
