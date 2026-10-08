// services/drawEngine.js
const crypto = require('crypto');

// Cryptographically secure shuffle (Fisher-Yates using crypto.randomInt,
// never Math.random). This is the one place in the whole app where
// "random" has to actually mean unpredictable, not merely well-distributed.
function secureShuffle(array) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// pool: array of { id, label, groupKey } where groupKey is the identity
// used for "one winner per X" de-duplication (e.g. a YouTube channel id).
// mode: 'independent' (every pool item can win, duplicates across
//        winners only prevented by allowDuplicates) or 'per_group'
//        (collapse the pool to one entry per groupKey before drawing,
//        so one winner per person even if they have multiple entries/tags).
function drawWinners(pool, winnerCount, backupCount, { mode = 'independent', allowDuplicates = false } = {}) {
  if (!Number.isInteger(winnerCount) || winnerCount < 1) {
    throw new Error('Number of winners must be a positive integer.');
  }
  if (!Number.isInteger(backupCount) || backupCount < 0) {
    throw new Error('Number of backup winners must be zero or a positive integer.');
  }

  let effectivePool = pool;
  if (mode === 'per_group') {
    const seen = new Set();
    effectivePool = [];
    for (const item of pool) {
      const key = item.groupKey || item.id;
      if (seen.has(key)) continue;
      seen.add(key);
      effectivePool.push(item);
    }
  }

  const poolSize = effectivePool.length;

  if (!allowDuplicates && poolSize < winnerCount) {
    throw new Error(`Not enough eligible entries (${poolSize}) for ${winnerCount} winner(s).`);
  }
  if (poolSize === 0) {
    throw new Error('There are no eligible entries to draw from.');
  }

  const shuffled = secureShuffle(effectivePool);

  let winners, backups;
  if (allowDuplicates) {
    // With duplicates allowed we draw each winner independently from the
    // full pool (still via a fresh secure shuffle per draw) rather than
    // consuming from one shuffled list, so the same entry legitimately
    // can win more than once.
    winners = Array.from({ length: winnerCount }, () => {
      const idx = crypto.randomInt(0, poolSize);
      return effectivePool[idx];
    });
    backups = Array.from({ length: backupCount }, () => {
      const idx = crypto.randomInt(0, poolSize);
      return effectivePool[idx];
    });
  } else {
    winners = shuffled.slice(0, winnerCount);
    backups = shuffled.slice(winnerCount, winnerCount + backupCount);
  }

  return { poolSize, winners, backups };
}

module.exports = { secureShuffle, drawWinners };
