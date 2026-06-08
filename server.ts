import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

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
    console.error("Gemini AI Error:", error);
    
    // Check for missing credentials
    if (error.message?.includes('GEMINI_API_KEY')) {
      res.status(500).json({ reply: "Sister Pioneer, I need you to connect my Gemini brain! Please add GEMINI_API_KEY to the Secrets panel in AI Studio settings." });
      return;
    }

    if (error.status === 429) {
      res.status(429).json({ reply: "Let's pause, babe! My Gemini brain has hit its quota limit." });
    } else {
      res.status(500).json({ reply: "Babe, my Gemini circuit is playing games!" });
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
  const voiceId = process.env.ELEVENLABS_VOICE_ID || req.body.voiceId || "EXAVITQu4vr4xnSDxMaL"; // Uses custom Ada voice if set
  
  if (!process.env.ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: "Missing ELEVENLABS_API_KEY" });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("ElevenLabs error:", err);
      return res.status(response.status).json({ error: "ElevenLabs API Error" });
    }

    const audioBuffer = await response.arrayBuffer();
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error("TTS generation failed:", error);
    res.status(500).json({ error: "TTS generation failed" });
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

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Setup WebSocket server for Gemini Live API
  const wss = new WebSocketServer({ server, path: "/live" });

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  wss.on("connection", async (clientWs) => {
    console.log("Client connected to Live API WebSocket");
    
    if (!process.env.GEMINI_API_KEY) {
      console.error("No API key available for Live API");
      clientWs.close();
      return;
    }

    try {
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) clientWs.send(JSON.stringify({ audio }));
            
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onclose: () => {
            console.log("Live session closed by server");
            clientWs.close();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } }, // Aoede or another female voice
          },
          systemInstruction: ADA_SYSTEM_INSTRUCTION,
        },
      });

      clientWs.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.audio) {
            session.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
          if (msg.video) {
            session.sendRealtimeInput({
               video: { data: msg.video, mimeType: "image/jpeg" }
            });
          }
        } catch (err) {
          console.error("Error processing client WS message:", err);
        }
      });

      clientWs.on("close", () => {
        console.log("Client disconnected from Live API WebSocket");
        try {
           session.close();
        } catch (e) {}
      });

    } catch (err) {
      console.error("Failed to connect to Gemini Live API:", err);
      clientWs.close();
    }
  });
}

startServer();
