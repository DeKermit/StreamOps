// services/analyticsService.js
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

// Chat volume is bucketed to the minute as messages come in, so the
// analytics chart is just a GROUP BY away rather than a scan over raw
// rows every time the dashboard is open.
function bucketMinute(date) {
  return date.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
}

function logChatMessage(sessionId, author, channelId, message) {
  const now = new Date();
  db.prepare(
    `INSERT INTO chat_messages (id, session_id, author, channel_id, message, bucket_minute, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(uuidv4(), sessionId, author, channelId || null, message, bucketMinute(now), now.toISOString());
}

// Returns the last `minutes` worth of 1-minute buckets, zero-filled, so
// the chart always has a continuous x-axis even during quiet periods.
function chatActivity(sessionId, minutes = 60) {
  const rows = db
    .prepare(
      `SELECT bucket_minute, COUNT(*) as count FROM chat_messages
       WHERE session_id = ? GROUP BY bucket_minute ORDER BY bucket_minute ASC`
    )
    .all(sessionId);
  const map = new Map(rows.map((r) => [r.bucket_minute, r.count]));

  const result = [];
  const now = new Date();
  for (let i = minutes - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60000);
    const key = bucketMinute(d);
    result.push({ bucket: key, count: map.get(key) || 0 });
  }
  return result;
}

function sessionSummary(sessionId) {
  const totalMessages = db.prepare('SELECT COUNT(*) as n FROM chat_messages WHERE session_id = ?').get(sessionId).n;
  const uniqueChatters = db
    .prepare('SELECT COUNT(DISTINCT author) as n FROM chat_messages WHERE session_id = ?')
    .get(sessionId).n;
  const participants = db.prepare('SELECT COUNT(*) as n FROM participants WHERE session_id = ?').get(sessionId).n;
  const confirmed = db
    .prepare("SELECT COUNT(*) as n FROM participants WHERE session_id = ? AND status = 'confirmed'")
    .get(sessionId).n;
  const alerts = db.prepare('SELECT COUNT(*) as n FROM alert_events WHERE session_id = ?').get(sessionId).n;
  const flags = db.prepare("SELECT COUNT(*) as n FROM mod_flags WHERE session_id = ? AND status = 'open'").get(sessionId).n;
  const draws = db
    .prepare(
      `SELECT COUNT(*) as n FROM draws WHERE giveaway_id IN (SELECT id FROM giveaways WHERE session_id = ?)`
    )
    .get(sessionId).n;

  return { totalMessages, uniqueChatters, participants, confirmed, alerts, openFlags: flags, draws };
}

module.exports = { logChatMessage, chatActivity, sessionSummary };
