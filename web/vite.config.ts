import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const repoRoot = path.resolve(__dirname, "..");

export default defineConfig(({ mode }) => {
  const workspaceEnv = loadEnv(mode, __dirname, "");
  const repoEnv = loadEnv(mode, repoRoot, "");
  const basePath =
    process.env.ATOLL_WEB_BASE?.trim() ||
    workspaceEnv.ATOLL_WEB_BASE?.trim() ||
    repoEnv.ATOLL_WEB_BASE?.trim() ||
    "/";
  const apiOrigin =
    process.env.ATOLL_API_ORIGIN?.trim() ||
    workspaceEnv.ATOLL_API_ORIGIN?.trim() ||
    repoEnv.ATOLL_API_ORIGIN?.trim() ||
    "http://127.0.0.1:4000";

  return {
    root: __dirname,
    base: basePath,
    css: {
      postcss: path.resolve(__dirname, "postcss.config.js"),
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/api": {
          target: apiOrigin,
          changeOrigin: true,
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
