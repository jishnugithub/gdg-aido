/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF6B4A',
          dark: '#E85A3A',
          light: '#FF886E',
          50: '#FFF5F2',
          100: '#FFE8E2',
          200: '#FFD3C7',
          300: '#FFB3A1',
          400: '#FF8E75',
          500: '#FF6B4A',
          600: '#E85A3A',
          700: '#C44528',
          800: '#9E351E',
          900: '#7B2917',
        },
        'primary-dark': '#E85A3A',
        secondary: {
          DEFAULT: '#1A1D3E',
          50: '#F4F5FB',
          100: '#E6E7F4',
          200: '#C9CCE7',
          300: '#9FA5D4',
          400: '#6C75BD',
          500: '#4751A2',
          600: '#333A82',
          700: '#252A63',
          800: '#1A1D3E',
          900: '#101227',
        },
        accent: {
          DEFAULT: '#FFB088',
          light: '#FFD2BC',
          dark: '#E68F63',
        },
        background: '#FFF8F5',
        surface: '#F8F9FE',
        success: {
          DEFAULT: '#22C55E',
          50: '#F0FDF4',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
        },
        warning: {
          DEFAULT: '#F59E0B',
          50: '#FFFBEB',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        error: {
          DEFAULT: '#EF4444',
          50: '#FEF2F2',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(24px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-24px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        pulseSlow: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.04)' },
        },
        radarPing: {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '70%, 100%': { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.25s ease-out forwards',
        fadeOut: 'fadeOut 0.2s ease-in forwards',
        slideUp: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        slideDown: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        slideInRight: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        slideInLeft: 'slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        pulseSlow: 'pulseSlow 2.5s infinite ease-in-out',
        radar: 'radarPing 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
};
