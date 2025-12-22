import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "path";

export default defineConfig({
  plugins: [TanStackRouterVite(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "convex/_generated": path.resolve(__dirname, "../../convex/_generated"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api/auth": {
        target: "http://localhost:3211",
        changeOrigin: true,
        cookieDomainRewrite: {
          "localhost:3211": "localhost",
          "*": "",
        },
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            // Ensure cookies are set correctly for localhost
            const cookies = proxyRes.headers["set-cookie"];
            if (cookies) {
              proxyRes.headers["set-cookie"] = cookies.map((cookie: string) =>
                cookie
                  .replace(/;\s*secure/gi, "")
                  .replace(/;\s*samesite=none/gi, "; SameSite=Lax")
              );
            }
          });
        },
      },
    },
  },
});
