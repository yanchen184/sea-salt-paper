/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: token('surface'),
        ink: { DEFAULT: token('ink'), muted: token('ink-muted') },
        heading: token('heading'),
        line: token('line'),
        accent: token('accent'),
        'on-accent': token('on-accent'),
        notice: { DEFAULT: token('notice'), ink: token('notice-ink') },
      },
      fontFamily: {
        display: 'var(--font-display)',
      },
    },
  },
  plugins: [],
}
