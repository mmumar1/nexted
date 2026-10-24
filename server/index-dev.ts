import fs from "node:fs";
import path from "node:path";
import { type Server } from "node:http";
import dotenv from "dotenv";

import { type Express } from "express";
import { createServer as createViteServer, loadConfigFromFile } from "vite";

import runApp from "./app";

dotenv.config({ path: ".env.local" });

export async function setupVite(app: Express, server: Server) {
  const loadedConfig = await loadConfigFromFile(
    {
      command: "serve",
      mode: process.env.NODE_ENV || "development",
    },
    path.resolve(import.meta.dirname, "..", "vite.config.ts"),
  );
  if (!loadedConfig) {
    throw new Error("Unable to load vite.config.ts");
  }

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...loadedConfig.config,
    configFile: false,
    server: { ...loadedConfig.config.server, ...serverOptions },
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      const template = await fs.promises.readFile(clientTemplate, "utf-8");
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

(async () => {
  await runApp(setupVite);
})();
