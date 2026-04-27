import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Both /ctm-api and /api route through Express — CTM target is configured dynamically in db.json
      '/ctm-api': { target: 'http://localhost:3001', changeOrigin: false },
      '/api':     { target: 'http://localhost:3001', changeOrigin: false },
    },
  },
})
