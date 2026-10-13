import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
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
