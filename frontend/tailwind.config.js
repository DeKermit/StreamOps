/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        streamops_dark: {
          primary: '#8b5cf6',
          secondary: '#ec4899',
          accent: '#22d3ee',
          neutral: '#1a1b2e',
          'base-100': '#13141f',
          'base-200': '#1a1b2e',
          'base-300': '#24263d',
          info: '#38bdf8',
          success: '#34d399',
          warning: '#fbbf24',
          error: '#f87171',
        },
      },
      {
        streamops_crimson: {
          primary: '#ef4444',
          secondary: '#f97316',
          accent: '#facc15',
          neutral: '#1a1414',
          'base-100': '#161111',
          'base-200': '#1f1717',
          'base-300': '#2a1e1e',
          info: '#38bdf8',
          success: '#34d399',
          warning: '#fbbf24',
          error: '#f87171',
        },
      },
      {
        streamops_emerald: {
          primary: '#10b981',
          secondary: '#22d3ee',
          accent: '#a3e635',
          neutral: '#0f1a16',
          'base-100': '#0d1512',
          'base-200': '#13201b',
          'base-300': '#1b2d25',
          info: '#38bdf8',
          success: '#34d399',
          warning: '#fbbf24',
          error: '#f87171',
        },
      },
      {
        streamops_royal: {
          primary: '#6366f1',
          secondary: '#3b82f6',
          accent: '#f472b6',
          neutral: '#121328',
          'base-100': '#0e0f1f',
          'base-200': '#161831',
          'base-300': '#1f2242',
          info: '#38bdf8',
          success: '#34d399',
          warning: '#fbbf24',
          error: '#f87171',
        },
      },
      {
        // Base daisyUI values for the "Custom" preset. These are only a
        // fallback for daisyUI's own internal components (inputs, toggles,
        // etc.) - the actual look is painted over at runtime by the CSS
        // variables injected from the Settings > Theme color pickers
        // (see src/theme/themePresets.js).
        streamops_custom: {
          primary: '#8b5cf6',
          secondary: '#ec4899',
          accent: '#22d3ee',
          neutral: '#1a1b2e',
          'base-100': '#13141f',
          'base-200': '#1a1b2e',
          'base-300': '#24263d',
          info: '#38bdf8',
          success: '#34d399',
          warning: '#fbbf24',
          error: '#f87171',
        },
      },
      'light',
    ],
    darkTheme: 'streamops_dark',
  },
};
