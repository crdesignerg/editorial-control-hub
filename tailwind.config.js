/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sora', 'sans-serif']
      },
      colors: {
        brand: {
          navy: '#000055',
          orange: '#C54B00',
          black: '#000000'
        }
      },
      borderWidth: {
        '0.5': '0.5px'
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgb(0 0 0 / 0.04)'
      },
      backdropBlur: {
        '2xs': '2px'
      }
    }
  },
  plugins: []
};