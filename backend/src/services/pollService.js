// services/pollService.js
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { logActivity } = require('./activityLog');

let broadcastFn = null;
function setBroadcaster(fn) {
  broadcastFn = fn;
}

function createPoll(sessionId, question, options) {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO polls (id, session_id, question, options, status, created_at) VALUES (?, ?, ?, ?, 'draft', ?)`
  ).run(id, sessionId, question, JSON.stringify(options), now);
  return getPoll(id);
}

function getPoll(id) {
  const row = db.prepare('SELECT * FROM polls WHERE id = ?').get(id);
  if (!row) return null;
  return hydratePoll(row);
}

function hydratePoll(row) {
  const options = JSON.parse(row.options);
  const votes = db.prepare('SELECT option_index, COUNT(*) as count FROM poll_votes WHERE poll_id = ? GROUP BY option_index').all(row.id);
  const counts = options.map((_, i) => votes.find((v) => v.option_index === i)?.count || 0);
  const total = counts.reduce((a, b) => a + b, 0);
  return { ...row, options, counts, total_votes: total };
}

function listPolls(sessionId) {
  const rows = db.prepare('SELECT * FROM polls WHERE session_id = ? ORDER BY created_at DESC').all(sessionId);
  return rows.map(hydratePoll);
}

function getLivePoll(sessionId) {
  const row = db.prepare("SELECT * FROM polls WHERE session_id = ? AND status = 'live' ORDER BY created_at DESC LIMIT 1").get(sessionId);
  return row ? hydratePoll(row) : null;
}

function setPollStatus(id, status) {
  const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(id);
  if (!poll) throw new Error('Poll not found.');

  if (status === 'live') {
    // Only one live poll per session at a time - close any other live poll first.
    db.prepare("UPDATE polls SET status = 'closed', closed_at = ? WHERE session_id = ? AND status = 'live'").run(
      new Date().toISOString(),
      poll.session_id
    );
  }
  const closedAt = status === 'closed' ? new Date().toISOString() : null;
  db.prepare('UPDATE polls SET status = ?, closed_at = COALESCE(?, closed_at) WHERE id = ?').run(status, closedAt, id);

  logActivity(poll.session_id, 'poll', status === 'live' ? `📊 Poll went live: "${poll.question}"` : `📊 Poll closed: "${poll.question}"`);

  const updated = getPoll(id);
  if (broadcastFn) broadcastFn(poll.session_id, updated);
  return updated;
}

function recordVoteIfApplicable(sessionId, voteCommand, voterKey, message) {
  const poll = getLivePoll(sessionId);
  if (!poll) return null;

  const cmd = (voteCommand || '!vote').toLowerCase();
  const trimmed = message.trim().toLowerCase();
  if (!trimmed.startsWith(cmd)) return null;

  const rest = trimmed.slice(cmd.length).trim();
  const optionNumber = parseInt(rest, 10);
  if (!Number.isInteger(optionNumber) || optionNumber < 1 || optionNumber > poll.options.length) return null;

  const optionIndex = optionNumber - 1;
  const now = new Date().toISOString();
  try {
    // One vote per viewer per poll, enforced at the DB level (UNIQUE on
    // poll_id + voter_key). A repeat "!vote" just updates their choice.
    db.prepare('INSERT INTO poll_votes (id, poll_id, voter_key, option_index, voted_at) VALUES (?, ?, ?, ?, ?)').run(
      uuidv4(),
      poll.id,
      voterKey,
      optionIndex,
      now
    );
  } catch {
    db.prepare('UPDATE poll_votes SET option_index = ?, voted_at = ? WHERE poll_id = ? AND voter_key = ?').run(
      optionIndex,
      now,
      poll.id,
      voterKey
    );
  }

  const updated = getPoll(poll.id);
  if (broadcastFn) broadcastFn(sessionId, updated);
  return updated;
}

module.exports = { createPoll, getPoll, listPolls, getLivePoll, setPollStatus, recordVoteIfApplicable, setBroadcaster };
