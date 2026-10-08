import React, { useEffect, useState } from 'react';
import { useSession } from '../hooks/useSession.jsx';
import { useSessionSocket } from '../hooks/useSessionSocket.js';
import { api } from '../services/api.js';

const ALERT_TYPES = [
  { value: 'member', label: '⭐ New Member' },
  { value: 'super_chat', label: '💰 Super Chat' },
  { value: 'super_sticker', label: '🎉 Super Sticker' },
  { value: 'gift_membership', label: '🎁 Gifted Membership' },
  { value: 'test', label: '🔔 Test Alert' },
];

export default function Alerts() {
  const { currentSession } = useSession();
  const sessionId = currentSession?.id;
  const { latestAlert } = useSessionSocket(sessionId);

  const [config, setConfig] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    api.getAlertConfig().then(setConfig);
  }, []);

  useEffect(() => {
    if (sessionId) api.listAlerts(sessionId).then(setRecent);
  }, [sessionId]);

  useEffect(() => {
    if (latestAlert) setRecent((prev) => [latestAlert, ...prev].slice(0, 30));
  }, [latestAlert]);

  if (!currentSession) return <div className="alert alert-info">Create a session from the top bar first.</div>;

  const overlayUrl = `${window.location.origin}/overlay/alerts/${sessionId}`;

  async function saveConfig(updates) {
    const updated = await api.saveAlertConfig({ ...config, ...updates });
    setConfig(updated);
  }

  async function fireTest(type) {
    await api.testAlert(sessionId, type);
  }

  function copyUrl() {
    navigator.clipboard?.writeText(overlayUrl);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Alerts & Overlays</h1>
        <p className="text-sm opacity-60">Real YouTube events - new members, Super Chats, Super Stickers, and gifted memberships - pushed live to an OBS browser source.</p>
      </div>

      <div className="glass-card">
        <h2 className="mb-2 text-lg font-bold">🖥️ OBS Browser Source URL</h2>
        <p className="mb-3 text-sm opacity-60">Add a Browser Source in OBS pointing at this URL. Recommended size: 800x300, transparent background.</p>
        <div className="flex gap-2">
          <input className="input input-bordered flex-1 font-mono text-sm" readOnly value={overlayUrl} />
          <button className="btn btn-outline" onClick={copyUrl}>Copy</button>
          <a className="btn btn-outline" href={overlayUrl} target="_blank" rel="noopener noreferrer">
            Preview
          </a>
        </div>
      </div>

      {config && (
        <div className="glass-card">
          <h2 className="mb-3 text-lg font-bold">Alert Settings</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label"><span className="label-text">Display Duration (seconds)</span></label>
              <input
                type="number"
                min="2"
                max="20"
                className="input input-bordered w-full"
                value={config.display_seconds}
                onChange={(e) => saveConfig({ display_seconds: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label"><span className="label-text">Accent Color</span></label>
              <input
                type="color"
                className="h-12 w-full rounded-lg border border-white/10 bg-transparent"
                value={config.accent_color}
                onChange={(e) => saveConfig({ accent_color: e.target.value })}
              />
            </div>
          </div>
          <div className="divider my-2" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {ALERT_TYPES.map((t) => (
              <label key={t.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={config.enabled?.[t.value] ?? true}
                  onChange={(e) => saveConfig({ enabled: { ...config.enabled, [t.value]: e.target.checked } })}
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card">
        <h2 className="mb-3 text-lg font-bold">🧪 Test Alerts</h2>
        <div className="flex flex-wrap gap-2">
          {ALERT_TYPES.map((t) => (
            <button key={t.value} className="btn btn-sm btn-outline" onClick={() => fireTest(t.value)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card">
        <h2 className="mb-3 text-lg font-bold">Recent Alerts</h2>
        <div className="max-h-80 space-y-2 overflow-y-auto text-sm">
          {recent.length === 0 && <div className="opacity-50">No alerts yet.</div>}
          {recent.map((a) => (
            <div key={a.id} className="rounded-lg bg-base-200/60 px-3 py-2">
              <div className="text-xs opacity-50">{new Date(a.created_at).toLocaleTimeString()}</div>
              <div className="font-semibold">{a.title}</div>
              {a.message && <div className="opacity-70">{a.message}</div>}
              {a.amount && <div className="text-success">{a.amount}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
