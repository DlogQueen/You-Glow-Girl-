import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateContentAI } from "../src/lib/gemini.server.js";

const PROFILE_ANALYSIS_PROMPT = `
Analyze this person's facial features for a makeup profile.
Return a JSON object exactly in this format:
{
  "faceShape": "Heart | Oval | Round | Square | Diamond | Rectangle",
  "eyeType": "Hooded | Almond | Round | Monolid | Downturned",
  "skinUndertone": "Warm | Cool | Neutral"
}
Only return the JSON.
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { image } = req.body || {};
  if (!image) {
    res.status(400).json({ error: "Missing image" });
    return;
  }

  try {
    const response = await generateContentAI(PROFILE_ANALYSIS_PROMPT, image);
    const jsonStr = response.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(jsonStr);
    res.json(analysis);
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({ error: "Failed to analyze face" });
  }
}
