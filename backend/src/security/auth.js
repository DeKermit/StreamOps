// security/auth.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// In a real deployment this should come from an environment variable.
// For a local, single-user, one-click desktop app this is acceptable;
// the server only ever listens on localhost.
const JWT_SECRET = process.env.STREAMOPS_JWT_SECRET || 'streamops-local-dev-secret-change-me';

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function signToken(streamer) {
  return jwt.sign({ sub: streamer.id, email: streamer.email }, JWT_SECRET, { expiresIn: '30d' });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Fields that are safe to send to the client. Never leak password_hash.
// IMPORTANT: any new streamer column the client needs to read back
// (e.g. a new theme field) MUST be added here, or it will appear to
// "reset" after every save even though it is stored correctly.
function publicStreamerProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    brand_name: row.brand_name,
    theme_preset: row.theme_preset || 'streamelements_dark',
    dashboard_theme: row.dashboard_theme ? JSON.parse(row.dashboard_theme) : null,
    has_youtube_api_key: !!row.youtube_api_key,
    avatar_url: row.avatar_url || null,
    created_at: row.created_at,
  };
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, publicStreamerProfile };
