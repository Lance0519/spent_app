/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#FEF7FF',
          dark: '#141218'
        },
        'surface-variant': {
          DEFAULT: '#F4EFF4',
          dark: '#49454F'
        },
        'surface-container': {
          DEFAULT: '#F3EDF7',
          dark: '#211F26'
        },
        'surface-container-high': {
          DEFAULT: '#ECE6F0',
          dark: '#2B2930'
        }
      }
    },
  },
  plugins: [],
}
