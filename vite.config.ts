import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    host: '0.0.0.0',
    port: 3340,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  preview: {
    host: '0.0.0.0',
    port: 8080,

    allowedHosts: [
      'dental-cbct-viewer-production.up.railway.app',
      'independent-encouragement-production-abfb.up.railway.app',
    ],

    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  worker: {
    format: 'es',

    rollupOptions: {
      external: ['@icr/polyseg-wasm'],
    },
  },

  build: {
    outDir: 'demo-dist',

    rollupOptions: {
      external: ['@icr/polyseg-wasm'],
    },
  },

  optimizeDeps: {
    include: [
      '@cornerstonejs/core',
      '@cornerstonejs/tools',
      '@cornerstonejs/dicom-image-loader',
      'dicom-parser',
    ],
  },
});
