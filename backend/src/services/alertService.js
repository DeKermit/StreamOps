// services/alertService.js
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { logActivity } = require('./activityLog');

let broadcastFn = null;
function setBroadcaster(fn) {
  broadcastFn = fn;
}

const DEFAULT_CONFIG = {
  enabled: { member: true, super_chat: true, super_sticker: true, gift_membership: true, test: true },
  sound_enabled: true,
  display_seconds: 6,
  accent_color: '#8b5cf6',
};

function getAlertConfig(streamerId) {
  const row = db.prepare('SELECT config FROM alert_configs WHERE streamer_id = ?').get(streamerId);
  if (!row) return DEFAULT_CONFIG;
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(row.config) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveAlertConfig(streamerId, config) {
  const merged = { ...DEFAULT_CONFIG, ...config };
  const existing = db.prepare('SELECT streamer_id FROM alert_configs WHERE streamer_id = ?').get(streamerId);
  if (existing) {
    db.prepare('UPDATE alert_configs SET config = ? WHERE streamer_id = ?').run(JSON.stringify(merged), streamerId);
  } else {
    db.prepare('INSERT INTO alert_configs (streamer_id, config) VALUES (?, ?)').run(streamerId, JSON.stringify(merged));
  }
  return merged;
}

function triggerAlert(sessionId, type, title, message, amount) {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO alert_events (id, session_id, type, title, message, amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, sessionId, type, title, message || null, amount || null, now);

  logActivity(sessionId, 'alert', title);

  const payload = { id, type, title, message: message || null, amount: amount || null, created_at: now };
  if (broadcastFn) broadcastFn(sessionId, payload);
  return payload;
}

function recentAlerts(sessionId, limit = 30) {
  return db.prepare('SELECT * FROM alert_events WHERE session_id = ? ORDER BY created_at DESC LIMIT ?').all(sessionId, limit);
}

module.exports = { getAlertConfig, saveAlertConfig, triggerAlert, recentAlerts, setBroadcaster, DEFAULT_CONFIG };
