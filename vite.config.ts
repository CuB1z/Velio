import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // maplibre-gl arranca su propio worker. Al pre-empaquetarlo, Vite reescribe
  // la ruta del worker y en desarrollo devuelve 404: el mapa monta, pero se
  // queda en blanco porque no puede decodificar ni una tesela. Se carga en
  // diferido, así que Vite lo descubre tarde y el problema es más probable.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})