import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-dom') || id.includes('react-router-dom')) return 'react-vendor'
          if (id.includes('@supabase')) return 'supabase-vendor'
          if (id.includes('@tanstack')) return 'query-vendor'
          if (id.includes('@dnd-kit')) return 'dnd-vendor'
          if (id.includes('recharts')) return 'charts-vendor'
          if (id.includes('date-fns')) return 'date-vendor'
          if (id.includes('lucide-react')) return 'icons-vendor'
        },
      },
    },
  },
})
