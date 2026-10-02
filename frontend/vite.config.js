import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// En desarrollo, /api se manda al backend (por defecto en el puerto 3001).
const proxy = { '/api': process.env.VITE_API_PROXY || 'http://localhost:3001' };

export default defineConfig({
  build: { chunkSizeWarningLimit: 600 },
  server: { host: '0.0.0.0', port: 5173, proxy },
  preview: { host: '0.0.0.0', proxy },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icono.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'ETEM · Obras',
        short_name: 'ETEM',
        description: 'Asistencia, pagos, adelantos, cuadrillas y herramientas',
        lang: 'es-AR',
        theme_color: '#f3f2ef',
        background_color: '#f3f2ef',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
    }),
  ],
});
