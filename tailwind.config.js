/**
 * Colours resolve through CSS custom properties written by
 * `scripts/build-themes.ts` (see `lib/themes.ts`). That is what lets every
 * existing `bg-slate-950`, `text-slate-400`, `dark:bg-white/5` … utility follow
 * the active theme without touching the components.
 *
 * `rgb(var(--token) / <alpha-value>)` keeps Tailwind's opacity modifiers
 * (`bg-white/10`, `bg-slate-950/70`) working.
 */
const withAlpha = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

const slate = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => [
    shade,
    withAlpha(`--slate-${shade}`)
  ])
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        bg: {
          DEFAULT: withAlpha('--bg'),
          alt: withAlpha('--bg-alt')
        },
        brand: {
          DEFAULT: withAlpha('--brand'),
          accent: withAlpha('--brand-accent')
        },
        slate,
        white: withAlpha('--white'),
        black: withAlpha('--black')
      },
      boxShadow: {
        card: 'var(--shadow-card)'
      }
    }
  },
  plugins: []
};
