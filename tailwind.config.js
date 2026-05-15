/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: '#09090b',
        surface: '#18181b',
        'surface-hover': '#27272a',
        primary: '#fafafa',
        'primary-hover': '#e4e4e7',
        accent: '#a1a1aa',
        muted: '#a1a1aa',
        border: '#27272a',
        'border-light': '#3f3f46'
      }
    },
  },
  plugins: [],
}
