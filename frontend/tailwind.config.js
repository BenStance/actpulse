/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff',
          100: '#d9ecff',
          600: '#006ec7',
          700: '#005ca6',
          900: '#0b2238',
        },
      },
      boxShadow: {
        soft: '0 10px 30px rgba(6, 24, 44, 0.08)',
      },
    },
  },
  plugins: [],
};
