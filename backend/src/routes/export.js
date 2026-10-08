// routes/export.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const requireAuth = require('../middleware/requireAuth');

router.use(requireAuth);

function ownSession(req, sessionId) {
  return db.prepare('SELECT * FROM stream_sessions WHERE id = ? AND streamer_id = ?').get(sessionId, req.streamerId);
}

function toCsv(rows, columns) {
  const header = columns.join(',');
  const lines = rows.map((r) =>
    columns
      .map((c) => {
        const v = r[c] ?? '';
        return `"${String(v).replace(/"/g, '""')}"`;
      })
      .join(',')
  );
  return [header, ...lines].join('\n');
}

function send(res, filename, body, contentType) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(body);
}

router.get('/participants', (req, res) => {
  const { sessionId, format, filter } = req.query;
  if (!sessionId || !ownSession(req, sessionId)) return res.status(404).json({ error: 'Session not found.' });

  let sql = 'SELECT * FROM participants WHERE session_id = ?';
  const params = [sessionId];
  if (filter === 'confirmed') sql += " AND status = 'confirmed'";
  else if (filter === 'pending') sql += " AND status = 'pending'";
  sql += ' ORDER BY detected_at ASC';
  const rows = db.prepare(sql).all(...params);

  if (format === 'json') return send(res, `participants-${filter || 'all'}.json`, JSON.stringify(rows, null, 2), 'application/json');
  send(
    res,
    `participants-${filter || 'all'}.csv`,
    toCsv(rows, ['youtube_username', 'normalized_player_tag', 'status', 'detected_at', 'confirmed_at']),
    'text/csv'
  );
});

router.get('/giveaway-winners/:giveawayId', (req, res) => {
  const giveaway = db.prepare('SELECT * FROM giveaways WHERE id = ? AND streamer_id = ?').get(req.params.giveawayId, req.streamerId);
  if (!giveaway) return res.status(404).json({ error: 'Giveaway not found.' });

  const draws = db.prepare('SELECT * FROM draws WHERE giveaway_id = ? ORDER BY draw_number ASC').all(giveaway.id);
  const rows = [];
  for (const d of draws) {
    JSON.parse(d.winner_entry_ids).forEach((w, i) => {
      rows.push({ draw_number: d.draw_number, role: `winner_${i + 1}`, label: w.label, timestamp: d.timestamp });
    });
    JSON.parse(d.backup_entry_ids).forEach((w, i) => {
      rows.push({ draw_number: d.draw_number, role: `backup_${i + 1}`, label: w.label, timestamp: d.timestamp });
    });
  }

  if (req.query.format === 'json') return send(res, 'winners.json', JSON.stringify(rows, null, 2), 'application/json');
  send(res, 'winners.csv', toCsv(rows, ['draw_number', 'role', 'label', 'timestamp']), 'text/csv');
});

module.exports = router;
