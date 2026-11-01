import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
// @ts-expect-error ESM helper script shared with production Node server
import { createMultiplayerRelay } from './scripts/ws-relay.mjs';

export default defineConfig({
  plugins: [
    {
      name: 'robin-town-ws-and-onchain-relay',
      configureServer(server) {
        const relay = createMultiplayerRelay();
        server.middlewares.use((req, res, next) => {
          if (relay.handleApiRequest(req, res)) return;
          next();
        });
        server.httpServer?.on('upgrade', (req, socket, head) => {
          relay.handleUpgrade(req, socket, head);
        });
      },
      configurePreviewServer(server) {
        const relay = createMultiplayerRelay();
        server.middlewares.use((req, res, next) => {
          if (relay.handleApiRequest(req, res)) return;
          next();
        });
        server.httpServer?.on('upgrade', (req, socket, head) => {
          relay.handleUpgrade(req, socket, head);
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    open: false,
    cors: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: ['es2022', 'safari16.4'],
    sourcemap: true,
  },
});
