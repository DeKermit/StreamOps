import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useSession } from '../hooks/useSession.jsx';
import { api } from '../services/api.js';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [{ to: '/dashboard', icon: '🏠', label: 'Dashboard' }],
  },
  {
    label: 'Stream Tools',
    items: [
      { to: '/connection', icon: '📡', label: 'Chat Connection' },
      { to: '/giveaways', icon: '🎁', label: 'Giveaways' },
      { to: '/tags', icon: '🏷️', label: 'Tag Manager' },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { to: '/alerts', icon: '🔔', label: 'Alerts & Overlays' },
      { to: '/polls', icon: '📊', label: 'Polls' },
      { to: '/moderation', icon: '🛡️', label: 'Moderation' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/analytics', icon: '📈', label: 'Analytics' },
      { to: '/settings', icon: '⚙️', label: 'Settings' },
    ],
  },
];

const STATUS_DOT = {
  connected: 'bg-success',
  paused: 'bg-warning',
  disconnected: 'bg-base-content/30',
};

export default function DashboardLayout({ children }) {
  const { streamer, logout } = useAuth();
  const { sessions, currentSession, currentSessionId, setCurrentSessionId, createSession } = useSession();
  const navigate = useNavigate();
  const [showNewSession, setShowNewSession] = useState(false);
  const [newName, setNewName] = useState('');
  const [connStatus, setConnStatus] = useState('disconnected');

  async function handleCreateSession(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    const session = await createSession(newName.trim());
    setNewName('');
    setShowNewSession(false);
    navigate('/connection');
  }

  React.useEffect(() => {
    if (!currentSessionId) return;
    api.getConnectionStatus(currentSessionId).then((s) => setConnStatus(s.status)).catch(() => {});
  }, [currentSessionId]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="mark">🎮</span>
          Stream<span className="gradient-text">Ops</span>
        </div>

        <nav className="flex-1 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="nav-section-label">{section.label}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-4 border-t border-white/5 pt-3">
          <div className="nav-link" style={{ cursor: 'default' }}>
            {streamer?.avatar_url ? (
              <img src={streamer.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
            ) : (
              <span>👤</span>
            )}
            <div className="truncate">
              <div className="truncate text-sm font-semibold">{streamer?.display_name}</div>
              <div className="truncate text-xs opacity-50">{streamer?.brand_name}</div>
            </div>
          </div>
          <button className="nav-link w-full text-left" onClick={handleLogout}>
            <span>🚪</span> Log Out
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="topbar">
          <div className="flex items-center gap-3 px-5 py-3">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[connStatus] || STATUS_DOT.disconnected}`} />
            <select
              className="select select-bordered select-sm max-w-[220px]"
              value={currentSessionId || ''}
              onChange={(e) => setCurrentSessionId(e.target.value)}
            >
              {sessions.length === 0 && <option value="">No sessions yet</option>}
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {!showNewSession ? (
              <button className="btn btn-sm btn-outline" onClick={() => setShowNewSession(true)}>
                + New Session
              </button>
            ) : (
              <form onSubmit={handleCreateSession} className="flex items-center gap-2">
                <input
                  className="input input-bordered input-sm"
                  placeholder="e.g. Friday Night Stream"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
                <button className="btn btn-sm btn-primary" type="submit">
                  Create
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowNewSession(false)}>
                  Cancel
                </button>
              </form>
            )}

            <div className="ml-auto text-sm opacity-60">{currentSession ? currentSession.name : 'Create a session to get started'}</div>
          </div>
        </header>

        <main className="main-content flex-1">{children}</main>
      </div>
    </div>
  );
}
