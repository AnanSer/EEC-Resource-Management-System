/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        eec: {
          primary: '#083D4A',     // Primary Corporate Teal
          accent: '#00A7D6',      // Electric Cyan Accent
          active: '#C96F59',      // Terracotta Warning/Indicator
          bg: '#F4F8FA',          // Background Canvas
          card: '#FFFFFF',        // Card Surface
          text: '#1E293B',        // Primary Slate Text
          muted: '#64748B',       // Muted Text
          border: '#E2E8F0',      // Border Slate
          dark: '#052831',        // Deep Brand Navy/Teal
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.07)',
        sidebar: '2px 0 8px 0 rgba(8,61,74,0.08)',
        dropdown: '0 10px 25px -5px rgba(8,61,74,0.1), 0 8px 10px -6px rgba(8,61,74,0.1)',
      },
    },
  },
  plugins: [],
};