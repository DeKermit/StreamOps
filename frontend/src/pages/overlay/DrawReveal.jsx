import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api.js';
import { resolveAccentHex } from '../../theme/giveawayBranding.js';

// This is the dedicated, OBS/TV-friendly tab opened via "Open Draw Screen"
// in the Giveaway Workspace. It polls the public (no-auth) giveaway
// endpoint rather than using a socket event, because a draw is a single
// moment-in-time action triggered from the dashboard tab, not a stream
// of updates - simple polling is more than fast enough and much simpler
// to reason about than wiring up a one-shot socket event.
export default function DrawReveal() {
  const { giveawayId } = useParams();
  const [giveaway, setGiveaway] = useState(null);
  const [draw, setDraw] = useState(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [error, setError] = useState('');
  const seenDrawId = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const data = await api.getPublicGiveaway(giveawayId);
        if (cancelled) return;
        setGiveaway(data.giveaway);
        if (data.latestDraw && data.latestDraw.id !== seenDrawId.current) {
          seenDrawId.current = data.latestDraw.id;
          setDraw(data.latestDraw);
          setRevealedCount(0);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }
    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [giveawayId]);

  useEffect(() => {
    if (!draw) return;
    if (revealedCount >= draw.winner_entry_ids.length) return;
    const timer = setTimeout(() => setRevealedCount((c) => c + 1), 1400);
    return () => clearTimeout(timer);
  }, [draw, revealedCount]);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-red-400">
        <div>⚠️ {error}</div>
      </div>
    );
  }

  const accent = resolveAccentHex(giveaway?.brand_accent);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center text-white"
      style={{
        background: `radial-gradient(circle at center, ${accent}22, #05050a 70%)`,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {!draw ? (
        <div className="text-center">
          <div className="mb-3 text-[4vmin] font-extrabold">{giveaway?.title || 'Loading…'}</div>
          {(giveaway?.prize_name || giveaway?.prize_image_url) && (
            <div className="mb-4 flex flex-col items-center gap-2">
              {giveaway.prize_image_url && (
                <img
                  src={giveaway.prize_image_url}
                  alt=""
                  className="h-[16vmin] w-[16vmin] rounded-2xl object-cover shadow-2xl"
                  style={{ border: `2px solid ${accent}` }}
                />
              )}
              {giveaway.prize_name && <div className="text-[2.6vmin] font-semibold" style={{ color: accent }}>🎁 {giveaway.prize_name}</div>}
            </div>
          )}
          <div className="animate-pulse text-[2.4vmin] opacity-60">Waiting for the draw to start…</div>
        </div>
      ) : (
        <div className="w-full max-w-4xl px-10 text-center">
          <div className="mb-8 text-[3vmin] font-bold uppercase tracking-widest opacity-70">{giveaway?.title}</div>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {draw.winner_entry_ids.slice(0, revealedCount).map((w, i) => (
              <div
                key={w.id}
                className="rounded-3xl px-10 py-8 shadow-2xl"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `2px solid ${accent}`,
                  boxShadow: `0 0 50px ${accent}55`,
                  animation: 'winnerPop 0.6s ease-out',
                }}
              >
                <div className="text-[2vmin] opacity-60">Winner #{i + 1}</div>
                <div className="text-[4vmin] font-extrabold" style={{ color: accent }}>
                  {w.label}
                </div>
              </div>
            ))}
            {revealedCount < draw.winner_entry_ids.length && (
              <div className="text-[3vmin] animate-pulse opacity-60">🎲 Drawing winner #{revealedCount + 1}…</div>
            )}
          </div>
        </div>
      )}
      <style>{`
        @keyframes winnerPop {
          from { transform: scale(0.7); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
