import { defineConfig } from 'vite';
import { resolve } from 'path';

// Two entry points sharing one codebase:
//  - index.html  -> factory-floor supervisor flow (select supervisor / set up teams / log production)
//  - owner.html  -> owner dashboard (read-only, live totals)
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        owner: resolve(__dirname, 'owner.html'),
      },
    },
  },
  server: {
    port: 5173,
  },
});
