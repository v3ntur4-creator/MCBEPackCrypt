import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: 'src/frontend',
  build: {
    outDir: '../../dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/frontend')
    }
  },
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  server: {
    port: parseInt(process.env.FRONTEND_PORT || '3000'),
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.BACKEND_PORT || '3001'}`,
        changeOrigin: true
      }
    }
  },
  publicDir: '../../resources',
  base: '/'
})