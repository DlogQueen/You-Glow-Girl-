import type { VercelRequest, VercelResponse } from "@vercel/node";

// "Rachel" - one of ElevenLabs' default public voices, available on every
// free-tier account. Used only if ELEVENLABS_VOICE_ID isn't configured.
const DEFAULT_ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

async function speakWithOpenRouter(text: string, apiKey: string): Promise<Buffer | null> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "https://youglowgirl.app",
        "X-Title": "Ada Glow"
      },
      body: JSON.stringify({
        model: "openai/gpt-audio-mini",
        modalities: ["text", "audio"],
        audio: { voice: "alloy", format: "mp3" },
        messages: [
          {
            role: "system",
            content: "You are a text-to-speech engine. Speak the user's message verbatim, in character, with no additions, no preamble, and no commentary."
          },
          { role: "user", content: text }
        ]
      })
    });

    if (!response.ok) {
      console.warn("OpenRouter TTS (gpt-audio-mini) failed, falling back.", await response.text());
      return null;
    }

    const data = await response.json();
    const base64Audio = data?.choices?.[0]?.message?.audio?.data;
    if (!base64Audio) {
      console.warn("OpenRouter TTS returned no audio payload, falling back.");
      return null;
    }
    return Buffer.from(base64Audio, "base64");
  } catch (err) {
    console.error("OpenRouter TTS error:", err);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { text } = req.body || {};
  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "Missing text" });
    return;
  }

  // 1. OpenRouter (primary) - same account/key as chat, cheap gpt-audio-mini model.
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    const audio = await speakWithOpenRouter(text, openRouterKey);
    if (audio) {
      res.setHeader("Content-Type", "audio/mpeg");
      res.send(audio);
      return;
    }
  }

  // 2. ElevenLabs (fallback)
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
  if (elevenLabsKey) {
    try {
      const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_ELEVENLABS_VOICE_ID;
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": elevenLabsKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg"
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      });

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        res.setHeader("Content-Type", "audio/mpeg");
        res.send(Buffer.from(audioBuffer));
        return;
      }
      console.warn("ElevenLabs TTS failed, falling back to Hugging Face.", await response.text());
    } catch (err) {
      console.error("ElevenLabs TTS error:", err);
    }
  }

  // 3. Hugging Face Inference API (last resort)
  try {
    const hfModel = "kakao-enterprise/vits-vctk";
    const hfToken = process.env.HF_API_KEY;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;

    const response = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ inputs: text })
    });

    if (response.ok) {
      const audioBuffer = await response.arrayBuffer();
      res.setHeader("Content-Type", "audio/wav");
      res.send(Buffer.from(audioBuffer));
      return;
    }

    const errText = await response.text();
    console.error("HF TTS Error:", errText);
    res.status(503).json({ error: "TTS service unavailable" });
  } catch (error) {
    console.error("HF TTS generation failed:", error);
    res.status(503).json({ error: "TTS service temporarily unavailable" });
  }
}
