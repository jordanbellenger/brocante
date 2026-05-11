import http from "node:http";
import { parse } from "node:url";
import { createServer as createViteServer, loadEnv } from "vite";
import OpenAI from "openai";

const env = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
Object.assign(process.env, env);

const PORT = Number(process.env.PORT || 5173);
const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";
const client = process.env.OPENAI_API_KEY ? new OpenAI() : null;

const estimateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "low", "mid", "high", "confidence", "why"],
  properties: {
    name: { type: "string" },
    low: { type: "integer", minimum: 0 },
    mid: { type: "integer", minimum: 0 },
    high: { type: "integer", minimum: 0 },
    confidence: { type: "string", enum: ["faible", "moyenne", "élevée"] },
    why: { type: "string" },
  },
};

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

async function estimateWithOpenAI({ photo, name = "", notes = "" }) {
  if (!client) {
    const error = new Error("OPENAI_API_KEY manquante");
    error.statusCode = 503;
    throw error;
  }

  const content = [
    {
      type: "input_text",
      text: `Estime un prix de vente réaliste en brocante / vide-grenier en France, en privilégiant une vente facile.

Contraintes :
- trouve un titre court et vendable pour l'objet dans "name" ;
- prix en euros entiers ;
- objet d'occasion, pas prix neuf ;
- fourchette volontairement prudente, plus basse qu'une annonce en ligne ;
- "mid" doit être un prix conseillé pour vendre rapidement, proche du bas de la fourchette ;
- si l'identification est incertaine, donner une fourchette large ;
- réponse JSON strictement conforme au schéma.

Nom saisi : ${name || "non renseigné"}
Notes : ${notes || "aucune"}`,
    },
  ];

  if (photo) {
    content.push({ type: "input_image", image_url: photo, detail: "low" });
  }

  const response = await client.responses.create({
    model: MODEL,
    input: [{ role: "user", content }],
    text: {
      format: {
        type: "json_schema",
        name: "brocante_estimate",
        strict: true,
        schema: estimateSchema,
      },
    },
  });

  return normalizeEstimate(JSON.parse(response.output_text));
}

function normalizeEstimate(estimate) {
  const low = Math.max(0, Math.round(Number(estimate.low) || 0));
  const rawMid = Math.max(low, Math.round(Number(estimate.mid) || low));
  const rawHigh = Math.max(rawMid, Math.round(Number(estimate.high) || rawMid));
  const quickSaleMid = low + Math.round((rawHigh - low) * 0.35);
  const mid = Math.max(low, Math.min(rawMid, quickSaleMid));
  const high = Math.max(mid, rawHigh);
  const why = String(estimate.why || "").trim();

  return {
    name: String(estimate.name || "Objet de brocante").trim().slice(0, 48),
    low,
    mid,
    high,
    confidence: ["faible", "moyenne", "élevée"].includes(estimate.confidence) ? estimate.confidence : "moyenne",
    why: why.length > 150 ? `${why.slice(0, 147).trim()}...` : why,
  };
}

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "spa",
});

const server = http.createServer(async (req, res) => {
  const { pathname } = parse(req.url || "");

  if (req.method === "POST" && pathname === "/api/estimate") {
    try {
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
  if (!client) console.log("OPENAI_API_KEY absente : fallback local côté navigateur.");
});
