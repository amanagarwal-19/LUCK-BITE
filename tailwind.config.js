/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      borderWidth: {
        '3': '3px',
      },
      colors: {
        cream: {
          50: '#FFFBF5',
          100: '#FFF6EC',
          200: '#FDEED9',
        },
        ink: {
          900: '#1A1814',
          800: '#2A2620',
          700: '#3D3830',
          600: '#5A534A',
          500: '#7A7268',
          400: '#9C9488',
        },
        orange: {
          50: '#FFF5EA',
          100: '#FFE6CC',
          200: '#FFCC99',
          300: '#FFB366',
          400: '#FF9A3D',
          500: '#F57C20',
          600: '#D9660A',
          700: '#B55208',
          800: '#8F4208',
        },
        green: {
          50: '#EEF8ED',
          100: '#D6EFD4',
          400: '#4CAF50',
          500: '#2E9E3A',
          600: '#1E7E2C',
        },
        warning: {
          100: '#FFF3E0',
          500: '#F59E0B',
          700: '#B45309',
        },
        error: {
          100: '#FEE2E2',
          500: '#EF4444',
          700: '#B91C1C',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        card: '0 2px 8px rgba(26, 24, 20, 0.06), 0 1px 3px rgba(26, 24, 20, 0.04)',
        'card-hover': '0 8px 24px rgba(26, 24, 20, 0.1), 0 2px 6px rgba(26, 24, 20, 0.06)',
        'warm': '0 4px 20px rgba(245, 124, 32, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
