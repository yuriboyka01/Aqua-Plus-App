import 'dotenv/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { defineConfig, Plugin } from 'vite';
import { createApiMiddleware } from './src/server/apiMiddleware.ts';

const projectDirectory = path.dirname(fileURLToPath(import.meta.url));

function backendApiPlugin(): Plugin {
  return {
    name: 'aquaplus-backend-api',
    configureServer(server) {
      server.middlewares.use(createApiMiddleware());
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), backendApiPlugin()],
    resolve: {
      alias: { '@': projectDirectory },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

