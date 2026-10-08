import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../services/api.js';
import { useAuth } from './useAuth.jsx';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const { streamer } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  const reloadSessions = useCallback(async () => {
    if (!streamer) {
      setSessions([]);
      return;
    }
    const rows = await api.listSessions();
    setSessions(rows);
    if (!currentSessionId && rows.length) setCurrentSessionId(rows[0].id);
  }, [streamer, currentSessionId]);

  useEffect(() => {
    reloadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamer]);

  async function createSession(name) {
    const session = await api.createSession(name);
    await reloadSessions();
    setCurrentSessionId(session.id);
    return session;
  }

  const currentSession = sessions.find((s) => s.id === currentSessionId) || null;

  return (
    <SessionContext.Provider
      value={{ sessions, currentSession, currentSessionId, setCurrentSessionId, createSession, reloadSessions }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
