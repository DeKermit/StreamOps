import { useEffect, useState, useCallback } from 'react';
import { getSocket } from '../services/socket.js';
import { api } from '../services/api.js';

// Centralizes the one Socket.IO room subscription a session view needs:
// live stats, the activity feed, alert/poll/mod-flag pushes, and a
// "something about participants changed, go re-fetch" signal (the list
// itself is paginated/filtered client-side, so we don't push full rows).
export function useSessionSocket(sessionId) {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [participantsVersion, setParticipantsVersion] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [latestAlert, setLatestAlert] = useState(null);
  const [latestFlag, setLatestFlag] = useState(null);
  const [latestPoll, setLatestPoll] = useState(null);

  const refreshStats = useCallback(() => {
    if (!sessionId) return;
    api.getSummary(sessionId).then((s) => setStats((prev) => ({ ...prev, ...s }))).catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const socket = getSocket();
    socket.emit('join', sessionId);

    api.getConnectionStatus(sessionId).then((s) => setConnectionStatus(s.status)).catch(() => {});
    refreshStats();

    function onActivity(entry) {
      setActivity((prev) => [entry, ...prev].slice(0, 50));
    }
    function onStats(s) {
      setStats(s);
    }
    function onParticipantsChanged() {
      setParticipantsVersion((v) => v + 1);
    }
    function onAlert(a) {
      setLatestAlert(a);
    }
    function onModFlag(f) {
      setLatestFlag(f);
    }
    function onPoll(p) {
      setLatestPoll(p);
    }

    socket.on('activity', onActivity);
    socket.on('stats', onStats);
    socket.on('participants_changed', onParticipantsChanged);
    socket.on('alert', onAlert);
    socket.on('mod_flag', onModFlag);
    socket.on('poll', onPoll);

    return () => {
      socket.emit('leave', sessionId);
      socket.off('activity', onActivity);
      socket.off('stats', onStats);
      socket.off('participants_changed', onParticipantsChanged);
      socket.off('alert', onAlert);
      socket.off('mod_flag', onModFlag);
      socket.off('poll', onPoll);
    };
  }, [sessionId, refreshStats]);

  return { stats, activity, connectionStatus, participantsVersion, refreshStats, latestAlert, latestFlag, latestPoll };
}
