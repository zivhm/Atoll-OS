import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const repoRoot = path.resolve(__dirname, "..");

export default defineConfig(({ mode }) => {
  const workspaceEnv = loadEnv(mode, __dirname, "");
  const repoEnv = loadEnv(mode, repoRoot, "");
  const basePath =
    process.env.ATOLL_LANDING_BASE?.trim() ||
    workspaceEnv.ATOLL_LANDING_BASE?.trim() ||
    repoEnv.ATOLL_LANDING_BASE?.trim() ||
    "/";

  return {
    root: __dirname,
    base: basePath,
    css: {
      postcss: path.resolve(__dirname, "postcss.config.js"),
    },
    server: {
      host: "127.0.0.1",
      port: 4174,
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
