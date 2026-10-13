import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#050816',
        panel: '#0b1024',
        electric: '#6c63ff',
        cyan: '#28d7ff',
        gold: '#f7ca72',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        display: ['Space Grotesk', 'Inter', 'ui-sans-serif'],
      },
      boxShadow: { glow: '0 0 60px rgba(108, 99, 255, .22)' },
      animation: { float: 'float 7s ease-in-out infinite', pulseSoft: 'pulseSoft 2.5s ease-in-out infinite' },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
        pulseSoft: { '0%,100%': { opacity: '.55' }, '50%': { opacity: '1' } },
      },
    },
  },
  plugins: [],
} satisfies Config;

