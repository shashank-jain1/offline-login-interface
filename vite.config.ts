import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    allowedHosts: [
      'localhost',
      '.ngrok-free.dev',  // Allows all ngrok subdomains
      '.ngrok.io',        // Older ngrok domains
    ],
  },
});