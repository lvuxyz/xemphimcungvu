import type { Config } from 'tailwindcss';

/**
 * Tailwind chỉ đọc lại biến CSS khai báo ở src/styles/tokens.css.
 * Không hardcode màu ở đây — tokens.css là nguồn sự thật duy nhất (§7).
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: 'var(--bg-base)',
          elevated: 'var(--bg-elevated)',
          hover: 'var(--bg-hover)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
          contrast: 'var(--accent-contrast)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      // §7.3 — thang spacing 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        6: '24px',
        8: '32px',
        12: '48px',
        16: '64px',
        24: '96px',
        row: '4vw', // padding ngang của ContentRow (§8.3)
      },
      borderRadius: {
        card: '4px',
        modal: '10px',
        pill: '999px',
      },
      boxShadow: {
        'elev-1': 'var(--elev-1)',
        'elev-2': 'var(--elev-2)',
        'elev-3': 'var(--elev-3)',
      },
      aspectRatio: {
        poster: '2 / 3',
        backdrop: '16 / 9',
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
      },
      transitionDuration: {
        micro: '150ms',
        standard: '300ms',
        modal: '450ms',
      },
      zIndex: {
        row: '10',
        'card-hover': '20',
        navbar: '40',
        modal: '50',
        toast: '60',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        kenburns: {
          from: { transform: 'scale(1)' },
          to: { transform: 'scale(1.08)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        kenburns: 'kenburns 20s ease-out forwards',
      },
    },
  },
  plugins: [],
};

export default config;
