import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// GEMINI_API_KEY is intentionally NOT injected here. The original template
// used `define: { 'process.env.GEMINI_API_KEY': ... }` to inline the key
// into the client bundle, which exposes it to anyone viewing the page
// source. The key now lives only in the Vercel serverless function at
// /api/strategy-tips.ts, read server-side via process.env at request time.
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
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        // During local `vite dev`, forward /api requests to the Vercel dev
        // server (`vercel dev`, default port 3001) so the proxy function
        // works the same locally as in production.
        '/api': 'http://localhost:3001',
      },
    },
  };
});
