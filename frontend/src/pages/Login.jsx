import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function Login() {
  const { streamer, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (streamer) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-lg"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}
          >
            🎮
          </div>
          <h1 className="text-2xl font-extrabold">
            Stream<span className="gradient-text">Ops</span>
          </h1>
          <p className="text-sm opacity-60">Your live streamer control center</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card space-y-4">
          {error && <div className="alert alert-error text-sm">{error}</div>}
          <div>
            <label className="label"><span className="label-text">Email</span></label>
            <input
              type="email"
              className="input input-bordered w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label"><span className="label-text">Password</span></label>
            <input
              type="password"
              className="input input-bordered w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary w-full" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
          <p className="text-center text-sm opacity-70">
            No account yet?{' '}
            <Link to="/register" className="link link-primary">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
