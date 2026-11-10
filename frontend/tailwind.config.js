/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        delivery: '#10b981',
        restricted: '#ef4444',
        toll: '#f59e0b',
        customer: '#3b82f6',
      },
    },
  },
  plugins: [],
}
