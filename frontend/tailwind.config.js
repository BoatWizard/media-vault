/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      colors: {
        ink: {
          950: '#0a0a0f',
          900: '#13131a',
          800: '#1c1c27',
          700: '#2a2a3d',
          600: '#3d3d5c',
        },
        acid: {
          DEFAULT: '#c8f135',
          dark: '#a3c820',
        },
        chrome: {
          DEFAULT: '#e8e8f0',
          dim: '#9090a8',
        },
      },
    },
  },
  plugins: [],
}
