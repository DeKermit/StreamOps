// routes/alerts.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const requireAuth = require('../middleware/requireAuth');
const alertService = require('../services/alertService');

router.use(requireAuth);

function ownSession(req, sessionId) {
  return db.prepare('SELECT * FROM stream_sessions WHERE id = ? AND streamer_id = ?').get(sessionId, req.streamerId);
}

router.get('/config', (req, res) => {
  res.json(alertService.getAlertConfig(req.streamerId));
});

router.put('/config', (req, res) => {
  res.json(alertService.saveAlertConfig(req.streamerId, req.body || {}));
});

router.get('/', (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId || !ownSession(req, sessionId)) return res.status(404).json({ error: 'Session not found.' });
  res.json(alertService.recentAlerts(sessionId));
});

router.post('/test', (req, res) => {
  const { sessionId, type } = req.body || {};
  if (!sessionId || !ownSession(req, sessionId)) return res.status(404).json({ error: 'Session not found.' });
  const messages = {
    member: ['⭐ TestViewer just became a member!', null, null],
    super_chat: ['💰 TestViewer sent a Super Chat', 'Great stream!', '$5.00'],
    super_sticker: ['🎉 TestViewer sent a Super Sticker', null, '$2.00'],
    gift_membership: ['🎁 TestViewer gifted 5 memberships!', null, null],
    test: ['🔔 This is a test alert', null, null],
  };
  const [title, message, amount] = messages[type] || messages.test;
  res.json(alertService.triggerAlert(sessionId, type || 'test', title, message, amount));
});

module.exports = router;
