// routes/analytics.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const requireAuth = require('../middleware/requireAuth');
const { chatActivity, sessionSummary } = require('../services/analyticsService');

router.use(requireAuth);

function ownSession(req, sessionId) {
  return db.prepare('SELECT * FROM stream_sessions WHERE id = ? AND streamer_id = ?').get(sessionId, req.streamerId);
}

router.get('/chat-activity', (req, res) => {
  const { sessionId, minutes } = req.query;
  if (!sessionId || !ownSession(req, sessionId)) return res.status(404).json({ error: 'Session not found.' });
  res.json(chatActivity(sessionId, Number(minutes) || 60));
});

router.get('/summary', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId || !ownSession(req, sessionId)) return res.status(404).json({ error: 'Session not found.' });
  res.json(sessionSummary(sessionId));
});

module.exports = router;
