export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        ink: {
          DEFAULT: '#1a1a1a',
          soft: '#4a4a4a',
          muted: '#6b6b6b',
        },
        rule: {
          DEFAULT: '#e3e3e0',
          strong: '#1a1a1a',
        },
        wash: '#f5f5f3',
        signal: {
          DEFAULT: '#fa9e0d',
          wash: '#fff4e0',
        },
        line: {
          hdb: '#007a3d',
          condo: '#d42e12',
          landed: '#9d5b25',
          ec: '#9900aa',
          strata: '#005ec4',
        },
      },
      maxWidth: {
        shell: '1440px',
      },
    },
  },
  plugins: [],
}
