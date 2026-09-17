import type { Config } from 'tailwindcss';

/**
 * Tailwind chỉ đọc lại biến CSS khai báo ở src/styles/tokens.css.
 * Không hardcode màu ở đây — tokens.css là nguồn sự thật duy nhất (§7).
 *
 * Màu trỏ vào biến KÊNH (`--x-rgb`) chứ không vào biến màu đầy đủ: chỗ
 * `<alpha-value>` là nơi Tailwind thay độ mờ của `bg-bg-base/75` vào. Trỏ vào
 * `var(--bg-base)` (mã hex) thì mọi utility có `/độ-mờ` sinh ra khai báo sai cú
 * pháp và nền biến mất không một tiếng động — xem chú thích ở tokens.css.
 */
const channel = (name: string) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: channel('bg-base'),
          elevated: channel('bg-elevated'),
          hover: channel('bg-hover'),
        },
        text: {
          primary: channel('text-primary'),
          secondary: channel('text-secondary'),
          muted: channel('text-muted'),
        },
        accent: {
          DEFAULT: channel('accent'),
          hover: channel('accent-hover'),
          /* Đã có sẵn alpha 0.14 — không nhận thêm `/độ-mờ` */
          soft: 'var(--accent-soft)',
          contrast: channel('accent-contrast'),
        },
        success: channel('success'),
        warning: channel('warning'),
        danger: channel('danger'),
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
