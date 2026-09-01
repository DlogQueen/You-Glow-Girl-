import type { VercelRequest, VercelResponse } from "@vercel/node";

const STATIC_FALLBACK_MODELS = [
  { name: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", description: "Ada's brain when using a direct Gemini API key.", isFallback: false },
  { name: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash", description: "Fallback model if 2.5 Flash is unavailable.", isFallback: true }
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const defaultModel = process.env.OPENROUTER_MODEL || "google/gemma-4-31b-it:free";

  if (!openRouterKey) {
    res.json({
      models: process.env.GEMINI_API_KEY ? STATIC_FALLBACK_MODELS : [],
      apiKeyConfigured: !!process.env.GEMINI_API_KEY,
      provider: process.env.GEMINI_API_KEY ? "gemini" : "none"
    });
    return;
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        "Authorization": `Bearer ${openRouterKey}`,
        "HTTP-Referer": process.env.APP_URL || "https://youglowgirl.app",
        "X-Title": "Ada Glow"
      }
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API returned ${response.status}`);
    }

    const data = await response.json();
    const modelsArray = data.data || [];

    const mappedModels = modelsArray
      .filter((m: any) => /^(google|openai|anthropic|meta-llama)\//.test(m.id || ""))
      .map((m: any) => ({
        name: m.id || "",
        displayName: m.name || m.id?.split("/").pop() || "AI Model",
        description: m.description || `Context length: ${m.context_length}.`,
        isFallback: m.id !== defaultModel
      }))
      .sort((a: any, b: any) => Number(a.isFallback) - Number(b.isFallback));

    res.json({ models: mappedModels, apiKeyConfigured: true, provider: "openrouter" });
  } catch (error: any) {
    console.error("Error listing OpenRouter models:", error);
    res.json({
      models: STATIC_FALLBACK_MODELS,
      apiKeyConfigured: true,
      provider: "openrouter",
      error: error.message || "Failed to query live OpenRouter registry."
    });
  }
}
