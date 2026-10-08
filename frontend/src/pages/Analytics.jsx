import React, { useEffect, useState } from 'react';
import { useSession } from '../hooks/useSession.jsx';
import { api } from '../services/api.js';
import LineChart from '../components/LineChart.jsx';

export default function Analytics() {
  const { currentSession } = useSession();
  const sessionId = currentSession?.id;
  const [activity, setActivity] = useState([]);
  const [summary, setSummary] = useState(null);
  const [range, setRange] = useState(60);

  useEffect(() => {
    if (!sessionId) return;
    function load() {
      api.getChatActivity(sessionId, range).then(setActivity);
      api.getSummary(sessionId).then(setSummary);
    }
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [sessionId, range]);

  if (!currentSession) return <div className="alert alert-info">Create a session from the top bar first.</div>;

  const points = activity.map((a) => ({ label: a.bucket.slice(11), value: a.count }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Analytics</h1>
        <p className="text-sm opacity-60">Chat activity and engagement for {currentSession.name}.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="stat-tile"><div className="text-xs uppercase opacity-50">Messages</div><div className="text-2xl font-extrabold">{summary?.totalMessages ?? '—'}</div></div>
        <div className="stat-tile"><div className="text-xs uppercase opacity-50">Unique Chatters</div><div className="text-2xl font-extrabold text-info">{summary?.uniqueChatters ?? '—'}</div></div>
        <div className="stat-tile"><div className="text-xs uppercase opacity-50">Tags Tracked</div><div className="text-2xl font-extrabold">{summary?.participants ?? '—'}</div></div>
        <div className="stat-tile"><div className="text-xs uppercase opacity-50">Confirmed</div><div className="text-2xl font-extrabold text-success">{summary?.confirmed ?? '—'}</div></div>
        <div className="stat-tile"><div className="text-xs uppercase opacity-50">Alerts Fired</div><div className="text-2xl font-extrabold text-secondary">{summary?.alerts ?? '—'}</div></div>
        <div className="stat-tile"><div className="text-xs uppercase opacity-50">Draws Run</div><div className="text-2xl font-extrabold">{summary?.draws ?? '—'}</div></div>
      </div>

      <div className="glass-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Chat Activity</h2>
          <div className="flex gap-1">
            {[30, 60, 180].map((m) => (
              <button key={m} className={`btn btn-xs ${range === m ? 'btn-primary' : 'btn-outline'}`} onClick={() => setRange(m)}>
                {m}m
              </button>
            ))}
          </div>
        </div>
        <LineChart points={points} />
        <div className="mt-2 flex justify-between text-xs opacity-50">
          <span>{points[0]?.label}</span>
          <span>{points[points.length - 1]?.label}</span>
        </div>
      </div>
    </div>
  );
}
