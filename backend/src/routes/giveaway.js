// routes/giveaway.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const db = require('../database/db');
const requireAuth = require('../middleware/requireAuth');
const { eligiblePool, runDraw, setWinnerRole, listEntries, addManualEntry, removeEntry } = require('../services/giveawayService');
const { logActivity } = require('../services/activityLog');

router.use(requireAuth);

function ownGiveaway(req, id) {
  return db
    .prepare(
      `SELECT g.* FROM giveaways g WHERE g.id = ? AND g.streamer_id = ?`
    )
    .get(id, req.streamerId);
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM giveaways WHERE streamer_id = ? ORDER BY created_at DESC').all(req.streamerId);
  res.json(rows);
});

router.post('/', (req, res) => {
  const {
    sessionId,
    title,
    entryMode,
    keyword,
    winnerCount,
    backupCount,
    allowDuplicateWinners,
    brandAccent,
    prizeName,
    prizeDescription,
    prizeImageUrl,
  } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required.' });
  if (!['keyword', 'coc_tag', 'coc_user'].includes(entryMode)) return res.status(400).json({ error: 'Invalid entry mode.' });
  if (entryMode === 'keyword' && (!keyword || !keyword.trim())) {
    return res.status(400).json({ error: 'A keyword is required for keyword-entry giveaways.' });
  }
  const wc = Number(winnerCount);
  if (!Number.isInteger(wc) || wc < 1) return res.status(400).json({ error: 'Number of winners must be a positive integer.' });

  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO giveaways (id, streamer_id, session_id, title, entry_mode, keyword, winner_count, backup_count, allow_duplicate_winners, brand_accent, prize_name, prize_description, prize_image_url, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
  ).run(
    id,
    req.streamerId,
    sessionId || null,
    title.trim(),
    entryMode,
    entryMode === 'keyword' ? keyword.trim() : null,
    wc,
    Number(backupCount) || 0,
    allowDuplicateWinners ? 1 : 0,
    brandAccent || '#fbbf24',
    prizeName ? String(prizeName).trim() || null : null,
    prizeDescription ? String(prizeDescription).trim() || null : null,
    prizeImageUrl || null,
    now
  );
  if (sessionId) logActivity(sessionId, 'giveaway', `🎁 Giveaway created: "${title.trim()}"`, req.streamerId);
  res.json(db.prepare('SELECT * FROM giveaways WHERE id = ?').get(id));
});

router.get('/:id', (req, res) => {
  const giveaway = ownGiveaway(req, req.params.id);
  if (!giveaway) return res.status(404).json({ error: 'Giveaway not found.' });
  res.json(giveaway);
});

// Editable fields on an already-created giveaway. Entry mode/keyword are
// deliberately excluded - changing those after entries have already come
// in from chat would make the eligible pool inconsistent with what viewers
// were told, so those stay fixed at creation time (delete-and-recreate for
// that case).
const PATCHABLE_FIELDS = {
  title: (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined),
  winnerCount: (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 ? ['winner_count', n] : undefined;
  },
  backupCount: (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 ? ['backup_count', n] : undefined;
  },
  allowDuplicateWinners: (v) => ['allow_duplicate_winners', v ? 1 : 0],
  brandAccent: (v) => (typeof v === 'string' && v ? ['brand_accent', v] : undefined),
  prizeName: (v) => ['prize_name', v != null ? String(v).trim() || null : null],
  prizeDescription: (v) => ['prize_description', v != null ? String(v).trim() || null : null],
  prizeImageUrl: (v) => ['prize_image_url', v || null],
};

