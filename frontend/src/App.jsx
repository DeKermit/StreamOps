import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { SessionProvider } from './hooks/useSession.jsx';
import { applyTheme } from './theme/themePresets.js';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import DashboardLayout from './components/DashboardLayout.jsx';
import Overview from './pages/Overview.jsx';
import Connection from './pages/Connection.jsx';
import Giveaways from './pages/Giveaways.jsx';
import GiveawayWorkspace from './pages/GiveawayWorkspace.jsx';
import TagManager from './pages/TagManager.jsx';
import Alerts from './pages/Alerts.jsx';
import Polls from './pages/Polls.jsx';
import Moderation from './pages/Moderation.jsx';
import Analytics from './pages/Analytics.jsx';
import Settings from './pages/Settings.jsx';

import DrawReveal from './pages/overlay/DrawReveal.jsx';
import AlertOverlay from './pages/overlay/AlertOverlay.jsx';
import PollOverlay from './pages/overlay/PollOverlay.jsx';

function ThemeSync() {
  const { streamer } = useAuth();
  useEffect(() => {
    applyTheme(streamer?.theme_preset, streamer?.dashboard_theme);
  }, [streamer?.theme_preset, streamer?.dashboard_theme]);
  return null;
}

function RequireAuth({ children }) {
  const { streamer, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm opacity-60">Loading StreamOps…</div>;
  if (!streamer) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Public OBS overlay + draw-reveal routes - no auth, no sidebar shell */}
      <Route path="/overlay/alerts/:sessionId" element={<AlertOverlay />} />
      <Route path="/overlay/poll/:sessionId" element={<PollOverlay />} />
      <Route path="/draw/:giveawayId" element={<DrawReveal />} />

      <Route
        path="/*"
        element={
          <RequireAuth>
            <SessionProvider>
              <DashboardLayout>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Overview />} />
                  <Route path="/connection" element={<Connection />} />
                  <Route path="/giveaways" element={<Giveaways />} />
                  <Route path="/giveaways/:id" element={<GiveawayWorkspace />} />
                  <Route path="/tags" element={<TagManager />} />
                  <Route path="/alerts" element={<Alerts />} />
                  <Route path="/polls" element={<Polls />} />
                  <Route path="/moderation" element={<Moderation />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </DashboardLayout>
            </SessionProvider>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeSync />
      <AppRoutes />
    </AuthProvider>
  );
}
