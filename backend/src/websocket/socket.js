// websocket/socket.js
const { Server } = require('socket.io');
const activityLog = require('../services/activityLog');
const alertService = require('../services/alertService');
const moderationService = require('../services/moderationService');
const pollService = require('../services/pollService');
const db = require('../database/db');
const { sessionSummary } = require('../services/analyticsService');

let io = null;

function roomName(sessionId) {
  return `session:${sessionId}`;
}

function initSocket(server) {
  io = new Server(server, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    socket.on('join', (sessionId) => {
      if (sessionId) socket.join(roomName(sessionId));
    });
    socket.on('leave', (sessionId) => {
      if (sessionId) socket.leave(roomName(sessionId));
    });
  });

  // Each service broadcasts a different event name on the same
  // per-session room, so the frontend can subscribe to exactly what it needs.
  activityLog.setBroadcaster((sessionId, entry) => io.to(roomName(sessionId)).emit('activity', entry));
  alertService.setBroadcaster((sessionId, alert) => io.to(roomName(sessionId)).emit('alert', alert));
  moderationService.setBroadcaster((sessionId, flag) => io.to(roomName(sessionId)).emit('mod_flag', flag));
  pollService.setBroadcaster((sessionId, poll) => io.to(roomName(sessionId)).emit('poll', poll));

  return io;
}

function broadcastParticipants(sessionId) {
  if (!io) return;
  io.to(roomName(sessionId)).emit('participants_changed');
}

function broadcastStats(sessionId) {
  if (!io) return;
  const stats = computeStats(sessionId);
  io.to(roomName(sessionId)).emit('stats', stats);
}

function computeStats(sessionId) {
  const total = db.prepare('SELECT COUNT(*) as n FROM participants WHERE session_id = ?').get(sessionId).n;
  const pending = db.prepare("SELECT COUNT(*) as n FROM participants WHERE session_id = ? AND status = 'pending'").get(sessionId).n;
  const confirmed = db.prepare("SELECT COUNT(*) as n FROM participants WHERE session_id = ? AND status = 'confirmed'").get(sessionId).n;
  const duplicates = db.prepare('SELECT COUNT(*) as n FROM duplicate_attempts WHERE session_id = ?').get(sessionId).n;
  const uniqueUsers = db.prepare('SELECT COUNT(DISTINCT youtube_username) as n FROM participants WHERE session_id = ?').get(sessionId).n;
  return { total, pending, confirmed, duplicates, uniqueUsers, ...sessionSummary(sessionId) };
}

module.exports = { initSocket, broadcastParticipants, broadcastStats, computeStats, roomName };
