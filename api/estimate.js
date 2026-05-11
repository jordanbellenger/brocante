import { estimateWithOpenAI } from "../openaiEstimate.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const estimate = await estimateWithOpenAI(req.body || {});
    res.status(200).json(estimate);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "Erreur estimation" });
  }
}