router.patch('/:id', (req, res) => {
  const giveaway = ownGiveaway(req, req.params.id);
  if (!giveaway) return res.status(404).json({ error: 'Giveaway not found.' });

  const sets = [];
  const values = [];
  for (const [field, coerce] of Object.entries(PATCHABLE_FIELDS)) {
    if (req.body[field] === undefined) continue;
    let result = coerce(req.body[field]);
    if (result === undefined) continue;
    const [column, value] = Array.isArray(result) ? result : [field.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`), result];
    sets.push(`${column} = ?`);
    values.push(value);
  }
  if (!sets.length) return res.json(giveaway);

  values.push(giveaway.id);
  db.prepare(`UPDATE giveaways SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  res.json(db.prepare('SELECT * FROM giveaways WHERE id = ?').get(giveaway.id));
});

router.get('/:id/eligible-count', (req, res) => {
  const giveaway = ownGiveaway(req, req.params.id);
  if (!giveaway) return res.status(404).json({ error: 'Giveaway not found.' });
  const pool = eligiblePool(giveaway);
  const groupKeys = new Set(pool.map((p) => p.groupKey));
  res.json({
    entry_mode: giveaway.entry_mode,
    total_entries: pool.length,
    eligible_count: giveaway.entry_mode === 'keyword' ? pool.length : groupKeys.size,
  });
});

// Full eligible list - both the manually-manageable keyword entries and
// the (read-only here, edited from Tag Manager) CoC participant pool.
router.get('/:id/entries', (req, res) => {
  const giveaway = ownGiveaway(req, req.params.id);
  if (!giveaway) return res.status(404).json({ error: 'Giveaway not found.' });

  if (giveaway.entry_mode === 'keyword') {
    return res.json({ entry_mode: 'keyword', editable: true, entries: listEntries(giveaway.id) });
  }
  const pool = eligiblePool(giveaway);
  res.json({ entry_mode: giveaway.entry_mode, editable: false, entries: pool });
});

router.post('/:id/entries', (req, res) => {
  const giveaway = ownGiveaway(req, req.params.id);
  if (!giveaway) return res.status(404).json({ error: 'Giveaway not found.' });
  const { displayName, channelId } = req.body || {};
  if (!displayName || !displayName.trim()) return res.status(400).json({ error: 'A name is required.' });

  try {
    const entry = addManualEntry(giveaway, displayName, channelId);
    res.json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id/entries/:entryId', (req, res) => {
  const giveaway = ownGiveaway(req, req.params.id);
  if (!giveaway) return res.status(404).json({ error: 'Giveaway not found.' });
  try {
    res.json(removeEntry(giveaway, req.params.entryId));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/:id/draw', (req, res) => {
  const giveaway = ownGiveaway(req, req.params.id);
  if (!giveaway) return res.status(404).json({ error: 'Giveaway not found.' });
  try {
    const draw = runDraw(giveaway);
    res.json(draw);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/draws', (req, res) => {
  const giveaway = ownGiveaway(req, req.params.id);
  if (!giveaway) return res.status(404).json({ error: 'Giveaway not found.' });
  const draws = db.prepare('SELECT * FROM draws WHERE giveaway_id = ? ORDER BY draw_number DESC').all(giveaway.id);
  res.json(
    draws.map((d) => ({
      ...d,
      winner_entry_ids: JSON.parse(d.winner_entry_ids),
      backup_entry_ids: JSON.parse(d.backup_entry_ids),
      winner_status: JSON.parse(d.winner_status),
    }))
  );
});

router.patch('/:id/draws/:drawId/:entryId', (req, res) => {
  const giveaway = ownGiveaway(req, req.params.id);
  if (!giveaway) return res.status(404).json({ error: 'Giveaway not found.' });
  const { role } = req.body || {};
  if (!['accepted', 'rejected'].includes(role)) return res.status(400).json({ error: 'Role must be accepted or rejected.' });

  try {
    const draw = setWinnerRole(req.params.drawId, req.params.entryId, role);
    res.json({
      ...draw,
      winner_entry_ids: JSON.parse(draw.winner_entry_ids),
      backup_entry_ids: JSON.parse(draw.backup_entry_ids),
      winner_status: JSON.parse(draw.winner_status),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const giveaway = ownGiveaway(req, req.params.id);
  if (!giveaway) return res.status(404).json({ error: 'Giveaway not found.' });
  db.prepare('DELETE FROM draws WHERE giveaway_id = ?').run(giveaway.id);
  db.prepare('DELETE FROM entries WHERE giveaway_id = ?').run(giveaway.id);
  db.prepare('DELETE FROM giveaways WHERE id = ?').run(giveaway.id);
  res.json({ success: true });
});

// Public (no auth) - just enough data for the OBS draw-reveal overlay.
// Mounted separately in server.js at /api/public/giveaway/:id
const publicRouter = express.Router();
publicRouter.get('/:id', (req, res) => {
  const giveaway = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(req.params.id);
  if (!giveaway) return res.status(404).json({ error: 'Giveaway not found.' });
  const draws = db.prepare('SELECT * FROM draws WHERE giveaway_id = ? ORDER BY draw_number DESC LIMIT 1').all(giveaway.id);
  const latestDraw = draws[0]
    ? {
        ...draws[0],
        winner_entry_ids: JSON.parse(draws[0].winner_entry_ids),
        backup_entry_ids: JSON.parse(draws[0].backup_entry_ids),
        winner_status: JSON.parse(draws[0].winner_status),
      }
    : null;
  res.json({ giveaway, latestDraw });
});

module.exports = router;
module.exports.publicRouter = publicRouter;
