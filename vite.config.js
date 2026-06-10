import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    watch: {
      ignored: ['**/node-v26.2.0-win-x64/**', '*.png']
    }
  }
})
