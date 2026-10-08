import React, { useEffect, useState } from 'react';
import { useSession } from '../hooks/useSession.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { useSessionSocket } from '../hooks/useSessionSocket.js';
import { api } from '../services/api.js';

const STATUS_BADGE = {
  connected: 'badge-success',
  paused: 'badge-warning',
  disconnected: 'badge-ghost',
};

export default function Connection() {
  const { currentSession, reloadSessions } = useSession();
  const { streamer } = useAuth();
  const { connectionStatus, stats } = useSessionSocket(currentSession?.id);
  const hasSavedKey = !!streamer?.has_youtube_api_key;

  const [videoUrl, setVideoUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cocEnabled, setCocEnabled] = useState(false);
  const [voteCommand, setVoteCommand] = useState('!vote');

  useEffect(() => {
    if (currentSession) {
      setVideoUrl(currentSession.youtube_video_url || '');
      setCocEnabled(!!currentSession.coc_tracking_enabled);
      setVoteCommand(currentSession.vote_command || '!vote');
    }
  }, [currentSession]);

  if (!currentSession) {
    return <div className="alert alert-info">Create a session from the top bar first.</div>;
  }

  async function connect() {
    setError('');
    setBusy(true);
    try {
      await api.connectYoutube(currentSession.id, videoUrl, apiKey);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    await api.disconnectYoutube(currentSession.id);
  }
  async function pause() {
    await api.pauseCollection(currentSession.id);
  }
  async function resume() {
    await api.resumeCollection(currentSession.id);
  }
  async function toggleCoc(e) {
    const value = e.target.checked;
    setCocEnabled(value);
    await api.updateSession(currentSession.id, { cocTrackingEnabled: value });
    reloadSessions();
  }
  async function saveVoteCommand() {
    await api.updateSession(currentSession.id, { voteCommand });
    reloadSessions();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Chat Connection</h1>
        <p className="text-sm opacity-60">Connect this session to a live YouTube broadcast. Needs only a YouTube Data API key - no OAuth, no channel login.</p>
      </div>

      <div className="glass-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">YouTube Live Chat</h2>
          <span className={`badge ${STATUS_BADGE[connectionStatus] || 'badge-ghost'} badge-lg`}>
            {connectionStatus === 'connected' && '🟢 CONNECTED'}
            {connectionStatus === 'paused' && '⏸ PAUSED'}
            {connectionStatus === 'disconnected' && '🔴 DISCONNECTED'}
          </span>
        </div>

        {error && <div className="alert alert-error mb-3 text-sm">{error}</div>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label"><span className="label-text">YouTube Live Stream URL</span></label>
            <input
              className="input input-bordered w-full"
              placeholder="https://youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              disabled={connectionStatus !== 'disconnected'}
            />
          </div>
          <div>
            <label className="label">
              <span className="label-text">YouTube Data API Key</span>
              {hasSavedKey && <span className="label-text-alt text-success">🔑 saved key on file</span>}
            </label>
            <input
              type="password"
              className="input input-bordered w-full"
              placeholder={hasSavedKey ? 'Leave blank to use your saved key' : 'Paste your API key'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={connectionStatus !== 'disconnected'}
            />
            <p className="mt-1 text-xs opacity-50">
              {hasSavedKey
                ? 'A saved key from Settings will be used automatically if you leave this blank. Paste one here only to override it for this session.'
                : 'No key saved yet - paste one here, or save one once in Settings so you never have to re-enter it.'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {connectionStatus === 'disconnected' && (
            <button className="btn btn-primary" disabled={busy || !videoUrl || (!apiKey && !hasSavedKey)} onClick={connect}>
              {busy ? 'Connecting…' : 'Start Collection'}
            </button>
          )}
          {connectionStatus === 'connected' && <button className="btn btn-warning" onClick={pause}>Pause Collection</button>}
          {connectionStatus === 'paused' && <button className="btn btn-success" onClick={resume}>Resume Collection</button>}
          {connectionStatus !== 'disconnected' && (
            <button className="btn btn-outline btn-error" onClick={disconnect}>Stop Collection</button>
          )}
        </div>

        {connectionStatus !== 'disconnected' && (
          <div className="mt-3 text-sm opacity-70">Messages scanned this session: {stats?.totalMessages ?? 0}</div>
        )}
      </div>

      <div className="glass-card">
        <h2 className="mb-3 text-lg font-bold">Feature Toggles</h2>
        <label className="flex items-center justify-between gap-3 py-2">
          <div>
            <div className="font-medium">Clash of Clans Tag Tracking</div>
            <div className="text-sm opacity-60">Detect #PLAYERTAG mentions in chat and track them for tag-based giveaways.</div>
          </div>
          <input type="checkbox" className="toggle toggle-primary" checked={cocEnabled} onChange={toggleCoc} />
        </label>
        <div className="divider my-1" />
        <div className="flex items-center justify-between gap-3 py-2">
          <div>
            <div className="font-medium">Poll Vote Command</div>
            <div className="text-sm opacity-60">Viewers type this followed by a number, e.g. "{voteCommand} 2", to vote in a live poll.</div>
          </div>
          <div className="flex gap-2">
            <input className="input input-bordered input-sm w-32 font-mono" value={voteCommand} onChange={(e) => setVoteCommand(e.target.value)} />
            <button className="btn btn-sm btn-outline" onClick={saveVoteCommand}>Save</button>
          </div>
        </div>
      </div>

      <div className="glass-card text-sm opacity-70">
        <strong>Note:</strong> this connects with a YouTube Data API key only (read-only). It can see chat, Super Chats, memberships, and
        gifted memberships, but it cannot delete messages or ban viewers on YouTube itself - that needs channel-owner OAuth, which this
        tool intentionally does not request. Moderation here is detect-and-log (see the Moderation tab).
      </div>
    </div>
  );
}
