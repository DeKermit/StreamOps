// services/activityLog.js
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

let broadcastFn = null;
// socket.js registers itself here at startup to avoid a require() cycle
// between activityLog <-> socket <-> routes <-> activityLog.
function setBroadcaster(fn) {
  broadcastFn = fn;
}

function logActivity(sessionId, type, message, streamerId) {
  const id = uuidv4();
  const timestamp = new Date().toISOString();
  db.prepare(
    `INSERT INTO activity_log (id, session_id, streamer_id, type, message, timestamp) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, sessionId || null, streamerId || null, type, message, timestamp);

  if (broadcastFn && sessionId) {
    broadcastFn(sessionId, { id, type, message, timestamp });
  }
  return { id, type, message, timestamp };
}

function recentActivity(sessionId, limit = 50) {
  return db
    .prepare('SELECT * FROM activity_log WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?')
    .all(sessionId, limit);
}

module.exports = { logActivity, recentActivity, setBroadcaster };
