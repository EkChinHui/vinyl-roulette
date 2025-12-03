import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path for GitHub Pages - use repo name or '/' for custom domain
  base: '/vinyl-roulette/',
  // Enable SPA fallback for client-side routing
  preview: {
    // Fallback to index.html for SPA routing
    headers: {
      'Cache-Control': 'no-cache',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
