// vite.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import minimist from "minimist";
import tailwindcss from "@tailwindcss/vite";

const args = minimist(process.argv.slice(2));

// 统一一个后端 API 地址变量
// 优先使用 VITE_API_BASE_URL，其次 VITE_API_URL，最后默认 3001
const API_TARGET =
  process.env.VITE_API_BASE_URL ||
  process.env.VITE_API_URL ||
  "http://127.0.0.1:3001";

export default defineConfig({
  base: args["baseUri"] || "/",
  plugins: [
    react({
      babel: {
        plugins: [],
      },
    }),
    tailwindcss(),
    tsconfigPaths(),
  ],
  build: {
    minify: true,
  },
  server: {
    proxy: {
      "/api": {
        // ❗这里原来是 3002，改成和后端一致
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  define: {
    // 可选：如果你项目里用到了 __APP_CONFIG__.apiUrl，这里也一起统一
    __APP_CONFIG__: JSON.stringify({
      apiUrl: API_TARGET,
    }),
  },
});
