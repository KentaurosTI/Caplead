export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: '#0B1020',
        surface: '#111827',
        'surface-hover': '#151C2E',
        primary: '#3B82F6',
        'primary-hover': '#2563EB',
        accent: '#64748B',
        muted: '#64748B',
        border: '#243047',
        'border-light': '#334155',
        'k-gold-400': '#FBBF24',
        'k-gold-500': '#F59E0B'
      },
      fontFamily: {
        sans: ['Manrope', 'Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Manrope', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        premium: '0 16px 42px rgba(0, 0, 0, 0.22)',
        soft: '0 10px 28px rgba(0, 0, 0, 0.18)'
      }
    }
  },
  plugins: []
};
