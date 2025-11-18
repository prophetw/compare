import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'node:path';

const engineSdkDir = path.resolve(__dirname, '../BimEngine');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devServerPort = Number(env.VITE_DEV_PORT ?? 5173);
  const apiTarget = env.VITE_API_TARGET ?? 'http://localhost:3000';

  return {
    plugins: [
      vue(),
      viteStaticCopy({
        targets: [
          {
            src: path.resolve(engineSdkDir, '**/*'),
            dest: 'engine-sdk'
          }
        ]
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      port: devServerPort,
      proxy: {
        '/api': apiTarget
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true
    }
  };
});
