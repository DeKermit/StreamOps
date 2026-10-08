// services/youtube.js
// Polls the official YouTube Data API v3 Live Chat endpoint. This only
// needs an API key (no OAuth), which is why it is read-only: it can see
// chat messages and the real event types YouTube reports (new member,
// super chat, super sticker, membership gifting) but it cannot take
// moderator actions (timeout/ban/delete) back on YouTube - that needs
// OAuth with broader channel-owner scopes, which is out of scope for a
// local, API-key-only tool. Moderation here is detect-and-log, not enforce.
const https = require('https');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { extractTags } = require('./tagDetector');
const { insertParticipant } = require('./participantService');
const { logActivity } = require('./activityLog');
const { triggerAlert } = require('./alertService');
const { scanMessage } = require('./moderationService');
const { recordVoteIfApplicable } = require('./pollService');
const { logChatMessage } = require('./analyticsService');
const { tryEnterKeywordGiveaways } = require('./giveawayService');

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const POLL_INTERVAL_MS = 4000;

const activePolls = new Map(); // sessionId -> { timer, pageToken, apiKey, liveChatId }

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(new Error(parsed?.error?.message || `YouTube API error (${res.statusCode})`));
            } else {
              resolve(parsed);
            }
          } catch (err) {
            reject(new Error('Failed to parse YouTube API response.'));
          }
        });
      })
      .on('error', reject);
  });
}

function extractVideoId(urlOrId) {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const patterns = [/[?&]v=([a-zA-Z0-9_-]{11})/, /youtu\.be\/([a-zA-Z0-9_-]{11})/, /live\/([a-zA-Z0-9_-]{11})/];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }
  return null;
}

async function resolveLiveChatId(videoId, apiKey) {
  const url = `${API_BASE}/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`;
  const data = await httpGetJson(url);
  const item = data.items && data.items[0];
  const chatId = item?.liveStreamingDetails?.activeLiveChatId;
  if (!chatId) {
    throw new Error('This video does not have an active live chat right now. Make sure the stream is live.');
  }
  return chatId;
}

function setStatus(sessionId, status) {
  db.prepare('UPDATE stream_sessions SET connection_status = ? WHERE id = ?').run(status, sessionId);
}

async function connect(sessionId, videoUrl, apiKey) {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) throw new Error('Could not find a valid YouTube video ID in that URL.');

  const liveChatId = await resolveLiveChatId(videoId, apiKey);

  db.prepare('UPDATE stream_sessions SET youtube_video_url = ?, youtube_live_chat_id = ? WHERE id = ?').run(
    videoUrl,
    liveChatId,
    sessionId
  );
  setStatus(sessionId, 'connected');
  logActivity(sessionId, 'connection', '🟢 Connected to YouTube Live Chat');

  activePolls.set(sessionId, { apiKey, liveChatId, pageToken: undefined, paused: false });
  scheduleNextPoll(sessionId, 0);
}

function disconnect(sessionId) {
  const entry = activePolls.get(sessionId);
  if (entry && entry.timer) clearTimeout(entry.timer);
  activePolls.delete(sessionId);
  setStatus(sessionId, 'disconnected');
  logActivity(sessionId, 'connection', '🔴 Disconnected from YouTube Live Chat');
}

function pause(sessionId) {
  const entry = activePolls.get(sessionId);
  if (!entry) return;
  entry.paused = true;
  setStatus(sessionId, 'paused');
  logActivity(sessionId, 'connection', '⏸ Chat collection paused');
}

function resume(sessionId) {
  const entry = activePolls.get(sessionId);
  if (!entry) return;
  entry.paused = false;
  setStatus(sessionId, 'connected');
  logActivity(sessionId, 'connection', '▶ Chat collection resumed');
}

function scheduleNextPoll(sessionId, delay) {
  const entry = activePolls.get(sessionId);
  if (!entry) return;
  entry.timer = setTimeout(() => pollOnce(sessionId), delay);
}

