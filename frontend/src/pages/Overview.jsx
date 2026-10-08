import React from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../hooks/useSession.jsx';
import { useSessionSocket } from '../hooks/useSessionSocket.js';
import { useAuth } from '../hooks/useAuth.jsx';

function Tile({ icon, label, value, tone }) {
  return (
    <div className="stat-tile">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest opacity-50">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className={`mt-1 text-3xl font-extrabold ${tone || ''}`}>{value ?? '—'}</div>
    </div>
  );
}

function QuickAction({ to, icon, title, desc }) {
  return (
    <Link to={to} className="glass-card flex items-start gap-3 transition hover:border-primary/40 hover:bg-primary/5">
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm opacity-60">{desc}</div>
      </div>
    </Link>
  );
}

export default function Overview() {
  const { streamer } = useAuth();
  const { currentSession, currentSessionId } = useSession();
  const { stats, activity, connectionStatus } = useSessionSocket(currentSessionId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Welcome back, {streamer?.display_name} 👋</h1>
        <p className="text-sm opacity-60">
          {currentSession ? `Session: ${currentSession.name}` : 'Create a session from the top bar to get started.'}
        </p>
      </div>

      {!currentSession ? (
        <div className="alert alert-info">Create a stream session above, then head to Chat Connection to go live.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Tile icon="📡" label="Status" value={connectionStatus} tone={connectionStatus === 'connected' ? 'text-success' : ''} />
            <Tile icon="💬" label="Chat Messages" value={stats?.totalMessages} />
            <Tile icon="🙋" label="Unique Chatters" value={stats?.uniqueChatters} tone="text-info" />
            <Tile icon="🏷️" label="Tags Tracked" value={stats?.participants} />
            <Tile icon="🔔" label="Alerts Fired" value={stats?.alerts} tone="text-secondary" />
            <Tile icon="🚩" label="Open Flags" value={stats?.openFlags} tone="text-error" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <QuickAction to="/connection" icon="📡" title="Connect Chat" desc="Link a live YouTube broadcast" />
            <QuickAction to="/giveaways" icon="🎁" title="Run a Giveaway" desc="Create, draw, and reveal winners" />
            <QuickAction to="/tags" icon="🏷️" title="Manage Tags" desc="Review pending Clash of Clans tags" />
            <QuickAction to="/alerts" icon="🔔" title="Alerts & Overlays" desc="Grab your OBS browser-source URLs" />
            <QuickAction to="/polls" icon="📊" title="Launch a Poll" desc="Ask chat to vote with !vote" />
            <QuickAction to="/analytics" icon="📈" title="View Analytics" desc="Chat activity over time" />
          </div>

          <div className="glass-card">
            <h2 className="mb-3 text-lg font-bold">📡 Recent Activity</h2>
            <div className="max-h-72 space-y-2 overflow-y-auto text-sm">
              {activity.length === 0 && <div className="opacity-50">No activity yet - connect your chat to get started.</div>}
              {activity.map((a) => (
                <div key={a.id} className="rounded-lg bg-base-200/60 px-3 py-2">
                  <div className="text-xs opacity-50">{new Date(a.timestamp).toLocaleTimeString()}</div>
                  <div>{a.message}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
