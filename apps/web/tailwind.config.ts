import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#020e0d',
        panel: '#073a32',
        electric: '#0abf89',
        pink: { DEFAULT: '#35e6ae', 50: '#effff9', 100: '#c7fbea' },
        violet: '#236f66',
        purple: '#093b34',
        orange: '#68d9f3',
        coral: '#ae70ff',
        softpink: '#a8ffdf',
        cyan: '#6ce8ff',
        gold: '#f4d76f',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        display: ['Outfit', 'Inter', 'ui-sans-serif'],
      },
      boxShadow: { glow: '0 24px 80px rgba(10, 191, 137, .22)' },
      animation: { float: 'float 7s ease-in-out infinite', pulseSoft: 'pulseSoft 2.5s ease-in-out infinite' },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
        pulseSoft: { '0%,100%': { opacity: '.55' }, '50%': { opacity: '1' } },
      },
    },
  },
  plugins: [],
} satisfies Config;

