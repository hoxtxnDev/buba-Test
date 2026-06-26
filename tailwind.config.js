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
          base: '#0d0f14',
          surface: '#13161d',
          card: '#1a1e28',
          hover: '#1e2330',
          selected: '#1e2d45',
          border: '#2a2f3d',
          'border-active': '#3d4560',
        },
        accent: {
          blue: '#4f8ef7',
          purple: '#7c6af7',
        },
        severity: {
          critical: '#ef4444',
          warning: '#f59e0b',
          info: '#3b82f6',
          pass: '#22c55e',
        },
      },
    },
  },
  plugins: [],
}
