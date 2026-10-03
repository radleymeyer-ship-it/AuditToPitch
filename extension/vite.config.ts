import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'node:path'

// https://vite.dev/config/

export default defineConfig(({ mode }) => {
  const extensionEnv = loadEnv(mode, import.meta.dirname, 'VITE_')
  const webEnv = loadEnv(mode, resolve(import.meta.dirname, '../web'), 'NEXT_PUBLIC_')
  const siteUrl =
    extensionEnv.VITE_SITE_URL || webEnv.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000'

  return {
    define: { 'import.meta.env.VITE_SITE_URL': JSON.stringify(siteUrl) },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: {
          app: resolve(import.meta.dirname, 'index.html'),
          background: resolve(import.meta.dirname, 'src/background/index.ts'),
          content: resolve(import.meta.dirname, 'src/content/index.ts'),
        },
        output: {
          entryFileNames: '[name].js',
        },
      },
    },
 	}
})
