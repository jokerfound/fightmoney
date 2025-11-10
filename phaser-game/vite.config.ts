import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  server: {
    port: 3000,
    hmr: true,
    open: true
  },
  build: {
    target: 'es2020',
    minify: 'terser',
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['phaser'],
    exclude: ['phaser/src/Phaser.js']
  },
  resolve: {
    alias: {
      phaser: 'phaser/dist/phaser.js'
    }
  }
})