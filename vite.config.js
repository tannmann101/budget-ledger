import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Base must match your GitHub Pages repo name, e.g. https://<user>.github.io/budget-ledger/
export default defineConfig({
  base: '/budget-ledger/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Household Ledger',
        short_name: 'Ledger',
        description: 'Income, spending, debts, bills, and net worth tracker',
        theme_color: '#1A1A1A',
        background_color: '#F6F6F4',
        display: 'standalone',
        start_url: '/budget-ledger/',
        scope: '/budget-ledger/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
