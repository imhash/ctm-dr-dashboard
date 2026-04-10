/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',   // Toggle via <html class="dark">
  theme: {
    extend: {
      colors: {
        // Dark surface palette
        surface: {
          900: '#0f1117',
          800: '#161926',
          700: '#1a1d27',
          600: '#1f2233',
          500: '#2a2d3a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
