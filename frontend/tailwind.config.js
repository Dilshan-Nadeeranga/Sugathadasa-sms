/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e8eef6',
          100: '#c5d3e8',
          200: '#9fb7d8',
          300: '#789bc8',
          400: '#5985bc',
          500: '#3a6fb0',
          600: '#2d5a94',
          700: '#1e3a5f',
          800: '#162c4a',
          900: '#0e1e35',
        },
        accent: {
          400: '#fb923c',
          500: '#f97316',
          600: '#ea6c0a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
