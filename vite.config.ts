import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // El proxy apunta al mismo PORT que usa la API (server/index.ts lee .env).
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const apiUrl = env.API_URL || `http://localhost:${env.PORT || 3112}`

  return {
    plugins: [react()],
    server: {
      // The project lives on the Windows filesystem (/mnt/c) and the dev server
      // runs in WSL, where inotify events do not arrive. Polling makes HMR work.
      watch: {
        usePolling: true,
        interval: 300,
      },
      // Las llamadas a /api van al servidor Express (server/index.ts).
      proxy: {
        '/api': apiUrl,
      },
    },
  }
})
