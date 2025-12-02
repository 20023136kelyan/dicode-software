/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#F7B500', // Yellow accent
          dark: '#E5A500',
        },
        dark: {
          bg: '#1A1A1A',
          card: '#2A2A2A',
          border: '#3A3A3A',
          text: '#E5E5E5',
          'text-muted': '#A0A0A0',
        },
        blue: {
          primary: '#2B6CB0',
          light: '#4299E1',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
