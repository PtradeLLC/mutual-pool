import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    // Private source maps: written next to the bundles for the server to turn
    // minified error traces into real file:line (App health), but not linked
    // from the bundles and never served (server.ts blocks *.map).
    build: { sourcemap: 'hidden' as const },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      // The dev server persists its state to *_data.json files in the project root;
      // watching them would reload the page on every save (and each reload saves again).
      watch: process.env.DISABLE_HMR === 'true'
        ? null
        : { ignored: ['**/*_data.json', '**/gear_designs.json', '**/advertiser_inquiries.json', '**/.data/**'] },
    },
  };
});
