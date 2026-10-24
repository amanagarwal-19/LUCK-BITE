/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      borderWidth: {
        '3': '3px',
      },
      colors: {
        // Brand kit: Warm Cream #FFF8EC, Soft Sage #C6D6C3, Deep Ink #18221C,
        // Forest Green #173D2A, Golden Yellow #F5C66B
        cream: {
          50: '#FFFCF6',
          100: '#FFF8EC',
          200: '#E3EBDF',
        },
        sage: {
          50: '#F1F5EF',
          100: '#E3EBDF',
          DEFAULT: '#C6D6C3',
          200: '#C6D6C3',
          300: '#A9BFA5',
          400: '#86A183',
        },
        ink: {
          950: '#18221C',
          900: '#173D2A',
          800: '#18221C',
          700: '#2B3A31',
          600: '#41524A',
          500: '#4F6157',
          400: '#677A6E',
        },
        // "orange" is the accent/primary scale used across the app; it now holds the brand
        // greens (500 = Forest Green) with Golden Yellow at 100 for badges and offers.
        orange: {
          50: '#FFF3D6',
          100: '#F5C66B',
          200: '#9DB59A',
          300: '#7A9A78',
          400: '#4F7A5E',
          500: '#173D2A',
          600: '#0F2B1D',
          700: '#173D2A',
          800: '#0F2B1D',
        },
        green: {
          50: '#EEF3EC',
          100: '#DCE8D9',
          400: '#5E8068',
          500: '#2F6B4A',
          600: '#173D2A',
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
        card: '0 2px 8px rgba(24, 34, 28, 0.08), 0 1px 3px rgba(24, 34, 28, 0.05)',
        'card-hover': '0 8px 24px rgba(24, 34, 28, 0.14), 0 2px 6px rgba(24, 34, 28, 0.08)',
        'warm': '0 4px 20px rgba(23, 61, 42, 0.22)',
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
