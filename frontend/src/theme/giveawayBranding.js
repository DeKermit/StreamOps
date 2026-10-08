// theme/giveawayBranding.js
// The PUBLIC-facing color choice for a single giveaway's Draw Screen -
// separate from the dashboard theme in themePresets.js. This mirrors the
// original giveaway system's "Main Accent Color" picker: a small set of
// modern branding colors, stored per-giveaway as a plain hex string on
// giveaways.brand_accent and used directly by the Draw Reveal overlay.
export const ACCENT_PRESETS = [
  { id: 'blue', label: 'Blue', hex: '#3b82f6' },
  { id: 'purple', label: 'Purple', hex: '#8b5cf6' },
  { id: 'red', label: 'Red', hex: '#ef4444' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
  { id: 'green', label: 'Green', hex: '#10b981' },
  { id: 'cyan', label: 'Cyan', hex: '#22d3ee' },
  { id: 'pink', label: 'Pink', hex: '#ec4899' },
  { id: 'gold', label: 'Gold', hex: '#fbbf24' },
];

export const DEFAULT_ACCENT = '#fbbf24';

// A saved brand_accent might be a legacy value ('gold') from before this
// was switched to storing real hex colors directly - resolve either form
// to a hex string so callers never have to care which one they got.
export function resolveAccentHex(value) {
  if (!value) return DEFAULT_ACCENT;
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const preset = ACCENT_PRESETS.find((p) => p.id === value);
  return preset ? preset.hex : DEFAULT_ACCENT;
}
