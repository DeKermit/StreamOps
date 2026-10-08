import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function Register() {
  const { streamer, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ displayName: '', brandName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (streamer) return <Navigate to="/dashboard" replace />;

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
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
          <p className="text-sm opacity-60">Set up your streamer control center</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card space-y-4">
          {error && <div className="alert alert-error text-sm">{error}</div>}
          <div>
            <label className="label"><span className="label-text">Your Name / Handle</span></label>
            <input className="input input-bordered w-full" value={form.displayName} onChange={set('displayName')} required autoFocus />
          </div>
          <div>
            <label className="label"><span className="label-text">Brand / Channel Name (optional)</span></label>
            <input className="input input-bordered w-full" value={form.brandName} onChange={set('brandName')} placeholder="e.g. YourChannel Live" />
          </div>
          <div>
            <label className="label"><span className="label-text">Email</span></label>
            <input type="email" className="input input-bordered w-full" value={form.email} onChange={set('email')} required />
          </div>
          <div>
            <label className="label"><span className="label-text">Password</span></label>
            <input type="password" className="input input-bordered w-full" value={form.password} onChange={set('password')} required minLength={8} />
            <label className="label"><span className="label-text-alt opacity-60">At least 8 characters</span></label>
          </div>
          <button className="btn btn-primary w-full" type="submit" disabled={busy}>
            {busy ? 'Creating account…' : 'Create Account'}
          </button>
          <p className="text-center text-sm opacity-70">
            Already have an account?{' '}
            <Link to="/login" className="link link-primary">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
