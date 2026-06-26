/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        dark: {
          base: '#1a1a2e',
          surface: '#16213e',
          card: '#0f3460',
          border: '#2a2a4a',
        },
        accent: {
          blue: '#4f8ef7',
        },
        severity: {
          critical: '#ef4444',
          warning: '#f59e0b',
          info: '#3b82f6',
        },
      },
    },
  },
  plugins: [],
}
