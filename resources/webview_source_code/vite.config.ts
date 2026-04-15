import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import viteCompression from 'vite-plugin-compression'
import path from 'path';

const MOCK_SERVER = process.env.MOCK_SERVER_URL || 'http://localhost:3001';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      // Stub internal packages with local implementations
      '@dep305/codemaker-web-tools': path.resolve(__dirname, 'src/stubs/codemaker-web-tools.ts'),
      '@dep305/codemaker-web-coverage-plugin-vite': path.resolve(__dirname, 'src/stubs/codemaker-web-tools.ts'),
    },
  },
  plugins: [
    wasm(), topLevelAwait(),
    react(),
    // Replace env variables in HTML for open-source mode (point to mock server)
    {
      name: 'html-transform-api-url',
      transformIndexHtml(html) {
        return html.replace('__CODEMAKER_API_URL__', MOCK_SERVER);
      },
    },
    {
      name: 'html-transform-mcp-url',
      transformIndexHtml(html) {
        return html.replace('__MCP_API_URL__', MOCK_SERVER);
      },
    },
    {
      name: 'html-transform-skills-url',
      transformIndexHtml(html) {
        return html.replace('__SKILLS_HUB_API_URL__', MOCK_SERVER);
      },
    },
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 1024 * 500,
      algorithm: 'gzip',
      ext: '.gz',
      deleteOriginFile: false,
    }),
  ],
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
    preprocessorOptions: {
      scss: true,
    },
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
    },
    // All proxies point to the local mock server
    proxy: {
      '/proxy/validate': {
        target: MOCK_SERVER,
        changeOrigin: true,
      },
      '/proxy/api': {
        target: MOCK_SERVER,
        changeOrigin: true,
      },
      '/proxy/gpt': {
        target: MOCK_SERVER,
        changeOrigin: true,
      },
      '/proxy/cm': {
        target: MOCK_SERVER,
        changeOrigin: true,
      },
      '/proxy/bm': {
        target: MOCK_SERVER,
        changeOrigin: true,
      },
      '/proxy/mcp': {
        target: MOCK_SERVER,
        changeOrigin: true,
      },
      '/proxy/prompt': {
        target: MOCK_SERVER,
        changeOrigin: true,
      },
      '/proxy/vega': {
        target: MOCK_SERVER,
        changeOrigin: true,
      },
      '/proxy/code_search': {
        target: MOCK_SERVER,
        changeOrigin: true,
      },
      '/proxy/code_manager': {
        target: MOCK_SERVER,
        changeOrigin: true,
      },
      '/proxy/img': {
        target: MOCK_SERVER,
        changeOrigin: true,
      },
      '/proxy/devcloud_office': {
        target: MOCK_SERVER,
        changeOrigin: true,
      },
      '/api': {
        target: MOCK_SERVER,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../codemaker/webview',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')
              || id.includes('react-router')) {
              return 'react-vendor';
            }
            if (id.includes('lodash') || id.includes('date-fns')
              || id.includes('axios') || id.includes('moment')
              || id.includes('diff')
            ) {
              return 'utils-vendor';
            }
            if (id.includes('react-syntax-highlighter') || id.includes('mermaid')) {
              return 'ui-vendor';
            }
          }
        }
      }
    }
  }
});
