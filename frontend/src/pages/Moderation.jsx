import React, { useEffect, useState } from 'react';
import { useSession } from '../hooks/useSession.jsx';
import { useSessionSocket } from '../hooks/useSessionSocket.js';
import { api } from '../services/api.js';

export default function Moderation() {
  const { currentSession } = useSession();
  const sessionId = currentSession?.id;
  const { latestFlag } = useSessionSocket(sessionId);

  const [settings, setSettings] = useState(null);
  const [wordInput, setWordInput] = useState('');
  const [flags, setFlags] = useState([]);
  const [filter, setFilter] = useState('open');

  useEffect(() => {
    if (sessionId) api.getModSettings(sessionId).then(setSettings);
  }, [sessionId]);

  function loadFlags() {
    if (sessionId) api.listFlags(sessionId, filter).then(setFlags);
  }
  useEffect(loadFlags, [sessionId, filter]);
  useEffect(() => {
    if (latestFlag) loadFlags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestFlag]);

  if (!currentSession) return <div className="alert alert-info">Create a session from the top bar first.</div>;
  if (!settings) return <div className="opacity-60">Loading…</div>;

  async function saveSettings(updates) {
    const merged = { ...settings, ...updates };
    const saved = await api.saveModSettings({
      sessionId,
      bannedWords: merged.banned_words,
      autoFlagLinks: merged.auto_flag_links,
      autoFlagCaps: merged.auto_flag_caps,
    });
    setSettings(saved);
  }

  function addWord(e) {
    e.preventDefault();
    if (!wordInput.trim()) return;
    saveSettings({ banned_words: [...settings.banned_words, wordInput.trim()] });
    setWordInput('');
  }
  function removeWord(word) {
    saveSettings({ banned_words: settings.banned_words.filter((w) => w !== word) });
  }

  async function setStatus(id, status) {
    await api.setFlagStatus(id, status);
    loadFlags();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Moderation</h1>
        <p className="text-sm opacity-60">
          Detects banned words, links, and (optionally) excessive caps in chat. This is detect-and-log only - taking action on YouTube
          itself still happens in YouTube Studio or chat, since that requires channel-owner permissions this tool doesn't request.
        </p>
      </div>

      <div className="glass-card">
        <h2 className="mb-3 text-lg font-bold">Auto-Flag Rules</h2>
        <label className="flex items-center justify-between py-2">
          <span>Flag messages containing links</span>
          <input type="checkbox" className="toggle toggle-primary" checked={settings.auto_flag_links} onChange={(e) => saveSettings({ auto_flag_links: e.target.checked })} />
        </label>
        <label className="flex items-center justify-between py-2">
          <span>Flag messages that are mostly CAPS LOCK</span>
          <input type="checkbox" className="toggle toggle-primary" checked={settings.auto_flag_caps} onChange={(e) => saveSettings({ auto_flag_caps: e.target.checked })} />
        </label>

        <div className="divider my-2" />
        <h3 className="mb-2 font-semibold">Banned Words</h3>
        <form onSubmit={addWord} className="mb-2 flex gap-2">
          <input className="input input-bordered input-sm flex-1" placeholder="Add a word or phrase" value={wordInput} onChange={(e) => setWordInput(e.target.value)} />
          <button className="btn btn-sm btn-primary" type="submit">Add</button>
        </form>
        <div className="flex flex-wrap gap-2">
          {settings.banned_words.length === 0 && <span className="text-sm opacity-50">No banned words configured.</span>}
          {settings.banned_words.map((w) => (
            <span key={w} className="badge badge-outline gap-1">
              {w}
              <button onClick={() => removeWord(w)} className="ml-1 text-xs opacity-60 hover:opacity-100">
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="glass-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Flagged Messages</h2>
          <div className="flex gap-1">
            {['open', 'dismissed', 'actioned', 'all'].map((f) => (
              <button key={f} className={`btn btn-xs ${filter === f ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {flags.length === 0 && <div className="text-sm opacity-50">Nothing flagged.</div>}
          {flags.map((f) => (
            <div key={f.id} className="rounded-lg bg-base-200/60 px-3 py-2">
              <div className="flex items-center justify-between text-xs opacity-50">
                <span>{new Date(f.created_at).toLocaleString()}</span>
                <span className="badge badge-sm badge-error badge-outline">{f.reason}</span>
              </div>
              <div className="mt-1">
                <span className="font-semibold">@{f.author}:</span> {f.message}
              </div>
              {f.status === 'open' && (
                <div className="mt-2 flex gap-2">
                  <button className="btn btn-xs btn-outline" onClick={() => setStatus(f.id, 'dismissed')}>Dismiss</button>
                  <button className="btn btn-xs btn-error" onClick={() => setStatus(f.id, 'actioned')}>Mark Actioned</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
