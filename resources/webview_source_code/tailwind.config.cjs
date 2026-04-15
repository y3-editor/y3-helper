/** @type {import('tailwindcss').Config} */

export function generateSpace(scaleSize) {
  const space = {};
  for (let i = 1; i <= 50; i++) {
    space[i.toString()] = `${i * scaleSize}px`;
  }
  return space;
}

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      spacing: generateSpace(4),
      screens: {
        'xs': '500px',
        'xxs': '400px'
      }
    },
  },
  plugins: [],
}

