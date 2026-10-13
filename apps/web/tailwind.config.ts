import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#26042f',
        panel: '#481164',
        electric: '#e500a4',
        pink: { DEFAULT: '#ff3fad', 50: '#fff3fa', 100: '#ffd9ee' },
        violet: '#8021b9',
        purple: '#481164',
        orange: '#ff682d',
        coral: '#f63d58',
        softpink: '#ff91ca',
        cyan: '#ff91ca',
        gold: '#ff9b42',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        display: ['Outfit', 'Inter', 'ui-sans-serif'],
      },
      boxShadow: { glow: '0 24px 80px rgba(229, 0, 164, .24)' },
      animation: { float: 'float 7s ease-in-out infinite', pulseSoft: 'pulseSoft 2.5s ease-in-out infinite' },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
        pulseSoft: { '0%,100%': { opacity: '.55' }, '50%': { opacity: '1' } },
      },
    },
  },
  plugins: [],
} satisfies Config;

