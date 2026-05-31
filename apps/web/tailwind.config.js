/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        teal: {
          tma: "#1FA8A8",
          tmaDark: "#16898A",
        },
        upRed: "#E1352B",
        upRedBar: "#E1352B",
        downBlue: "#1F5FCF",
        downBlueBar: "#1F5FCF",
        highlight: "#FFEB8A",
      },
      fontFamily: {
        sans: [
          "'Apple SD Gothic Neo'",
          "'Noto Sans KR'",
          "'Malgun Gothic'",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
