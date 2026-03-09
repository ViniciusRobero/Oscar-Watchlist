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
    },
  },
  plugins: [],
};
