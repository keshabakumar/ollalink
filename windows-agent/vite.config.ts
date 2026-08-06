import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    // Force Vite to resolve a single copy of React — without this, pre-bundling
    // convex can pull in a second React copy and trigger
    // "A React Element from an older version of React was rendered".
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
})
