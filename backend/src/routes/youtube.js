// routes/youtube.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const requireAuth = require('../middleware/requireAuth');
const youtube = require('../services/youtube');

router.use(requireAuth);

function ownSession(req) {
  return db.prepare('SELECT * FROM stream_sessions WHERE id = ? AND streamer_id = ?').get(req.body.sessionId || req.query.sessionId, req.streamerId);
}

router.post('/connect', async (req, res) => {
  const session = ownSession(req);
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  const { videoUrl } = req.body || {};
  if (!videoUrl) return res.status(400).json({ error: 'A video URL is required.' });

  // Use a freshly-pasted key if given, otherwise fall back to the key
  // saved on the account in Settings - that's the whole point of saving
  // it there, so a session shouldn't force it to be retyped every time.
  let apiKey = req.body.apiKey;
  if (!apiKey) {
    const streamer = db.prepare('SELECT youtube_api_key FROM streamers WHERE id = ?').get(req.streamerId);
    apiKey = streamer?.youtube_api_key;
  }
  if (!apiKey) {
    return res.status(400).json({ error: 'No YouTube API key provided, and none is saved in Settings. Paste one here or save one in Settings first.' });
  }

  try {
    await youtube.connect(session.id, videoUrl, apiKey);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/disconnect', (req, res) => {
  const session = ownSession(req);
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  youtube.disconnect(session.id);
  res.json({ success: true });
});

router.post('/pause', (req, res) => {
  const session = ownSession(req);
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  youtube.pause(session.id);
  res.json({ success: true });
});

router.post('/resume', (req, res) => {
  const session = ownSession(req);
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  youtube.resume(session.id);
  res.json({ success: true });
});

router.get('/status/:sessionId', (req, res) => {
  const session = db
    .prepare('SELECT * FROM stream_sessions WHERE id = ? AND streamer_id = ?')
    .get(req.params.sessionId, req.streamerId);
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  res.json(youtube.getConnectionStatus(session.id));
});

module.exports = router;
