import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/ctm-api': {
        target: 'https://se-preprod-aapi.us1.controlm.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/ctm-api/, '/automation-api'),
      },
    },
  },
})
