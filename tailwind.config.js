/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
        colors: {
          brand: {
          primary:   '#F5582A',
          secondary: '#2B5BA8',
          accent:    '#FF8B5F',
          gold:      '#C9A84C',
        },
        // These colors respond to the theme via CSS variables in tokens.css
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
        token: {
          primary:       'rgb(var(--color-primary) / <alpha-value>)',
          'primary-hover': 'rgb(var(--color-primary-hover) / <alpha-value>)',
        },
        primary: {
          50:  '#fff4ee',
          100: '#ffe3d8',
          500: '#f5582a',
          600: '#ea4f22',
          700: '#c63f1a',
          800: '#9f3114',
          900: '#7f260f',
        },
        violet: {
          500: '#8B5CF6',
        },
      },
      zIndex: {
        dropdown: '300',
        modal:    '400',
        toast:    '500',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in':          'fadeIn 0.2s ease-out',
        'slide-in-r':       'slideInR 0.25s ease-out',
        'slide-up':         'slideUp 0.2s ease-out',
        'slide-out-r':      'slideOutR 0.2s ease-in forwards',
        'pulse-slow':       'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'shimmer':          'shimmer 2s infinite',
        'card-new':         'cardNew 3s ease-out forwards',
        'modal-content-in': 'modalContentIn 0.28s cubic-bezier(0.16,1,0.3,1) both',
        'card-enter':       'cardEnter 0.22s ease-out both',
        'stagger-row':      'staggerRow 0.18s ease-out both',
        'page-enter':       'pageEnterKf 0.3s ease-out both',
        'pulse-glow':       'pulseGlow 2s ease-in-out infinite',
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
        modalContentIn: {
          '0%':   { opacity: '0', transform: 'translateY(20px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        cardEnter: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        staggerRow: {
          '0%':   { opacity: '0', transform: 'translateX(-6px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pageEnterKf: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245,88,42,0)' },
          '50%':      { boxShadow: '0 0 0 4px rgba(245,88,42,0.15)' },
        },
      },
      boxShadow: {
        'glow':      '0 0 20px rgba(245, 88, 42, 0.22)',
        'glow-sm':   '0 0 10px rgba(245, 88, 42, 0.14)',
        'glow-gold': '0 0 24px rgba(201, 168, 76, 0.28), 0 4px 12px rgba(201, 168, 76, 0.14)',
        'float':     '0 8px 32px -4px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06)',
        'glow-blue': '0 0 24px rgba(245,88,42,0.20), 0 4px 12px rgba(245,88,42,0.10)',
        'modal':     '0 24px 64px rgba(0,0,0,0.32), 0 8px 24px rgba(20,60,140,0.16)',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'decel':  'cubic-bezier(0.0, 0.0, 0.2, 1.0)',
      },
      letterSpacing: {
        'display': '-0.03em',
        'title':   '-0.02em',
        'heading': '-0.01em',
        'eyebrow': '0.08em',
      },
    },
  },
  plugins: [],
}
