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
    port: 3000,
    open: false,
    proxy: {
      // Proxy /rag-api/* → https://migraine-rag-chatbot.onrender.com/*
      // This avoids CORS entirely in dev: browser only talks to localhost:3000.
      '/rag-api': {
        target: 'https://migraine-rag-chatbot.onrender.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/rag-api/, ''),
      },
    },
  },
});
