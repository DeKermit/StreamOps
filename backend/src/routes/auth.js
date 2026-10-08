// routes/auth.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../database/db');
const { hashPassword, verifyPassword, signToken, publicStreamerProfile } = require('../security/auth');
const requireAuth = require('../middleware/requireAuth');

router.post('/register', (req, res) => {
  const { email, password, displayName, brandName } = req.body || {};
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'Email, password, and display name are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  const existing = db.prepare('SELECT id FROM streamers WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO streamers (id, email, password_hash, display_name, brand_name, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, email.toLowerCase(), hashPassword(password), displayName, brandName || displayName, now);

  const streamer = db.prepare('SELECT * FROM streamers WHERE id = ?').get(id);
  const token = signToken(streamer);
  res.json({ token, streamer: publicStreamerProfile(streamer) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const streamer = db.prepare('SELECT * FROM streamers WHERE email = ?').get(email.toLowerCase());
  if (!streamer || !verifyPassword(password, streamer.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  const token = signToken(streamer);
  res.json({ token, streamer: publicStreamerProfile(streamer) });
});

router.get('/me', requireAuth, (req, res) => {
  const streamer = db.prepare('SELECT * FROM streamers WHERE id = ?').get(req.streamerId);
  if (!streamer) return res.status(404).json({ error: 'Account not found.' });
  res.json(publicStreamerProfile(streamer));
});

// Every field the client is allowed to update lives in this one array.
// A new theme/branding field added to the frontend MUST be added here too,
// or the save will silently no-op and the UI will look like it "reset".
const UPDATABLE_FIELDS = ['display_name', 'brand_name', 'theme_preset', 'dashboard_theme', 'youtube_api_key', 'avatar_url'];

router.put('/me', requireAuth, (req, res) => {
  const updates = {};
  for (const field of UPDATABLE_FIELDS) {
    if (req.body[field] !== undefined) {
      updates[field] = field === 'dashboard_theme' ? JSON.stringify(req.body[field]) : req.body[field];
    }
  }
  const keys = Object.keys(updates);
  if (keys.length) {
    db.prepare(`UPDATE streamers SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(
      ...keys.map((k) => updates[k]),
      req.streamerId
    );
  }
  const streamer = db.prepare('SELECT * FROM streamers WHERE id = ?').get(req.streamerId);
  res.json(publicStreamerProfile(streamer));
});

module.exports = router;
