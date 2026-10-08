// theme/themePresets.js
// Two independent systems, matching how the original giveaway dashboard
// split them: this file is the DASHBOARD theme (your own control-center
// look - sidebar, cards, buttons). Per-giveaway public branding (the
// Draw Screen viewers see) is a separate, much simpler color choice,
// defined in giveawayBranding.js.

// Each preset id must match a daisyUI theme defined in tailwind.config.js,
// except 'streamops_custom' which reuses the streamops_dark daisyUI base
// and is then painted over entirely by the CSS variables below.
export const THEME_PRESETS = [
  { id: 'streamops_dark', label: 'Violet (Default)', swatch: ['#8b5cf6', '#ec4899', '#13141f'] },
  { id: 'streamops_crimson', label: 'Crimson', swatch: ['#ef4444', '#f97316', '#161111'] },
  { id: 'streamops_emerald', label: 'Emerald', swatch: ['#10b981', '#22d3ee', '#0d1512'] },
  { id: 'streamops_royal', label: 'Royal Blue', swatch: ['#6366f1', '#3b82f6', '#0e0f1f'] },
  { id: 'light', label: 'Light', swatch: ['#570df8', '#f000b8', '#ffffff'] },
  { id: 'streamops_custom', label: 'Custom', swatch: null },
];

// The 8 customizable roles, same set the original dashboard theme editor
// exposed: Primary, Secondary/Accent, Background, Panel/Card, Text,
// Button, Winner/Highlight, Border/Glow.
export const CUSTOM_THEME_ROLES = [
  { key: 'primary', label: 'Primary Color' },
  { key: 'secondary', label: 'Secondary / Accent Color' },
  { key: 'background', label: 'Background Color' },
  { key: 'panel', label: 'Panel / Card Color' },
  { key: 'text', label: 'Text Color' },
  { key: 'button', label: 'Button Color' },
  { key: 'winner', label: 'Winner / Highlight Color' },
  { key: 'border', label: 'Border / Glow Color' },
];

export const DEFAULT_CUSTOM_THEME = {
  primary: '#8b5cf6',
  secondary: '#ec4899',
  background: '#13141f',
  panel: '#1a1b2e',
  text: '#f5f5f7',
  button: '#8b5cf6',
  winner: '#34d399',
  border: '#8b5cf6',
};

function hexToRgba(hex, alpha) {
  const clean = (hex || '#8b5cf6').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.substring(0, 2), 16) || 0;
  const g = parseInt(full.substring(2, 4), 16) || 0;
  const b = parseInt(full.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const STYLE_TAG_ID = 'streamops-custom-theme-vars';

function injectCustomThemeCss(theme) {
  const t = { ...DEFAULT_CUSTOM_THEME, ...theme };
  const css = `
:root[data-theme="streamops_custom"] {
  --sidebar-bg: ${t.background};
  --sidebar-active: ${hexToRgba(t.primary, 0.22)};
  --topbar-bg: ${hexToRgba(t.panel, 0.88)};
  --accent: ${t.primary};
  --accent-2: ${t.secondary};
  --glass-border: ${hexToRgba(t.border, 0.35)};
  --dash-bg: ${t.background};
  --dash-panel: ${hexToRgba(t.panel, 0.7)};
  --dash-text: ${t.text};
  --dash-button: ${t.button};
  --dash-winner: ${t.winner};
  --dash-winner-bg: ${hexToRgba(t.winner, 0.15)};
}
`;
  let tag = document.getElementById(STYLE_TAG_ID);
  if (!tag) {
    tag = document.createElement('style');
    tag.id = STYLE_TAG_ID;
    document.head.appendChild(tag);
  }
  tag.textContent = css;
}

// presetId + an optional custom theme object (only used when presetId is
// 'streamops_custom'). Called on login, on every theme change, and from
// Settings for a live preview before saving.
export function applyTheme(presetId, customTheme) {
  const id = presetId || 'streamops_dark';
  document.documentElement.setAttribute('data-theme', id);
  if (id === 'streamops_custom') {
    injectCustomThemeCss(customTheme || DEFAULT_CUSTOM_THEME);
  }
}

export { hexToRgba };
