import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateContentAI } from "../src/lib/gemini.server.js";
import { getAdaSystemInstruction } from "../src/lib/adaSoul.server.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { message, image, profile } = req.body || {};

  try {
    let customInstruction = getAdaSystemInstruction();
    if (profile) {
      customInstruction += `\n\n[USER PROFILE CONTEXT] - Ada, personalize your guidance using the active user's details:
- Display Name: ${profile.displayName || 'Glow Pioneer'}
- Pronouns: ${profile.pronouns || 'N/A'}
- Biography / Vibe: "${profile.bio || 'Not provided'}"
- Cosmetics Goals & Beauty Milestones: "${profile.goals || 'None set yet'}"
- Calibrated Face Shape: ${profile.facialMetrics?.faceShape || "Pending Alignment"}
- Eye Type: ${profile.facialMetrics?.eyeType || "Pending Alignment"}
- Undertone: ${profile.facialMetrics?.skinUndertone || "Pending Alignment"}
- Items in Vanity: ${profile.vanityCount || 0}
- Photos Shared in Portfolio Grid: ${profile.galleryCount || 0}
`;
    }
    const reply = await generateContentAI(message, image, customInstruction);
    res.json({ reply });
  } catch (error: any) {
    console.error("AI Error:", error);

    if (error.message?.includes('API_KEY')) {
      res.status(500).json({ reply: "Sister Pioneer, I need you to connect my brain! Please add OPENROUTER_API_KEY (or GEMINI_API_KEY) to the project's environment variables." });
      return;
    }

    if (error.status === 429) {
      res.status(429).json({ reply: "Let's pause, babe! My brain has hit its quota limit." });
    } else {
      res.status(500).json({ reply: "Babe, my circuit is playing games!" });
    }
  }
}
