import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { api } from '../services/api.js';
import { THEME_PRESETS, CUSTOM_THEME_ROLES, DEFAULT_CUSTOM_THEME, applyTheme } from '../theme/themePresets.js';
import { fileToDataUrl } from '../utils/imageUpload.js';

const TABS = [
  { id: 'profile', label: '👤 Profile' },
  { id: 'theme', label: '🎨 Theme & Appearance' },
  { id: 'youtube', label: '📡 YouTube API' },
  { id: 'account', label: '⚙️ Account' },
];

function ProfileTab() {
  const { streamer, refresh } = useAuth();
  const [displayName, setDisplayName] = useState(streamer?.display_name || '');
  const [brandName, setBrandName] = useState(streamer?.brand_name || '');
  const [avatarPreview, setAvatarPreview] = useState(streamer?.avatar_url || null);
  const [avatarError, setAvatarError] = useState('');
  const [saved, setSaved] = useState(false);

  async function saveProfile(e) {
    e.preventDefault();
    await api.updateMe({ display_name: displayName, brand_name: brandName, avatar_url: avatarPreview });
    setSaved(true);
    refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  async function onAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError('');
    try {
      const dataUrl = await fileToDataUrl(file);
      setAvatarPreview(dataUrl);
    } catch (err) {
      setAvatarError(err.message);
    } finally {
      e.target.value = '';
    }
  }

  function removeAvatar() {
    setAvatarPreview(null);
  }

  return (
    <form onSubmit={saveProfile} className="glass-card space-y-3">
      <h2 className="text-lg font-bold">Profile</h2>
      {saved && <div className="alert alert-success text-sm">Saved.</div>}
      {avatarError && <div className="alert alert-error text-sm">{avatarError}</div>}

      <div className="flex items-center gap-4">
        <div className="avatar">
          <div className="h-16 w-16 rounded-full bg-base-300 ring-2 ring-white/10">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar preview" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold opacity-50">
                {(displayName || '?').slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="btn btn-outline btn-sm">
            Change Picture
            <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
          </label>
          {avatarPreview && (
            <button type="button" className="btn btn-ghost btn-xs text-error" onClick={removeAvatar}>
              Remove
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="label"><span className="label-text">Your Name / Handle</span></label>
        <input className="input input-bordered w-full" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <div>
        <label className="label"><span className="label-text">Brand / Channel Name</span></label>
        <input className="input input-bordered w-full" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
      </div>
      <button className="btn btn-primary btn-sm" type="submit">Save Profile</button>
    </form>
  );
}

function ThemeTab() {
  const { streamer, refresh } = useAuth();
  const [custom, setCustom] = useState({ ...DEFAULT_CUSTOM_THEME, ...(streamer?.dashboard_theme || {}) });
  const [saved, setSaved] = useState(false);
  const isCustomActive = streamer?.theme_preset === 'streamops_custom';

  async function selectPreset(presetId) {
    applyTheme(presetId, custom);
    await api.updateMe({ theme_preset: presetId });
    refresh();
  }

  function previewCustom(nextCustom) {
    setCustom(nextCustom);
    applyTheme('streamops_custom', nextCustom);
  }

  function setRole(key, value) {
    previewCustom({ ...custom, [key]: value });
  }

  async function saveCustom() {
    await api.updateMe({ theme_preset: 'streamops_custom', dashboard_theme: custom });
    setSaved(true);
    refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  function resetCustom() {
    previewCustom(DEFAULT_CUSTOM_THEME);
  }

  return (
    <div className="space-y-4">
      <div className="glass-card">
        <h2 className="mb-3 text-lg font-bold">Theme Presets</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => selectPreset(preset.id)}
              className={`rounded-xl border p-3 text-left transition ${
                streamer?.theme_preset === preset.id ? 'border-primary ring-2 ring-primary/40' : 'border-white/10'
              }`}
            >
              <div className="mb-2 flex gap-1">
                {preset.swatch ? (
                  preset.swatch.map((c, i) => <span key={i} className="h-5 w-5 rounded-full" style={{ background: c }} />)
                ) : (
                  <span className="flex h-5 items-center text-sm">🎨✨</span>
                )}
              </div>
              <div className="text-sm font-medium">{preset.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Custom Colors</h2>
          {!isCustomActive && <span className="badge badge-ghost badge-sm">Select "Custom" above to activate</span>}
        </div>
        {saved && <div className="alert alert-success mb-3 text-sm">Saved.</div>}
        <p className="mb-3 text-sm opacity-60">
          Changes preview instantly across the dashboard as you pick colors. Click "Save Custom Theme" to keep them.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CUSTOM_THEME_ROLES.map((role) => (
            <div key={role.key} className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium">{role.label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                  value={custom[role.key]}
                  onChange={(e) => setRole(role.key, e.target.value)}
                />
                <span className="font-mono text-xs opacity-50">{custom[role.key]}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={saveCustom}>
            Save Custom Theme
          </button>
          <button className="btn btn-ghost btn-sm" onClick={resetCustom}>
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}

function YoutubeTab() {
  const { streamer, refresh } = useAuth();
  const [apiKey, setApiKey] = useState('');

  async function saveApiKey(e) {
    e.preventDefault();
    if (!apiKey.trim()) return;
    await api.updateMe({ youtube_api_key: apiKey.trim() });
    setApiKey('');
    refresh();
  }

  return (
    <form onSubmit={saveApiKey} className="glass-card space-y-3">
      <h2 className="text-lg font-bold">YouTube Data API Key</h2>
      <p className="text-sm opacity-60">
        Save your key here once and every new session's Chat Connection tab will use it automatically - no need to re-paste it each
        time. The key is never sent back to the browser once saved ({streamer?.has_youtube_api_key ? 'a key is currently saved' : 'no key saved yet'}).
      </p>
      <input type="password" className="input input-bordered w-full" placeholder="AIza…" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
      <button className="btn btn-outline btn-sm" type="submit">Save Key</button>
    </form>
  );
}

function AccountTab() {
  const { streamer } = useAuth();
  return (
    <div className="glass-card text-sm opacity-60">
      Signed in as <strong>{streamer?.email}</strong>.
    </div>
  );
}

export default function Settings() {
  const [tab, setTab] = useState('profile');

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Settings</h1>
        <p className="text-sm opacity-60">Branding, theme, and account.</p>
      </div>

      <div className="tabs tabs-boxed w-fit">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'tab-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && <ProfileTab />}
      {tab === 'theme' && <ThemeTab />}
      {tab === 'youtube' && <YoutubeTab />}
      {tab === 'account' && <AccountTab />}
    </div>
  );
}
