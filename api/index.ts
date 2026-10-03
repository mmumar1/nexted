import type { IncomingMessage, ServerResponse } from "node:http";
import dotenv from "dotenv";
import { app } from "../server/app.js";
import { registerRoutes } from "../server/routes.js";

// Vercel provides environment variables in production; this keeps local invocation compatible.
dotenv.config({ path: ".env.local" });

type VercelRequest = IncomingMessage & {
  query?: Record<string, string | string[]>;
  url?: string;
};

type VercelResponse = ServerResponse;

let initialization: Promise<void> | undefined;

function getQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getForwardedPath(req: VercelRequest): string | undefined {
  const forwardedPath = getQueryValue(req.query?.path);
  if (!forwardedPath) return undefined;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === "path") continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }

  return `${forwardedPath.startsWith("/") ? forwardedPath : `/${forwardedPath}`}${query.size ? `?${query}` : ""}`;
}

async function initialize() {
  if (!initialization) {
    initialization = registerRoutes(app).then(() => {
      app.use((error: any, _req: IncomingMessage, res: ServerResponse, _next: unknown) => {
        if (!res.headersSent) {
          res.statusCode = error.status || error.statusCode || 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ message: error.message || "Internal Server Error" }));
        }
      });
    });
  }
  await initialization;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await initialize();

  const forwardedPath = getForwardedPath(req);
  if (forwardedPath) req.url = forwardedPath;

  return app(req, res);
}
