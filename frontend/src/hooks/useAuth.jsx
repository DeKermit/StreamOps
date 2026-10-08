import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [streamer, setStreamer] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem('streamops_token');
    if (!token) {
      setStreamer(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.me();
      setStreamer(me);
    } catch {
      localStorage.removeItem('streamops_token');
      setStreamer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  async function login(email, password) {
    const { token, streamer: s } = await api.login({ email, password });
    localStorage.setItem('streamops_token', token);
    setStreamer(s);
  }

  async function register(payload) {
    const { token, streamer: s } = await api.register(payload);
    localStorage.setItem('streamops_token', token);
    setStreamer(s);
  }

  function logout() {
    localStorage.removeItem('streamops_token');
    setStreamer(null);
  }

  async function refresh() {
    await loadMe();
  }

  return (
    <AuthContext.Provider value={{ streamer, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
