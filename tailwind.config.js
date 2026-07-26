/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // === Semantic tokens (driven by CSS variables in index.css) ===
        bg: 'rgb(var(--bg) / <alpha-value>)',                  // app background (deepest)
        surface: 'rgb(var(--surface) / <alpha-value>)',        // panels / cards
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',  // elevated panels
        'surface-3': 'rgb(var(--surface-3) / <alpha-value>)',  // hover / raised
        line: 'rgb(var(--line) / <alpha-value>)',              // default borders
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        content: 'rgb(var(--content) / <alpha-value>)',        // primary text
        muted: 'rgb(var(--muted) / <alpha-value>)',            // secondary text
        subtle: 'rgb(var(--subtle) / <alpha-value>)',          // tertiary / placeholder

        // Brand accent (emerald/mint) — richer on dark
        brand: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          fg: 'rgb(var(--brand-fg) / <alpha-value>)',
        },
        // Secondary accent (violet) for a game-tool feel
        iris: {
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b7cf6',
          600: '#7c6cf0',
          700: '#6d5ce0',
        },
      },
      fontFamily: {
        sans: [
          'Inter var', 'Inter', 'system-ui', '-apple-system', 'Segoe UI',
          'Roboto', '"Helvetica Neue"', '"PingFang SC"', '"Microsoft YaHei"',
          '"Noto Sans SC"', 'sans-serif',
        ],
        display: [
          '"Space Grotesk"', 'Inter var', 'Inter', 'system-ui', 'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo',
          'Consolas', 'monospace',
        ],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.30), 0 8px 24px -12px rgb(0 0 0 / 0.55)',
        elevated: '0 4px 12px -2px rgb(0 0 0 / 0.4), 0 24px 48px -16px rgb(0 0 0 / 0.6)',
        glow: '0 0 0 1px rgb(var(--brand) / 0.35), 0 8px 32px -8px rgb(var(--brand) / 0.45)',
        'inset-line': 'inset 0 1px 0 0 rgb(255 255 255 / 0.04)',
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(rgb(var(--line) / 0.5) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--line) / 0.5) 1px, transparent 1px)',
        'brand-sheen':
          'linear-gradient(135deg, rgb(var(--brand) / 0.18), transparent 55%)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'fade-in-up': 'fade-in-up 0.3s ease-out both',
        'scale-in': 'scale-in 0.18s ease-out both',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
