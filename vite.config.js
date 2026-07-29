import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteApiPlugin from './server/viteApiPlugin.js'

export default defineConfig({
  plugins: [react(), viteApiPlugin()],
  test: {
    // Vitest exposes `.env.local` through `process.env`; this keeps real
    // credentials out of the suite so no test can reach a live provider.
    setupFiles: ['./tests/setup/isolateProviderCredentials.js'],
  },
})
