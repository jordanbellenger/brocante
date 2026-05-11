import OpenAI from "openai";

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

export async function estimateWithOpenAI({ photo, name = "", notes = "" }) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY manquante");
    error.statusCode = 503;
    throw error;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
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
- "why" doit seulement décrire l'objet visible ou supposé, en une phrase de 90 caractères max ;
- "why" ne doit jamais mentionner vente, prix, estimation, brocante ou rapidité de vente ;
- réponse JSON strictement conforme au schéma.

Nom saisi : ${name || "non renseigné"}
Notes : ${notes || "aucune"}`,
    },
  ];

  if (photo) {
    content.push({ type: "input_image", image_url: photo, detail: "low" });
  }

  const response = await client.responses.create({
    model,
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
  const why = cleanObjectDescription(estimate.why);

  return {
    name: String(estimate.name || "Objet de brocante").trim().slice(0, 48),
    low,
    mid,
    high,
    confidence: ["faible", "moyenne", "élevée"].includes(estimate.confidence) ? estimate.confidence : "moyenne",
    why: why.length > 90 ? `${why.slice(0, 87).trim()}...` : why,
  };
}

function cleanObjectDescription(value) {
  const text = String(value || "").trim();
  const forbidden = /\b(vente|vendre|vend|vendu|prix|estimation|estime|estimé|brocante|vide-grenier|rapide|rapidement|fourchette)\b/i;
  if (!text || forbidden.test(text)) return "Description courte de l'objet à confirmer.";
  return text;
}
