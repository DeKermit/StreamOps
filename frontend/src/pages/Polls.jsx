import React, { useEffect, useState } from 'react';
import { useSession } from '../hooks/useSession.jsx';
import { useSessionSocket } from '../hooks/useSessionSocket.js';
import { api } from '../services/api.js';

export default function Polls() {
  const { currentSession } = useSession();
  const sessionId = currentSession?.id;
  const { latestPoll } = useSessionSocket(sessionId);

  const [polls, setPolls] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [error, setError] = useState('');

  function load() {
    if (sessionId) api.listPolls(sessionId).then(setPolls);
  }
  useEffect(load, [sessionId]);
  useEffect(() => {
    if (latestPoll) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestPoll]);

  if (!currentSession) return <div className="alert alert-info">Create a session from the top bar first.</div>;

  const overlayUrl = `${window.location.origin}/overlay/poll/${sessionId}`;

  function setOption(i, value) {
    setOptions((opts) => opts.map((o, idx) => (idx === i ? value : o)));
  }
  function addOption() {
    if (options.length < 6) setOptions((opts) => [...opts, '']);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createPoll({ sessionId, question, options });
      setQuestion('');
      setOptions(['', '']);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function goLive(id) {
    await api.goLivePoll(id);
    load();
  }
  async function close(id) {
    await api.closePoll(id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Polls</h1>
          <p className="text-sm opacity-60">
            Viewers vote in chat with <code className="font-mono">{currentSession.vote_command || '!vote'} 1</code>.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ New Poll'}
        </button>
      </div>

      <div className="glass-card">
        <h2 className="mb-2 text-lg font-bold">🖥️ OBS Browser Source URL</h2>
        <div className="flex gap-2">
          <input className="input input-bordered flex-1 font-mono text-sm" readOnly value={overlayUrl} />
          <button className="btn btn-outline" onClick={() => navigator.clipboard?.writeText(overlayUrl)}>Copy</button>
          <a className="btn btn-outline" href={overlayUrl} target="_blank" rel="noopener noreferrer">Preview</a>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="glass-card space-y-3">
          {error && <div className="alert alert-error text-sm">{error}</div>}
          <div>
            <label className="label"><span className="label-text">Question</span></label>
            <input className="input input-bordered w-full" value={question} onChange={(e) => setQuestion(e.target.value)} required autoFocus />
          </div>
          {options.map((o, i) => (
            <input
              key={i}
              className="input input-bordered w-full"
              placeholder={`Option ${i + 1}`}
              value={o}
              onChange={(e) => setOption(i, e.target.value)}
              required={i < 2}
            />
          ))}
          <div className="flex gap-2">
            {options.length < 6 && (
              <button type="button" className="btn btn-sm btn-outline" onClick={addOption}>
                + Add Option
              </button>
            )}
            <button className="btn btn-primary" type="submit">Create Poll</button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {polls.length === 0 && <div className="opacity-50">No polls yet.</div>}
        {polls.map((p) => (
          <div key={p.id} className="glass-card">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-bold">{p.question}</div>
              <span
                className={`badge ${p.status === 'live' ? 'badge-success' : p.status === 'closed' ? 'badge-ghost' : 'badge-outline'}`}
              >
                {p.status}
              </span>
            </div>
            <div className="space-y-1.5">
              {p.options.map((opt, i) => {
                const pct = p.total_votes ? Math.round((p.counts[i] / p.total_votes) * 100) : 0;
                return (
                  <div key={i} className="text-sm">
                    <div className="mb-0.5 flex justify-between">
                      <span>{opt}</span>
                      <span className="opacity-60">{p.counts[i]} ({pct}%)</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-base-300">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex gap-2">
              {p.status !== 'live' && p.status !== 'closed' && (
                <button className="btn btn-xs btn-success" onClick={() => goLive(p.id)}>Go Live</button>
              )}
              {p.status === 'live' && (
                <button className="btn btn-xs btn-outline" onClick={() => close(p.id)}>Close Poll</button>
              )}
              {p.status === 'closed' && <span className="text-xs opacity-50">Final: {p.total_votes} votes</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
