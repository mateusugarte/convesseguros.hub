/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          primary:   '#1A3A6B',
          secondary: '#2B5BA8',
          accent:    '#4A90D9',
          gold:      '#C9A84C',
        },
        // These colors respond to the theme via CSS variables in index.css
        dark: {
          bg:       'rgb(var(--color-bg) / <alpha-value>)',
          surface:  'rgb(var(--color-surface) / <alpha-value>)',
          surface2: 'rgb(var(--color-surface2) / <alpha-value>)',
          border:   'rgb(var(--color-border) / <alpha-value>)',
          text:     'rgb(var(--color-text) / <alpha-value>)',
          muted:    'rgb(var(--color-muted) / <alpha-value>)',
        },
        status: {
          success: 'rgb(var(--color-success) / <alpha-value>)',
          warning: 'rgb(var(--color-warning) / <alpha-value>)',
          danger:  'rgb(var(--color-danger) / <alpha-value>)',
          info:    'rgb(var(--color-info) / <alpha-value>)',
        },
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#4A90D9',
          600: '#2B5BA8',
          700: '#1A3A6B',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-in-r': 'slideInR 0.25s ease-out',
        'slide-up':   'slideUp 0.2s ease-out',
        'slide-out-r':'slideOutR 0.2s ease-in forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'shimmer':    'shimmer 2s infinite',
        'card-new':   'cardNew 3s ease-out forwards',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideInR:  { '0%': { transform: 'translateX(100%)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        slideOutR: { '0%': { transform: 'translateX(0)', opacity: '1' }, '100%': { transform: 'translateX(12px)', opacity: '0' } },
        slideUp:   { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        shimmer:   { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        cardNew:   {
          '0%':   { boxShadow: '0 0 0 3px rgba(16,185,129,0.6)', borderColor: '#10B981' },
          '60%':  { boxShadow: '0 0 0 2px rgba(16,185,129,0.2)' },
          '100%': { boxShadow: 'none' },
        },
      },
      boxShadow: {
        'glow':      '0 0 20px rgba(74, 144, 217, 0.25)',
        'glow-sm':   '0 0 10px rgba(74, 144, 217, 0.15)',
        'glow-gold': '0 0 20px rgba(201, 168, 76, 0.3)',
      },
    },
  },
  plugins: [],
}
