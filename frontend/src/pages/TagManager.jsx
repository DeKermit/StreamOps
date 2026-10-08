import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from '../hooks/useSession.jsx';
import { useSessionSocket } from '../hooks/useSessionSocket.js';
import { api, downloadFile } from '../services/api.js';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'username', label: 'Username' },
  { value: 'player_tag', label: 'Player Tag' },
  { value: 'status', label: 'Status' },
];

function ManualAddForm({ sessionId, onAdded }) {
  const [username, setUsername] = useState('');
  const [tag, setTag] = useState('');
  const [confirmImmediately, setConfirmImmediately] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    try {
      await api.addParticipant({ sessionId, youtubeUsername: username, playerTag: tag, confirmImmediately });
      setUsername('');
      setTag('');
      setConfirmImmediately(false);
      onAdded();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="glass-card mb-6">
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen((v) => !v)}>
        <h2 className="text-lg font-bold">➕ Manual Entry</h2>
        <span className="text-sm opacity-60">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <form onSubmit={handleAdd} className="mt-3 space-y-3">
          {error && <div className="alert alert-error text-sm">{error}</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input className="input input-bordered" placeholder="YouTube Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            <input className="input input-bordered font-mono" placeholder="#PLAYERTAG" value={tag} onChange={(e) => setTag(e.target.value)} required />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="checkbox checkbox-sm" checked={confirmImmediately} onChange={(e) => setConfirmImmediately(e.target.checked)} />
            Confirm immediately (otherwise starts Pending)
          </label>
          <button className="btn btn-primary btn-sm" type="submit">Add Player</button>
        </form>
      )}
    </div>
  );
}

