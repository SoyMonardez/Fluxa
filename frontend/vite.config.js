import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// En desarrollo, /api se manda al backend de Python (uvicorn, puerto 8000).
const proxy = { '/api': process.env.VITE_API_PROXY || 'http://localhost:8000' };

export default defineConfig({
  build: { target: 'es2022', chunkSizeWarningLimit: 400 },
  server: { host: '0.0.0.0', port: 5173, proxy },
  preview: { host: '0.0.0.0', proxy },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // La versión nueva espera a que se toque "Actualizar" (ver src/lib/actualizar.js).
      registerType: 'prompt',
      injectRegister: false,
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
      // La app entera queda guardada en el teléfono: abre y funciona sin señal.
      // Los datos no pasan por acá: viven en IndexedDB (ver src/motor).
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
