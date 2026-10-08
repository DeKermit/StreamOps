import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, downloadFile, BASE_URL } from '../services/api.js';
import { fileToDataUrl } from '../utils/imageUpload.js';

function PrizeCard({ giveaway, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [prizeName, setPrizeName] = useState(giveaway.prize_name || '');
  const [prizeDescription, setPrizeDescription] = useState(giveaway.prize_description || '');
  const [prizeImageUrl, setPrizeImageUrl] = useState(giveaway.prize_image_url || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Keep the form in sync if the giveaway reloads from elsewhere while not editing.
  useEffect(() => {
    if (!editing) {
      setPrizeName(giveaway.prize_name || '');
      setPrizeDescription(giveaway.prize_description || '');
      setPrizeImageUrl(giveaway.prize_image_url || '');
    }
  }, [giveaway, editing]);

  async function onImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      setPrizeImageUrl(await fileToDataUrl(file));
    } catch (err) {
      setError(err.message);
    } finally {
      e.target.value = '';
    }
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api.updateGiveaway(giveaway.id, { prizeName, prizeDescription, prizeImageUrl });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const hasPrize = giveaway.prize_name || giveaway.prize_description || giveaway.prize_image_url;

  if (!editing) {
    return (
      <div className="glass-card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold">🎁 Prize</h2>
          <button className="btn btn-xs btn-outline" onClick={() => setEditing(true)}>
            {hasPrize ? 'Edit' : '+ Add Prize'}
          </button>
        </div>
        {hasPrize ? (
          <div className="flex items-center gap-3">
            {giveaway.prize_image_url && (
              <img src={giveaway.prize_image_url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
            )}
            <div>
              <div className="font-semibold">{giveaway.prize_name || 'Untitled prize'}</div>
              {giveaway.prize_description && <div className="text-sm opacity-60">{giveaway.prize_description}</div>}
            </div>
          </div>
        ) : (
          <div className="text-sm opacity-50">No prize details added yet - viewers only see the giveaway title.</div>
        )}
      </div>
    );
  }

  return (
    <div className="glass-card space-y-3">
      <h2 className="text-lg font-bold">🎁 Prize</h2>
      {error && <div className="alert alert-error text-sm">{error}</div>}
      <div className="flex gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-base-300">
          {prizeImageUrl ? (
            <img src={prizeImageUrl} alt="Prize preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl opacity-40">🎁</div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input className="input input-bordered input-sm w-full" placeholder="Prize name" value={prizeName} onChange={(e) => setPrizeName(e.target.value)} />
          <label className="btn btn-outline btn-xs">
            {prizeImageUrl ? 'Change Image' : 'Add Image'}
            <input type="file" accept="image/*" className="hidden" onChange={onImageChange} />
          </label>
        </div>
      </div>
      <textarea
        className="textarea textarea-bordered w-full text-sm"
        placeholder="Description (optional)"
        rows={2}
        value={prizeDescription}
        onChange={(e) => setPrizeDescription(e.target.value)}
      />
      <div className="flex gap-2">
        <button className="btn btn-sm btn-primary" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function EligibleList({ giveawayId, entryMode, onChanged }) {
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(true);

  const load = useCallback(() => {
    api.listGiveawayEntries(giveawayId).then(setData);
  }, [giveawayId]);

  useEffect(load, [load]);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    try {
      await api.addGiveawayEntry(giveawayId, name, channelId);
      setName('');
      setChannelId('');
      load();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(entryId) {
    if (!window.confirm('Remove this entry from the eligible list?')) return;
    await api.removeGiveawayEntry(giveawayId, entryId);
    load();
    onChanged();
  }

  if (!data) return null;

  return (
    <div className="glass-card">
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen((v) => !v)}>
        <h2 className="text-lg font-bold">
          📋 Eligible List <span className="opacity-50">({data.entries.length})</span>
        </h2>
        <span className="text-sm opacity-60">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="mt-3">
          {!data.editable && (
            <div className="alert alert-info mb-3 text-sm">
              This giveaway draws from confirmed Clash of Clans tags - add, edit, or remove entries from{' '}
              <Link to="/tags" className="link link-primary">
                Tag Manager
              </Link>
              . This list is read-only here.
            </div>
          )}

          {data.editable && (
            <form onSubmit={handleAdd} className="mb-3 flex flex-wrap gap-2">
              {error && <div className="alert alert-error w-full text-sm">{error}</div>}
              <input className="input input-bordered input-sm flex-1 min-w-[160px]" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <input className="input input-bordered input-sm flex-1 min-w-[160px]" placeholder="Channel ID (optional)" value={channelId} onChange={(e) => setChannelId(e.target.value)} />
              <button className="btn btn-sm btn-primary" type="submit">+ Add Entry</button>
            </form>
          )}

          <div className="max-h-80 overflow-y-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  {data.editable && <th>Entered</th>}
                  {data.editable && <th></th>}
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="font-medium">{data.editable ? `@${entry.display_name}` : entry.label}</td>
                    {data.editable && <td className="text-xs opacity-60">{new Date(entry.entered_at).toLocaleString()}</td>}
                    {data.editable && (
                      <td>
                        <button className="btn btn-xs btn-error btn-outline" onClick={() => handleRemove(entry.id)}>
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {data.entries.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center opacity-50">
                      No one is eligible yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GiveawayWorkspace() {
  const { id } = useParams();
  const [giveaway, setGiveaway] = useState(null);
  const [eligible, setEligible] = useState(null);
  const [draws, setDraws] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.getGiveaway(id).then(setGiveaway);
    api.getEligibleCount(id).then(setEligible);
    api.listDraws(id).then(setDraws);
  }, [id]);

  useEffect(load, [load]);

  async function handleDraw() {
    setError('');
    setBusy(true);
    try {
      await api.runDraw(id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function openDrawScreen() {
    window.open(`/draw/${id}`, '_blank', 'noopener,noreferrer');
  }

  async function setRole(drawId, entryId, role) {
    await api.setWinnerRole(id, drawId, entryId, role);
    load();
  }

  if (!giveaway) return <div className="opacity-60">Loading…</div>;

  const latestDraw = draws[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/giveaways" className="text-sm opacity-60 hover:underline">
            ← Back to Giveaways
          </Link>
          <h1 className="text-2xl font-extrabold">{giveaway.title}</h1>
        </div>
        <span className={`badge badge-lg ${giveaway.status === 'open' ? 'badge-success' : 'badge-ghost'}`}>{giveaway.status}</span>
      </div>

      {error && <div className="alert alert-error text-sm">{error}</div>}

      <PrizeCard giveaway={giveaway} onSaved={load} />

      <div className="glass-card flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm opacity-60">Eligible Entries</div>
          <div className="text-3xl font-extrabold">{eligible?.eligible_count ?? '—'}</div>
          <div className="text-xs opacity-50">
            Needs {giveaway.winner_count} winner{giveaway.winner_count > 1 ? 's' : ''}
            {giveaway.backup_count ? ` + ${giveaway.backup_count} backup(s)` : ''}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={openDrawScreen}>
            🖥️ Open Draw Screen
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={handleDraw}>
            {busy ? 'Drawing…' : '🎲 Run Draw'}
          </button>
        </div>
      </div>

      <EligibleList giveawayId={id} entryMode={giveaway.entry_mode} onChanged={load} />

      {latestDraw && (
        <div className="glass-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Draw #{latestDraw.draw_number} Results</h2>
            <div className="flex gap-2">
              <button
                className="btn btn-xs btn-outline"
                onClick={() => downloadFile(`${BASE_URL}/export/giveaway-winners/${id}?format=csv`, `${giveaway.title}-winners.csv`)}
              >
                Export CSV
              </button>
              <button
                className="btn btn-xs btn-outline"
                onClick={() => downloadFile(`${BASE_URL}/export/giveaway-winners/${id}?format=json`, `${giveaway.title}-winners.json`)}
              >
                Export JSON
              </button>
            </div>
          </div>

          <table className="table table-sm">
            <thead>
              <tr>
                <th>#</th>
                <th>Winner</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {latestDraw.winner_entry_ids.map((w, i) => {
                const status = latestDraw.winner_status[w.id] || 'pending';
                return (
                  <tr key={w.id}>
                    <td>{i + 1}</td>
                    <td className="font-semibold">{w.label}</td>
                    <td>
                      <span
                        className={
                          status === 'accepted' ? 'badge-confirmed' : status === 'rejected' ? 'badge-duplicate' : 'badge-pending'
                        }
                      >
                        {status}
                      </span>
                    </td>
                    <td className="flex gap-1">
                      {status !== 'accepted' && (
                        <button className="btn btn-xs btn-success" onClick={() => setRole(latestDraw.id, w.id, 'accepted')}>
                          Accept
                        </button>
                      )}
                      {status !== 'rejected' && (
                        <button className="btn btn-xs btn-error btn-outline" onClick={() => setRole(latestDraw.id, w.id, 'rejected')}>
                          Reject & Backfill
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {latestDraw.backup_entry_ids.length > 0 && (
            <div className="mt-3 text-sm opacity-60">
              Backups in reserve: {latestDraw.backup_entry_ids.slice(latestDraw.next_backup_index).map((b) => b.label).join(', ') || 'none left'}
            </div>
          )}
        </div>
      )}

      {draws.length > 1 && (
        <div className="glass-card">
          <h2 className="mb-2 text-lg font-bold">Draw History</h2>
          <ul className="space-y-1 text-sm opacity-80">
            {draws.map((d) => (
              <li key={d.id}>
                Draw #{d.draw_number} - {new Date(d.timestamp).toLocaleString()} - {d.winner_entry_ids.length} winner(s)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
