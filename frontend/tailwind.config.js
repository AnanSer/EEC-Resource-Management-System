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
          primary: '#083D4A',     // Primary Teal
          cyan: '#00A7D6',        // Electric Cyan Accent
          terracotta: '#C96F59',  // Terracotta Warning/Alert
          bg: '#F4F8FA',          // Background Canvas
          card: '#FFFFFF',        // Card Surface
          text: '#1E293B',        // Primary Slate Text
          muted: '#64748B',       // Muted Text
          border: '#E2E8F0',      // Border Slate
        },
      },
    },
  },
  plugins: [],
};
