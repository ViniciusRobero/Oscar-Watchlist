/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: {
          base: '#07070e',
          surface: '#0e0e1a',
          raised: '#141427',
          hover: '#1a1a30',
        },
        border: {
          DEFAULT: '#1e1e32',
          active: '#2e2e50',
        },
        gold: {
          DEFAULT: '#f5c518',
          dim: '#b8940d',
          muted: '#3d300a',
        },
        accent: '#6366f1',
        success: '#10b981',
        danger: '#f43f5e',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(99, 102, 241, 0.15)',
        'glow-gold': '0 0 20px rgba(245, 197, 24, 0.15)',
        'glass': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
      },
    },
  },
  plugins: [],
};
