/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          50: '#fdfcf9',
          100: '#f8f5ee',
          200: '#efe9dc',
          300: '#e2d9c6',
          400: '#cbbda1',
          600: '#8a7a5f',
          800: '#4a4032',
          900: '#2c261d',
        },
        ink: {
          DEFAULT: '#2c261d',
          soft: '#5d5445',
          faint: '#8a8071',
        },
        valley: '#2563eb',
        mountain: '#dc2626',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        paper: '0 1px 2px rgba(44,38,29,0.06), 0 8px 24px -12px rgba(44,38,29,0.18)',
        lift: '0 2px 4px rgba(44,38,29,0.08), 0 18px 40px -18px rgba(44,38,29,0.28)',
      },
    },
  },
  plugins: [],
}
