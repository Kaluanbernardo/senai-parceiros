import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteApiPlugin from './server/viteApiPlugin.js'

export default defineConfig({
  plugins: [react(), viteApiPlugin()],
})
