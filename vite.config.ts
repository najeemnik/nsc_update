import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Wave 10: installable PWA shell — precached app shell, offline page,
      // cached fonts, network-first API reads. Mutations queue via offlineQueue.
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['assets/logo.png', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png'],
        manifest: {
          name: 'NIK SMART COUNT - Database & Accounting',
          short_name: 'NIK COUNT',
          description: 'Building Project Management & Construction Accounting System',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          background_color: '#faf5ef',
          theme_color: '#4f46e5',
          lang: 'fa',
          dir: 'rtl',
          icons: [
            { src: 'assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'assets/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          navigateFallback: '/index.html',
          // Go-live fix: never hijack same-domain .php navigations (e.g. /gen.php tools).
          navigateFallbackDenylist: [/^\/api\//, /\.php([?#]|$)/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'nsc-fonts',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'nsc-api-get',
                networkTimeoutSeconds: 8,
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Allow the Arena live-preview proxy host (and any hostname) to reach the dev server.
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
