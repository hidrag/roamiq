import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('leaflet')) return 'map'
          if (id.includes('node_modules/@supabase')) return 'supabase'
          if (id.includes('node_modules/@tanstack')) return 'query'
          if (id.includes('node_modules/@radix-ui')) return 'radix'
          if (id.includes('node_modules')) return 'vendor'
          return undefined
        },
      },
    },
  },
})
