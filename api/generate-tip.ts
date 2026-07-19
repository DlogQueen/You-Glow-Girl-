import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateContentAI } from "../src/lib/gemini.server.js";
import { getAdaSystemInstruction } from "../src/lib/adaSoul.server.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { profile } = req.body || {};
  try {
    const prompt = `Based on these makeup profile details:
- Name: ${profile?.displayName || 'Glow Pioneer'}
- Profile Goals: ${profile?.goals || 'Healthy natural glow'}
- Face Shape: ${profile?.facialMetrics?.faceShape || 'Universal'}
- Eye Type: ${profile?.facialMetrics?.eyeType || 'Universal'}
- Skin Undertone: ${profile?.facialMetrics?.skinUndertone || 'Neutral'}

Generate an elite-tier daily beauty, skincare, or color theory tip. Keep it extremely empowering, friendly, and sassy (in Ada's iconic tech pioneer voice).
You must also suggest a recommended makeup palette matching this tip. This palette should include colors that can be used in dynamic try-on features!
Provide the output strictly as a JSON object with this exact schema:
{
  "tipTitle": "A brief catchy title",
  "tipContent": "The main empowering, elite-tier tip text (1-3 sentences)",
  "category": "Skincare | Eyes | Lips | Pigment Theory",
  "palette": {
    "lips": "Hex color (e.g. #FF1493)",
    "eyes": "Hex color (e.g. #8A2BE2)",
    "face": "Hex color (e.g. #FFD700)",
    "paletteName": "Feline Slate Dusk / Crimson Aura etc."
  }
}
Only output valid JSON. Do NOT include markdown blocks or "json" specifiers.`;

    const response = await generateContentAI(prompt, undefined, getAdaSystemInstruction());
    const cleanJson = response.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanJson);
    res.json(result);
  } catch (err) {
    console.error("Tip generation error:", err);
    res.json({
      tipTitle: "The Radiant Pioneer Glow",
      tipContent: "Babe, remember that hydration is the absolute foundation of color pigment execution. Apply a dewy priming mist before doing any contour work!",
      category: "Skincare",
      palette: {
        lips: "#FF4A8D",
        eyes: "#673AB7",
        face: "#FFD600",
        paletteName: "Classic Dewy Rose"
      }
    });
  }
}
