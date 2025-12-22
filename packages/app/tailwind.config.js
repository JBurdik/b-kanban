/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Custom dark theme colors
        dark: {
          bg: "#0d0d0d",
          surface: "#1a1a1a",
          border: "#2a2a2a",
          hover: "#333333",
          text: "#e5e5e5",
          muted: "#888888",
        },
        accent: {
          DEFAULT: "#3b82f6",
          hover: "#2563eb",
        },
      },
    },
  },
  plugins: [],
};
