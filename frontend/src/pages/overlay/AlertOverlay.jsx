import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getSocket } from '../../services/socket.js';

// Pure OBS browser-source page: transparent background, no chrome, no
// auth. It only ever joins one socket room and renders whatever alert
// events arrive on it.
export default function AlertOverlay() {
  const { sessionId } = useParams();
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('join', sessionId);
    function onAlert(alert) {
      setQueue((q) => [...q, alert]);
    }
    socket.on('alert', onAlert);
    return () => {
      socket.emit('leave', sessionId);
      socket.off('alert', onAlert);
    };
  }, [sessionId]);

  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
    setLeaving(false);

    timerRef.current = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => setCurrent(null), 400);
    }, 6000);

    return () => clearTimeout(timerRef.current);
  }, [queue, current]);

  return (
    <div className="overlay-root">
      {current && (
        <div
          className={`alert-card ${leaving ? 'leaving' : ''}`}
          style={{ background: 'rgba(20,20,30,0.92)', border: '2px solid #8b5cf6', color: '#fff' }}
        >
          <div className="text-xl font-extrabold">{current.title}</div>
          {current.message && <div className="mt-1 opacity-80">{current.message}</div>}
          {current.amount && <div className="mt-1 text-lg font-bold text-green-400">{current.amount}</div>}
        </div>
      )}
    </div>
  );
}
