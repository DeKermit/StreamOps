// services/tagDetector.js
// Clash of Clans player tags use a 14-character alphabet chosen by
// Supercell specifically to avoid visually-confusable characters
// (no O/0 ambiguity, no I/1 ambiguity, etc).
const VALID_CHARS = '0289PYLQGRJCUV';
const TAG_BODY = `[${VALID_CHARS}]{3,9}`;
const TAG_REGEX = new RegExp(`#(${TAG_BODY})`, 'gi');

function isValidTagFormat(candidate) {
  if (!candidate) return false;
  const body = candidate.replace(/^#/, '').toUpperCase();
  return new RegExp(`^${TAG_BODY}$`).test(body);
}

function normalizeTag(candidate) {
  if (!candidate) return null;
  const body = candidate.replace(/^#/, '').trim().toUpperCase();
  if (!new RegExp(`^${TAG_BODY}$`).test(body)) return null;
  return `#${body}`;
}

// Extracts every candidate tag from a chat message. A message can
// contain more than one tag; each is returned independently.
function extractTags(message) {
  if (!message) return [];
  const matches = [...message.matchAll(TAG_REGEX)];
  return matches.map((m) => `#${m[1].toUpperCase()}`);
}

module.exports = { VALID_CHARS, isValidTagFormat, normalizeTag, extractTags };
