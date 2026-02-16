/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#000000',
          fg: '#A9B7C6',
          green: '#4EC9B0',
          yellow: '#DCDCAA',
          red: '#F44747',
          blue: '#569CD6',
          cyan: '#9CDCFE',
          surface: '#1E1E1E',
          border: '#333333',
        },
      },
    },
  },
  plugins: [],
};