async function pollOnce(sessionId) {
  const entry = activePolls.get(sessionId);
  if (!entry) return;

  const session = db.prepare('SELECT * FROM stream_sessions WHERE id = ?').get(sessionId);
  if (!session) {
    activePolls.delete(sessionId);
    return;
  }

  if (entry.paused) {
    scheduleNextPoll(sessionId, POLL_INTERVAL_MS);
    return;
  }

  try {
    const params = new URLSearchParams({
      liveChatId: entry.liveChatId,
      part: 'snippet,authorDetails',
      key: entry.apiKey,
    });
    if (entry.pageToken) params.set('pageToken', entry.pageToken);

    const data = await httpGetJson(`${API_BASE}/liveChat/messages?${params.toString()}`);
    entry.pageToken = data.nextPageToken;

    for (const item of data.items || []) {
      handleChatItem(sessionId, session, item);
    }

    const nextDelay = Math.max(data.pollingIntervalMillis || POLL_INTERVAL_MS, 2000);
    scheduleNextPoll(sessionId, nextDelay);
  } catch (err) {
    logActivity(sessionId, 'error', `⚠️ YouTube polling error: ${err.message}`);
    scheduleNextPoll(sessionId, POLL_INTERVAL_MS * 2);
  }
}

function handleChatItem(sessionId, session, item) {
  const snippet = item.snippet || {};
  const author = item.authorDetails || {};
  const username = author.displayName || 'unknown';
  const channelId = author.channelId || null;

  // 1. Real YouTube platform events -> alerts (not fabricated: these are
  //    the actual event types the Live Chat API reports).
  if (snippet.type === 'newSponsorEvent') {
    triggerAlert(sessionId, 'member', `⭐ ${username} just became a member!`);
  } else if (snippet.type === 'superChatEvent') {
    const amount = snippet.superChatDetails?.amountDisplayString || '';
    triggerAlert(sessionId, 'super_chat', `💰 ${username} sent a Super Chat`, snippet.superChatDetails?.userComment, amount);
  } else if (snippet.type === 'superStickerEvent') {
    const amount = snippet.superStickerDetails?.amountDisplayString || '';
    triggerAlert(sessionId, 'super_sticker', `🎉 ${username} sent a Super Sticker`, null, amount);
  } else if (snippet.type === 'membershipGiftingEvent') {
    const count = snippet.membershipGiftingDetails?.giftMembershipsCount || 1;
    triggerAlert(sessionId, 'gift_membership', `🎁 ${username} gifted ${count} membership(s)!`);
  }

  const message = snippet.displayMessage || snippet.textMessageDetails?.messageText || '';
  if (!message) return;

  // 2. Analytics - every text message is logged for the chat-activity chart.
  logChatMessage(sessionId, username, channelId, message);

  // 3. Moderation - scan for banned words / links / excessive caps.
  scanMessage(sessionId, username, channelId, message);

  // 4. Polls - "!vote 2" style commands.
  recordVoteIfApplicable(sessionId, session.vote_command, channelId || username, message);

  // 5. Keyword giveaway entries.
  tryEnterKeywordGiveaways(sessionId, username, channelId, message);

  // 6. CoC tag tracking, only if this session has it turned on.
  if (session.coc_tracking_enabled) {
    const tags = extractTags(message);
    for (const tag of tags) {
      insertParticipant({
        sessionId,
        youtubeUsername: username,
        youtubeChannelId: channelId,
        rawTag: tag,
        status: 'pending',
        source: 'chat',
      });
    }
  }
}

function getConnectionStatus(sessionId) {
  const entry = activePolls.get(sessionId);
  const session = db.prepare('SELECT connection_status FROM stream_sessions WHERE id = ?').get(sessionId);
  return {
    status: session?.connection_status || 'disconnected',
    paused: entry ? entry.paused : false,
  };
}

module.exports = { connect, disconnect, pause, resume, getConnectionStatus, extractVideoId };
