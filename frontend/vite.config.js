import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/accounts': {
        target: 'https://localhost:3443',
        changeOrigin: true,
        secure: false,
      },
      '/transfers': {
        target: 'https://localhost:3443',
        changeOrigin: true,
        secure: false,
      },
      '/loans': {
        target: 'https://localhost:3443',
        changeOrigin: true,
        secure: false,
      },
      '/statements': {
        target: 'https://localhost:3443',
        changeOrigin: true,
        secure: false,
      },
      '/admin': {
        target: 'https://localhost:3443',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'https://localhost:3443',
        changeOrigin: true,
        secure: false,
      },
      '/audit-logs': {
        target: 'https://localhost:3443',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
