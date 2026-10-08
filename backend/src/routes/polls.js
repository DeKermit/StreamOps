// routes/polls.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const requireAuth = require('../middleware/requireAuth');
const pollService = require('../services/pollService');

router.use(requireAuth);

function ownSession(req, sessionId) {
  return db.prepare('SELECT * FROM stream_sessions WHERE id = ? AND streamer_id = ?').get(sessionId, req.streamerId);
}

router.get('/', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId || !ownSession(req, sessionId)) return res.status(404).json({ error: 'Session not found.' });
  res.json(pollService.listPolls(sessionId));
});

router.post('/', (req, res) => {
  const { sessionId, question, options } = req.body || {};
  if (!sessionId || !ownSession(req, sessionId)) return res.status(404).json({ error: 'Session not found.' });
  if (!question || !question.trim()) return res.status(400).json({ error: 'Question is required.' });
  const cleanOptions = (options || []).map((o) => o.trim()).filter(Boolean);
  if (cleanOptions.length < 2) return res.status(400).json({ error: 'At least 2 options are required.' });
  res.json(pollService.createPoll(sessionId, question.trim(), cleanOptions));
});

router.post('/:id/go-live', (req, res) => {
  try {
    res.json(pollService.setPollStatus(req.params.id, 'live'));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/close', (req, res) => {
  try {
    res.json(pollService.setPollStatus(req.params.id, 'closed'));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Public (no auth) - mounted at /api/public/poll/:sessionId for the OBS overlay.
const publicRouter = express.Router();
publicRouter.get('/:sessionId', (req, res) => {
  const poll = pollService.getLivePoll(req.params.sessionId);
  res.json(poll);
});

module.exports = router;
module.exports.publicRouter = publicRouter;
