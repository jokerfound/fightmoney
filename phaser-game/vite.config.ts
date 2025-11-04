import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3000,
    hmr: true,
    open: true
  },
  build: {
    target: 'es2020',
    minify: false
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