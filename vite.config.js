import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The project lives on the Windows filesystem (/mnt/c) and the dev server
    // runs in WSL, where inotify events do not arrive. Polling makes HMR work.
    watch: {
      usePolling: true,
      interval: 300,
    },
    // Las llamadas a /api van al servidor Express (server/index.js).
    proxy: {
      '/api': process.env.API_URL || 'http://localhost:3000',
    },
  },
})
