import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3182'
    },
    watch: {
      // WSL2 on Windows filesystem needs polling for file change detection
      usePolling: true,
      interval: 300,
    }
  }
})
