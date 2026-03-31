import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

async function loadReplitPlugins() {
  const plugins = [];
  
  if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
    try {
      const cartographer = await import("@replit/vite-plugin-cartographer");
      plugins.push(cartographer.cartographer());
      
      const devBanner = await import("@replit/vite-plugin-dev-banner");
      plugins.push(devBanner.devBanner());
    } catch (error) {
      console.warn("Replit plugins not available in production");
    }
  }
  
  return plugins;
}

export default defineConfig(async ({ mode }) => {
  const replitPlugins = await loadReplitPlugins();
  
  return {
    plugins: [
      react(),
      runtimeErrorOverlay(),
      ...replitPlugins,
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client/src"),
        "@shared": path.resolve(__dirname, "shared"),
        "@assets": path.resolve(__dirname, "attached_assets"),
      },
    },
    root: path.resolve(__dirname, "client"),
    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
