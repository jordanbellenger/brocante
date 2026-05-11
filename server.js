import http from "node:http";
import { parse } from "node:url";
import { createServer as createViteServer, loadEnv } from "vite";
import { requireAuthenticatedUser } from "./authServer.js";
import { estimateWithOpenAI } from "./openaiEstimate.js";

const env = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
Object.assign(process.env, env);

const PORT = Number(process.env.PORT || 5173);

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 6_000_000) {
        reject(new Error("Payload trop volumineux"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "spa",
});

const server = http.createServer(async (req, res) => {
  const { pathname } = parse(req.url || "");

  if (req.method === "POST" && pathname === "/api/estimate") {
    try {
      await requireAuthenticatedUser(req.headers.authorization);
      const body = await readJson(req);
      const estimate = await estimateWithOpenAI(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(estimate));
    } catch (error) {
      res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message || "Erreur estimation" }));
    }
    return;
  }

  vite.middlewares(req, res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Brocante dev server: http://127.0.0.1:${PORT}/`);
  if (!process.env.OPENAI_API_KEY) console.log("OPENAI_API_KEY absente : fallback local côté navigateur.");
});
