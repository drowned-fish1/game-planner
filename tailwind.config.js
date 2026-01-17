/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  // === 关键修改：加入 typography 插件 ===
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
