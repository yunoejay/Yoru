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
          DEFAULT: '#0f1115',
          alt: '#181c22'
        },
        brand: {
          DEFAULT: '#6366f1',
          accent: '#8b5cf6'
        }
      },
      boxShadow: {
        card: '0 4px 24px -4px rgba(0,0,0,0.4)'
      }
    }
  },
  plugins: []
};
