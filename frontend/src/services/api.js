// services/api.js
const BASE_URL = 'http://localhost:4200/api';

function getToken() {
  return localStorage.getItem('streamops_token');
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no JSON body */
  }
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  // auth -> /api/auth
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: () => request('/auth/me'),
  updateMe: (payload) => request('/auth/me', { method: 'PUT', body: payload }),

  // sessions -> /api/session
  listSessions: () => request('/session'),
  createSession: (name) => request('/session', { method: 'POST', body: { name } }),
  getSession: (id) => request(`/session/${id}`),
  updateSession: (id, payload) => request(`/session/${id}`, { method: 'PATCH', body: payload }),
  clearSession: (id) => request(`/session/${id}/clear`, { method: 'POST', body: { confirm: 'CLEAR' } }),
  archiveSession: (id) => request(`/session/${id}`, { method: 'DELETE' }),

  // youtube -> /api/youtube
  connectYoutube: (sessionId, videoUrl, apiKey) => request('/youtube/connect', { method: 'POST', body: { sessionId, videoUrl, apiKey } }),
  disconnectYoutube: (sessionId) => request('/youtube/disconnect', { method: 'POST', body: { sessionId } }),
  pauseCollection: (sessionId) => request('/youtube/pause', { method: 'POST', body: { sessionId } }),
  resumeCollection: (sessionId) => request('/youtube/resume', { method: 'POST', body: { sessionId } }),
  getConnectionStatus: (sessionId) => request(`/youtube/status/${sessionId}`),

  // participants -> /api/participants
  listParticipants: (sessionId, { status, search, sort } = {}) => {
    const params = new URLSearchParams({ sessionId });
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    if (sort) params.set('sort', sort);
    return request(`/participants?${params.toString()}`);
  },
  listDuplicates: (sessionId) => request(`/participants/duplicates?${new URLSearchParams({ sessionId })}`),
  getUserTags: (sessionId, username) => request(`/participants/by-user/${encodeURIComponent(username)}?${new URLSearchParams({ sessionId })}`),
  addParticipant: (payload) => request('/participants', { method: 'POST', body: payload }),
  updateParticipant: (id, payload) => request(`/participants/${id}`, { method: 'PATCH', body: payload }),
  deleteParticipant: (id, sessionId) => request(`/participants/${id}?${new URLSearchParams({ sessionId })}`, { method: 'DELETE' }),
  confirmParticipant: (id, sessionId) => request(`/participants/${id}/confirm`, { method: 'POST', body: { sessionId } }),
  unpendParticipant: (id, sessionId) => request(`/participants/${id}/pending`, { method: 'POST', body: { sessionId } }),
  bulkAction: (sessionId, ids, action) => request('/participants/bulk', { method: 'POST', body: { sessionId, ids, action } }),

  // giveaways -> /api/giveaway
  listGiveaways: () => request('/giveaway'),
  createGiveaway: (payload) => request('/giveaway', { method: 'POST', body: payload }),
  getGiveaway: (id) => request(`/giveaway/${id}`),
  updateGiveaway: (id, payload) => request(`/giveaway/${id}`, { method: 'PATCH', body: payload }),
  getEligibleCount: (id) => request(`/giveaway/${id}/eligible-count`),
  listGiveawayEntries: (id) => request(`/giveaway/${id}/entries`),
  addGiveawayEntry: (id, displayName, channelId) => request(`/giveaway/${id}/entries`, { method: 'POST', body: { displayName, channelId } }),
  removeGiveawayEntry: (id, entryId) => request(`/giveaway/${id}/entries/${entryId}`, { method: 'DELETE' }),
  runDraw: (id) => request(`/giveaway/${id}/draw`, { method: 'POST' }),
  listDraws: (id) => request(`/giveaway/${id}/draws`),
  setWinnerRole: (giveawayId, drawId, entryId, role) =>
    request(`/giveaway/${giveawayId}/draws/${drawId}/${entryId}`, { method: 'PATCH', body: { role } }),
  deleteGiveaway: (id) => request(`/giveaway/${id}`, { method: 'DELETE' }),
  getPublicGiveaway: async (id) => {
    const res = await fetch(`${BASE_URL}/public/giveaway/${id}`);
    if (!res.ok) throw new Error('Could not load giveaway.');
    return res.json();
  },

  // alerts -> /api/alerts
  getAlertConfig: () => request('/alerts/config'),
  saveAlertConfig: (payload) => request('/alerts/config', { method: 'PUT', body: payload }),
  listAlerts: (sessionId) => request(`/alerts?${new URLSearchParams({ sessionId })}`),
  testAlert: (sessionId, type) => request('/alerts/test', { method: 'POST', body: { sessionId, type } }),

  // polls -> /api/polls
  listPolls: (sessionId) => request(`/polls?${new URLSearchParams({ sessionId })}`),
  createPoll: (payload) => request('/polls', { method: 'POST', body: payload }),
  goLivePoll: (id) => request(`/polls/${id}/go-live`, { method: 'POST' }),
  closePoll: (id) => request(`/polls/${id}/close`, { method: 'POST' }),
  getPublicPoll: async (sessionId) => {
    const res = await fetch(`${BASE_URL}/public/poll/${sessionId}`);
    if (!res.ok) throw new Error('Could not load poll.');
    return res.json();
  },

  // moderation -> /api/moderation
  getModSettings: (sessionId) => request(`/moderation/settings?${new URLSearchParams({ sessionId })}`),
  saveModSettings: (payload) => request('/moderation/settings', { method: 'PUT', body: payload }),
  listFlags: (sessionId, status) => {
    const params = new URLSearchParams({ sessionId });
    if (status) params.set('status', status);
    return request(`/moderation/flags?${params.toString()}`);
  },
  setFlagStatus: (id, status) => request(`/moderation/flags/${id}`, { method: 'PATCH', body: { status } }),

  // analytics -> /api/analytics
  getChatActivity: (sessionId, minutes) => request(`/analytics/chat-activity?${new URLSearchParams({ sessionId, minutes: minutes || 60 })}`),
  getSummary: (sessionId) => request(`/analytics/summary?${new URLSearchParams({ sessionId })}`),

  // export -> /api/export (direct downloads)
  exportParticipantsUrl: (sessionId, filter, format) =>
    `${BASE_URL}/export/participants?${new URLSearchParams({ sessionId, filter: filter || 'all', format: format || 'csv' })}`,
};

export function downloadFile(url, filename) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  fetch(url, { headers })
    .then((res) => res.blob())
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      if (filename) a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    });
}

export { BASE_URL, getToken };
