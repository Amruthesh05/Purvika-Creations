/** @type {import('tailwindcss').Config} */
const ink = {
  50: '#17171a',
  100: '#1f1f23',
  200: '#29292e',
  300: '#36363c',
  400: '#a1a1aa',
  500: '#a1a1aa',
  600: '#f4f4f5',
  700: '#f4f4f5',
  800: '#f4f4f5',
  900: '#f4f4f5',
};

const flame = {
  300: '#ffb066',
  400: '#ff8a3d',
  500: '#ff6a1a',
  600: '#f04e0a',
  700: '#c63d06',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { page: '#17171a', surface: '#1f1f23', raised: '#29292e', border: '#36363c' },
        text: { DEFAULT: '#f4f4f5', muted: '#a1a1aa' },
        flame,
        gray: ink,
        neutral: ink,
        white: '#1f1f23',
        black: '#f4f4f5',
        blue: { ...flame, 50: '#1f1f23', 100: '#29292e', 500: '#ff6a1a', 600: '#f04e0a', 700: '#c63d06' },
        emerald: { 50: '#052e1a', 100: '#052e1a', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d' },
        red: { 50: '#2a0d0d', 100: '#2a0d0d', 400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c' },
        amber: { 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309' },
        green: { 50: '#052e1a', 100: '#052e1a', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d' },
        zinc: { 700: '#27272a', 800: '#1f1f23', 900: '#17171a' },
      },
    },
  },
  plugins: [],
};
