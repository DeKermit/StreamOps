import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../hooks/useSession.jsx';
import { api } from '../services/api.js';
import { ACCENT_PRESETS, DEFAULT_ACCENT } from '../theme/giveawayBranding.js';
import { fileToDataUrl } from '../utils/imageUpload.js';

const ENTRY_MODE_LABEL = {
  keyword: '💬 Chat Keyword',
  coc_tag: '🏷️ CoC Tag (one per tag)',
  coc_user: '🙋 CoC Tag (one per YouTube user)',
};

export default function Giveaways() {
  const { currentSession } = useSession();
  const [giveaways, setGiveaways] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    entryMode: 'keyword',
    keyword: '',
    winnerCount: 1,
    backupCount: 1,
    allowDuplicateWinners: false,
    brandAccent: DEFAULT_ACCENT,
    prizeName: '',
    prizeDescription: '',
    prizeImageUrl: '',
  });
  const [prizeImageError, setPrizeImageError] = useState('');

  function load() {
    api.listGiveaways().then(setGiveaways);
  }
  useEffect(load, []);

  function set(field) {
    return (e) => {
      const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      setForm((f) => ({ ...f, [field]: value }));
    };
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createGiveaway({
        sessionId: currentSession?.id,
        title: form.title,
        entryMode: form.entryMode,
        keyword: form.keyword,
        winnerCount: Number(form.winnerCount),
        backupCount: Number(form.backupCount),
        allowDuplicateWinners: form.allowDuplicateWinners,
        brandAccent: form.brandAccent,
        prizeName: form.prizeName,
        prizeDescription: form.prizeDescription,
        prizeImageUrl: form.prizeImageUrl,
      });
      setForm({
        title: '',
        entryMode: 'keyword',
        keyword: '',
        winnerCount: 1,
        backupCount: 1,
        allowDuplicateWinners: false,
        brandAccent: DEFAULT_ACCENT,
        prizeName: '',
        prizeDescription: '',
        prizeImageUrl: '',
      });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onPrizeImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPrizeImageError('');
    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((f) => ({ ...f, prizeImageUrl: dataUrl }));
    } catch (err) {
      setPrizeImageError(err.message);
    } finally {
      e.target.value = '';
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this giveaway and its draw history?')) return;
    await api.deleteGiveaway(id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Giveaways</h1>
          <p className="text-sm opacity-60">Chat-keyword giveaways, or draws straight from your confirmed Clash of Clans tags.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ New Giveaway'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="glass-card space-y-4">
          {error && <div className="alert alert-error text-sm">{error}</div>}
          <div>
            <label className="label"><span className="label-text">Title</span></label>
            <input className="input input-bordered w-full" value={form.title} onChange={set('title')} required autoFocus />
          </div>

          <div>
            <label className="label"><span className="label-text">Entry Mode</span></label>
            <select className="select select-bordered w-full" value={form.entryMode} onChange={set('entryMode')}>
              <option value="keyword">Chat Keyword - viewers type a word in chat to enter</option>
              <option value="coc_tag">Clash of Clans Tag - one winner per confirmed tag</option>
              <option value="coc_user">Clash of Clans Tag - one winner per YouTube user</option>
            </select>
          </div>

          {form.entryMode === 'keyword' && (
            <div>
              <label className="label"><span className="label-text">Entry Keyword</span></label>
              <input className="input input-bordered w-full font-mono" placeholder="e.g. !enter" value={form.keyword} onChange={set('keyword')} required />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label"><span className="label-text">Number of Winners</span></label>
              <input type="number" min="1" className="input input-bordered w-full" value={form.winnerCount} onChange={set('winnerCount')} required />
            </div>
            <div>
              <label className="label"><span className="label-text">Backup Winners</span></label>
              <input type="number" min="0" className="input input-bordered w-full" value={form.backupCount} onChange={set('backupCount')} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="checkbox checkbox-sm" checked={form.allowDuplicateWinners} onChange={set('allowDuplicateWinners')} />
            Allow the same person to win more than once
          </label>

          <div className="divider my-0 text-xs opacity-50">What are you giving away?</div>
          {prizeImageError && <div className="alert alert-error text-sm">{prizeImageError}</div>}
          <div className="flex gap-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-base-300">
              {form.prizeImageUrl ? (
                <img src={form.prizeImageUrl} alt="Prize preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl opacity-40">🎁</div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input className="input input-bordered input-sm w-full" placeholder="Prize name, e.g. Steam Gift Card $25" value={form.prizeName} onChange={set('prizeName')} />
              <label className="btn btn-outline btn-xs">
                {form.prizeImageUrl ? 'Change Image' : 'Add Prize Image'}
                <input type="file" accept="image/*" className="hidden" onChange={onPrizeImageChange} />
              </label>
            </div>
          </div>
          <textarea
            className="textarea textarea-bordered w-full text-sm"
            placeholder="Prize description (optional) - shown in the giveaway workspace and can be read out on stream"
            rows={2}
            value={form.prizeDescription}
            onChange={set('prizeDescription')}
          />

          <div>
            <label className="label"><span className="label-text">Draw Screen Color</span></label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  title={a.label}
                  onClick={() => setForm((f) => ({ ...f, brandAccent: a.hex }))}
                  className="h-9 w-9 rounded-full border-2 transition"
                  style={{ background: a.hex, borderColor: form.brandAccent === a.hex ? '#fff' : 'transparent' }}
                />
              ))}
              <input
                type="color"
                className="h-9 w-9 cursor-pointer rounded-full border border-white/10 bg-transparent"
                value={form.brandAccent}
                onChange={(e) => setForm((f) => ({ ...f, brandAccent: e.target.value }))}
                title="Custom color"
              />
            </div>
            <p className="mt-1 text-xs opacity-50">This colors the live Draw Screen viewers see when you open it.</p>
          </div>

          <button className="btn btn-primary" type="submit">Create Giveaway</button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {giveaways.length === 0 && <div className="opacity-50">No giveaways yet.</div>}
        {giveaways.map((g) => (
          <div key={g.id} className="glass-card flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className={`badge ${g.status === 'open' ? 'badge-success' : 'badge-ghost'}`}>{g.status}</span>
              <button className="btn btn-xs btn-ghost text-error" onClick={() => handleDelete(g.id)}>
                Delete
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: g.brand_accent || DEFAULT_ACCENT }} />
              <div className="text-lg font-bold">{g.title}</div>
            </div>
            <div className="text-sm opacity-60">{ENTRY_MODE_LABEL[g.entry_mode]}</div>
            <div className="text-sm opacity-60">
              {g.winner_count} winner{g.winner_count > 1 ? 's' : ''} · {g.backup_count} backup(s)
            </div>
            {(g.prize_name || g.prize_image_url) && (
              <div className="mt-1 flex items-center gap-2 rounded-lg bg-black/20 p-2">
                {g.prize_image_url && <img src={g.prize_image_url} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />}
                <div className="truncate text-sm">🎁 {g.prize_name || 'Prize attached'}</div>
              </div>
            )}
            <Link to={`/giveaways/${g.id}`} className="btn btn-sm btn-outline mt-2">
              Open
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
