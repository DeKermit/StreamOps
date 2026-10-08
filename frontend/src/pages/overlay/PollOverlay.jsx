import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSocket } from '../../services/socket.js';
import { api } from '../../services/api.js';

export default function PollOverlay() {
  const { sessionId } = useParams();
  const [poll, setPoll] = useState(null);

  useEffect(() => {
    api.getPublicPoll(sessionId).then(setPoll).catch(() => {});
    const socket = getSocket();
    socket.emit('join', sessionId);
    function onPoll(p) {
      setPoll(p && p.status === 'live' ? p : p && p.status === 'closed' ? p : null);
    }
    socket.on('poll', onPoll);
    return () => {
      socket.emit('leave', sessionId);
      socket.off('poll', onPoll);
    };
  }, [sessionId]);

  if (!poll) return <div className="overlay-root" />;

  return (
    <div className="overlay-root" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div
        className="w-[36vw] min-w-[320px] rounded-2xl p-6 text-white shadow-2xl"
        style={{ background: 'rgba(15,15,25,0.92)', border: '2px solid #8b5cf6' }}
      >
        <div className="mb-3 text-xl font-extrabold">{poll.question}</div>
        <div className="space-y-2">
          {poll.options.map((opt, i) => {
            const pct = poll.total_votes ? Math.round((poll.counts[i] / poll.total_votes) * 100) : 0;
            return (
              <div key={i}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{opt}</span>
                  <span className="opacity-70">{pct}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                  <div className="poll-bar-fill h-full rounded-full" style={{ width: `${pct}%`, background: '#8b5cf6' }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-right text-xs opacity-50">{poll.total_votes} votes</div>
      </div>
    </div>
  );
}
