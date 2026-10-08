// server.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const { initSocket } = require('./websocket/socket');

const PORT = process.env.PORT || 4200;

const app = express();
app.use(cors());
// Raised from the default 100kb so a base64-encoded profile picture or
// giveaway prize image (sent as a plain JSON field - there's no
// multipart/multer middleware installed) doesn't get rejected outright.
app.use(express.json({ limit: '8mb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/session', require('./routes/session'));
app.use('/api/youtube', require('./routes/youtube'));
app.use('/api/participants', require('./routes/participants'));
app.use('/api/giveaway', require('./routes/giveaway'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/polls', require('./routes/polls'));
app.use('/api/moderation', require('./routes/moderation'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/export', require('./routes/export'));

// Public, no-auth endpoints consumed by OBS browser-source overlays and
// the draw-reveal tab - these only ever expose the minimum needed to
// render, never streamer account data.
app.use('/api/public/giveaway', require('./routes/giveaway').publicRouter);
app.use('/api/public/poll', require('./routes/polls').publicRouter);

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'streamops-backend' }));

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`StreamOps backend running on http://localhost:${PORT}`);
});