function EditParticipantModal({ sessionId, row, onClose, onSaved }) {
  const [username, setUsername] = useState(row.youtube_username);
  const [tag, setTag] = useState(row.normalized_player_tag);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.updateParticipant(row.id, { sessionId, youtubeUsername: username, playerTag: tag });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="text-lg font-bold">Edit Participant</h3>
        <form onSubmit={save} className="mt-3 space-y-3">
          {error && <div className="alert alert-error text-sm">{error}</div>}
          <div>
            <label className="label"><span className="label-text">YouTube Username</span></label>
            <input className="input input-bordered w-full" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div>
            <label className="label"><span className="label-text">Player Tag</span></label>
            <input className="input input-bordered w-full font-mono" value={tag} onChange={(e) => setTag(e.target.value)} required />
          </div>
          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserProfileModal({ sessionId, username, onClose }) {
  const [tags, setTags] = useState([]);
  useEffect(() => {
    api.getUserTags(sessionId, username).then(setTags);
  }, [sessionId, username]);

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="text-lg font-bold">@{username}</h3>
        <p className="py-1 text-sm opacity-60">Registered Accounts: {tags.length}</p>
        <ul className="space-y-2">
          {tags.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded bg-base-200 px-3 py-2">
              <span className="font-mono">{t.normalized_player_tag}</span>
              <span className={t.status === 'confirmed' ? 'badge-confirmed' : 'badge-pending'}>
                {t.status === 'confirmed' ? '🟢 Confirmed' : '🟡 Pending'}
              </span>
            </li>
          ))}
        </ul>
        <div className="modal-action">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function TagManager() {
  const { currentSession } = useSession();
  const sessionId = currentSession?.id;
  const { participantsVersion, refreshStats } = useSessionSocket(sessionId);

  const [rows, setRows] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState(new Set());
  const [profileUser, setProfileUser] = useState(null);
  const [editingRow, setEditingRow] = useState(null);

  const load = useCallback(() => {
    if (!sessionId) return;
    if (filter === 'duplicates') {
      api.listDuplicates(sessionId).then(setDuplicates);
      return;
    }
    api.listParticipants(sessionId, { status: filter === 'all' ? undefined : filter, search, sort }).then(setRows);
  }, [sessionId, filter, search, sort]);

  useEffect(load, [load, participantsVersion]);

  if (!currentSession) {
    return <div className="alert alert-info">Create a session from the top bar first.</div>;
  }
  if (!currentSession.coc_tracking_enabled) {
    return (
      <div className="alert alert-warning">
        Clash of Clans tag tracking is off for this session. Turn it on from the Chat Connection tab to start collecting tags.
      </div>
    );
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function confirmOne(id) {
    await api.confirmParticipant(id, sessionId);
    load();
    refreshStats();
  }
  async function pendingOne(id) {
    await api.unpendParticipant(id, sessionId);
    load();
    refreshStats();
  }
  async function deleteOne(row) {
    if (!window.confirm(`Delete @${row.youtube_username} ${row.normalized_player_tag}?`)) return;
    await api.deleteParticipant(row.id, sessionId);
    load();
    refreshStats();
  }
  async function bulk(action) {
    if (selected.size === 0) return;
    await api.bulkAction(sessionId, Array.from(selected), action);
    setSelected(new Set());
    load();
    refreshStats();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Tag Manager</h1>
        <p className="text-sm opacity-60">Clash of Clans player tags detected in chat for {currentSession.name}.</p>
      </div>

      <ManualAddForm sessionId={sessionId} onAdded={() => { load(); refreshStats(); }} />

      <div className="glass-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Participants</h2>
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-sm btn-outline">Export</label>
            <ul tabIndex={0} className="dropdown-content menu z-10 w-52 rounded-box bg-base-200 p-2 shadow">
              <li><a onClick={() => downloadFile(api.exportParticipantsUrl(sessionId, 'all', 'csv'), 'participants-all.csv')}>CSV - All</a></li>
              <li><a onClick={() => downloadFile(api.exportParticipantsUrl(sessionId, 'confirmed', 'csv'), 'participants-confirmed.csv')}>CSV - Confirmed Only</a></li>
              <li><a onClick={() => downloadFile(api.exportParticipantsUrl(sessionId, 'pending', 'csv'), 'participants-pending.csv')}>CSV - Pending Only</a></li>
              <li><a onClick={() => downloadFile(api.exportParticipantsUrl(sessionId, 'all', 'json'), 'participants-all.json')}>JSON - All</a></li>
            </ul>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {['all', 'pending', 'confirmed', 'duplicates'].map((f) => (
            <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(f)}>
              {f === 'all' && 'All'}
              {f === 'pending' && '🟡 Pending'}
              {f === 'confirmed' && '🟢 Confirmed'}
              {f === 'duplicates' && '♻️ Duplicates'}
            </button>
          ))}
          {filter !== 'duplicates' && (
            <>
              <input className="input input-bordered input-sm flex-1 min-w-[160px]" placeholder="Search @username or #TAG" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="select select-bordered select-sm" value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </>
          )}
        </div>

        {filter === 'duplicates' ? (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>YouTube User</th>
                  <th>Attempted Tag</th>
                  <th>Already Owned By</th>
                  <th>Attempted At</th>
                </tr>
              </thead>
              <tbody>
                {duplicates.map((d) => (
                  <tr key={d.id}>
                    <td>@{d.youtube_username}</td>
                    <td className="font-mono">{d.normalized_player_tag}</td>
                    <td><span className="badge-duplicate">♻️ @{d.owned_by_username}</span></td>
                    <td className="text-xs opacity-60">{new Date(d.attempted_at).toLocaleString()}</td>
                  </tr>
                ))}
                {duplicates.length === 0 && (
                  <tr><td colSpan={4} className="text-center opacity-50">No duplicate attempts recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {selected.size > 0 && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-base-300 p-2 text-sm">
                <span>{selected.size} selected</span>
                <button className="btn btn-xs btn-success" onClick={() => bulk('confirm')}>Confirm Selected</button>
                <button className="btn btn-xs btn-warning" onClick={() => bulk('pending')}>Move to Pending</button>
                <button className="btn btn-xs btn-error" onClick={() => bulk('delete')}>Delete Selected</button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th></th>
                    <th>YouTube User</th>
                    <th>Player Tag</th>
                    <th>Status</th>
                    <th>Detected</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td><input type="checkbox" className="checkbox checkbox-sm" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                      <td><button className="link" onClick={() => setProfileUser(r.youtube_username)}>@{r.youtube_username}</button></td>
                      <td className="font-mono">{r.normalized_player_tag}</td>
                      <td>
                        <span className={r.status === 'confirmed' ? 'badge-confirmed' : 'badge-pending'}>
                          {r.status === 'confirmed' ? '🟢 Confirmed' : '🟡 Pending'}
                        </span>
                      </td>
                      <td className="text-xs opacity-60">{new Date(r.detected_at).toLocaleTimeString()}</td>
                      <td className="flex gap-1">
                        {r.status === 'pending' ? (
                          <button className="btn btn-xs btn-success" onClick={() => confirmOne(r.id)}>✅ Confirm</button>
                        ) : (
                          <button className="btn btn-xs btn-outline" onClick={() => pendingOne(r.id)}>↩ Pending</button>
                        )}
                        <button className="btn btn-xs btn-outline" onClick={() => setEditingRow(r)}>Edit</button>
                        <button className="btn btn-xs btn-error btn-outline" onClick={() => deleteOne(r)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={6} className="text-center opacity-50">No participants in this filter yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {profileUser && <UserProfileModal sessionId={sessionId} username={profileUser} onClose={() => setProfileUser(null)} />}
        {editingRow && (
          <EditParticipantModal
            sessionId={sessionId}
            row={editingRow}
            onClose={() => setEditingRow(null)}
            onSaved={() => { setEditingRow(null); load(); refreshStats(); }}
          />
        )}
      </div>
    </div>
  );
}
