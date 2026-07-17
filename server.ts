import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Load Ada Soul
const soulPath = path.join(process.cwd(), 'soul.md');
const ADA_SYSTEM_INSTRUCTION = fs.existsSync(soulPath) 
  ? fs.readFileSync(soulPath, 'utf8') 
  : "You are Ada, an elite beauty tech expert and digital pioneer trained on female tech pioneers.";

app.use(express.json({ limit: '10mb' }));

import { generateContentAI } from "./src/lib/gemini.server";

// API Chat Endpoint
app.post("/api/chat", async (req, res) => {
  const { message, image, profile } = req.body;
  
  try {
    let customInstruction = ADA_SYSTEM_INSTRUCTION;
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
    
    // Check for missing credentials
    if (error.message?.includes('API_KEY')) {
      res.status(500).json({ reply: "Sister Pioneer, I need you to connect my brain! Please add the necessary API_KEY to the Secrets panel in AI Studio settings." });
      return;
    }

    if (error.status === 429) {
      res.status(429).json({ reply: "Let's pause, babe! My brain has hit its quota limit." });
    } else {
      res.status(500).json({ reply: "Babe, my circuit is playing games!" });
    }
  }
});

// API Daily Beauty Tip Generator Endpoint
app.post("/api/generate-tip", async (req, res) => {
  const { profile } = req.body;
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
    
    const response = await generateContentAI(prompt, null, ADA_SYSTEM_INSTRUCTION);
    const cleanJson = response.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanJson);
    res.json(result);
  } catch (err) {
    console.error("Tip generation error:", err);
    // fallback curated tip
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
});

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

app.post("/api/analyze-face", async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: "Missing image" });

  try {
    const response = await generateContentAI(PROFILE_ANALYSIS_PROMPT, image);
    // Parse JSON from response
    const jsonStr = response.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(jsonStr);
    res.json(analysis);
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({ error: "Failed to analyze face" });
  }
});

app.post("/api/tts", async (req, res) => {
  const { text } = req.body;
  
  // 1. Try Grok Voice TTS via OpenRouter if OPENROUTER_API_KEY is configured
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (openRouterApiKey) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://aistudio.google.com",
          "X-Title": "Ada Glow"
        },
        body: JSON.stringify({
          model: "meta/muse-spark-1.1",
          input: text,
          voice: "alloy"
        })
      });
      
      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        res.set("Content-Type", "audio/mpeg");
        return res.send(Buffer.from(audioBuffer));
      }
      console.warn("OpenRouter Grok TTS failed, falling back to HF.");
    } catch (err) {
      console.error("OpenRouter Grok TTS error:", err);
    }
  }

  // 2. Fallback to Hugging Face Inference API
  try {
    const hfModel = "kakao-enterprise/vits-vctk"; // High quality fast TTS
    const hfToken = process.env.HF_API_KEY;
    const headers: any = { "Content-Type": "application/json" };
    if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;

    const response = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ inputs: text })
    });

    if (response.ok) {
      const audioBuffer = await response.arrayBuffer();
      res.set("Content-Type", "audio/wav"); // HF typically returns wav or flac for TTS
      return res.send(Buffer.from(audioBuffer));
    } else {
      const err = await response.text();
      console.error("HF TTS Error:", err);
      return res.status(503).json({ error: "HF TTS Service Unavailable" });
    }
  } catch (error) {
    console.error("HF TTS generation failed:", error);
    return res.status(503).json({ error: "TTS Service Temporarily Unavailable" });
  }
});

// API Dynamic Models Pull Endpoint
app.get("/api/gemini-models", async (req, res) => {
  // Keeping endpoint name for now, but returning generic models
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.json({
        models: [
          { name: "meta-llama/llama-3.1-70b", displayName: "Llama 3.1 70B", description: "Versatile, strong reasoning", isFallback: true },
        ],
        apiKeyConfigured: false
      });
    }

    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://aistudio.google.com",
        "X-Title": "Ada Glow"
      }
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API returned ${response.status}`);
    }
    
    const data = await response.json();
    const modelsArray = data.data || [];

    const mappedModels = modelsArray.map((m: any) => ({
      name: m.id || "",
      displayName: m.name || m.id?.split("/").pop() || "AI Model",
      description: m.description || `Context length: ${m.context_length}.`,
      supportedGenerationMethods: [],
      isFallback: false
    })).filter((m: any) => m.name.includes("meta") || m.name.includes("openai") || m.name.includes("anthropic"));

    res.json({
      models: mappedModels,
      apiKeyConfigured: true
    });
  } catch (error: any) {
    console.error("Error listing OpenRouter models from API key:", error);
    res.json({
      models: [],
      apiKeyConfigured: false,
      error: error.message || "Failed to query live OpenRouter registry."
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
