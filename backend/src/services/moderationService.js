// services/moderationService.js
// Detect-and-log moderation. An API-key-only YouTube connection cannot
// delete messages or time out/ban users on YouTube itself - that
// requires OAuth with channel-moderator scope, which this tool does not
// request. What this gives a streamer is a live flagged-message feed
// they (or a human mod) can act on manually in YouTube Studio or chat.
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { logActivity } = require('./activityLog');

let broadcastFn = null;
function setBroadcaster(fn) {
  broadcastFn = fn;
}

const LINK_REGEX = /(https?:\/\/|www\.)\S+/i;

function getModSettings(sessionId) {
  const row = db.prepare('SELECT * FROM mod_settings WHERE session_id = ?').get(sessionId);
  if (!row) {
    return { session_id: sessionId, banned_words: [], auto_flag_links: true, auto_flag_caps: false };
  }
  return { ...row, banned_words: JSON.parse(row.banned_words) };
}

function saveModSettings(sessionId, { bannedWords, autoFlagLinks, autoFlagCaps }) {
  const existing = db.prepare('SELECT session_id FROM mod_settings WHERE session_id = ?').get(sessionId);
  const payload = [JSON.stringify(bannedWords || []), autoFlagLinks ? 1 : 0, autoFlagCaps ? 1 : 0];
  if (existing) {
    db.prepare('UPDATE mod_settings SET banned_words = ?, auto_flag_links = ?, auto_flag_caps = ? WHERE session_id = ?').run(
      ...payload,
      sessionId
    );
  } else {
    db.prepare(
      'INSERT INTO mod_settings (session_id, banned_words, auto_flag_links, auto_flag_caps) VALUES (?, ?, ?, ?)'
    ).run(sessionId, ...payload);
  }
  return getModSettings(sessionId);
}

function isMostlyCaps(message) {
  const letters = message.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 8) return false;
  const upper = letters.replace(/[^A-Z]/g, '');
  return upper.length / letters.length > 0.7;
}

function flagMessage(sessionId, author, channelId, message, reason) {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO mod_flags (id, session_id, author, channel_id, message, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`
  ).run(id, sessionId, author, channelId || null, message, reason, now);

  logActivity(sessionId, 'mod_flag', `🚩 Flagged @${author}: ${reason}`);
  const payload = { id, session_id: sessionId, author, channel_id: channelId, message, reason, status: 'open', created_at: now };
  if (broadcastFn) broadcastFn(sessionId, payload);
  return payload;
}

function scanMessage(sessionId, author, channelId, message) {
  const settings = getModSettings(sessionId);

  for (const word of settings.banned_words) {
    if (!word) continue;
    const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(message)) {
      return flagMessage(sessionId, author, channelId, message, `Banned word: "${word}"`);
    }
  }
  if (settings.auto_flag_links && LINK_REGEX.test(message)) {
    return flagMessage(sessionId, author, channelId, message, 'Contains a link');
  }
  if (settings.auto_flag_caps && isMostlyCaps(message)) {
    return flagMessage(sessionId, author, channelId, message, 'Excessive caps');
  }
  return null;
}

function listFlags(sessionId, status) {
  if (status && status !== 'all') {
    return db.prepare('SELECT * FROM mod_flags WHERE session_id = ? AND status = ? ORDER BY created_at DESC').all(sessionId, status);
  }
  return db.prepare('SELECT * FROM mod_flags WHERE session_id = ? ORDER BY created_at DESC').all(sessionId);
}

function setFlagStatus(id, status) {
  db.prepare('UPDATE mod_flags SET status = ? WHERE id = ?').run(status, id);
  return db.prepare('SELECT * FROM mod_flags WHERE id = ?').get(id);
}

module.exports = { getModSettings, saveModSettings, scanMessage, listFlags, setFlagStatus, setBroadcaster };
