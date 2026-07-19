function parseDataUrl(dataUrl: string) {
  if (!dataUrl) {
    return { mimeType: "image/jpeg", base64Data: "" };
  }
  const trimmed = dataUrl.trim();
  const match = trimmed.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (match) {
    return {
      mimeType: match[1],
      base64Data: match[2].replace(/[\s\r\n]+/g, "")
    };
  }

  const cleanData = trimmed.includes(",") ? trimmed.split(",")[1] : trimmed;
  return {
    mimeType: "image/jpeg",
    base64Data: cleanData.replace(/[\s\r\n]+/g, "")
  };
}

function extractValidImage(image?: string) {
  if (!image || typeof image !== "string" || image.trim().length === 0) return null;
  const { mimeType, base64Data } = parseDataUrl(image);
  const isValidBase64 = base64Data.length > 150 && /^[A-Za-z0-9+/=]+$/.test(base64Data);
  if (!isValidBase64) {
    console.warn("Skipping corrupt, empty, or invalid inline image attachment to prevent API error 400.");
    return null;
  }
  return { mimeType, base64Data };
}

const DEFAULT_SYSTEM_INSTRUCTION =
  "You are Ada, an elite beauty tech expert and digital pioneer trained on female tech pioneers. Named after mathematician Ada Lovelace.";

async function generateWithGemini(message: string, image: string | undefined, systemInstruction: string, apiKey: string) {
  const chosenModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const fallbackModel = "gemini-2.0-flash";
  const modelsToTry = [...new Set([chosenModel, fallbackModel])];

  const parts: any[] = [{ text: message }];
  const validImage = extractValidImage(image);
  if (validImage) {
    parts.push({ inlineData: { mimeType: validImage.mimeType, data: validImage.base64Data } });
  }

  let lastError: any = null;
  for (const modelId of modelsToTry) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: "user", parts }],
            generationConfig: { temperature: 0.7 }
          })
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
      if (!text) throw new Error("Empty response from Gemini API.");
      return text;
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini API Warning] Model "${modelId}" failed:`, err.message || err);
    }
  }

  throw lastError || new Error("All Gemini models failed.");
}

async function generateWithOpenRouter(message: string, image: string | undefined, systemInstruction: string, apiKey: string) {
  const parts: any[] = [];
  const validImage = extractValidImage(image);
  if (validImage) {
    parts.push({
      type: "image_url",
      image_url: { url: `data:${validImage.mimeType};base64,${validImage.base64Data}` }
    });
  }
  parts.push({ type: "text", text: message });

  // gpt-5-nano is the cheapest vision-capable model on OpenRouter by a wide
  // margin and is plenty for Ada's chat/tip/face-analysis prompts. No audio
  // is needed here (that's handled separately in api/tts.ts), so cost beats
  // picking a pricier model like Gemini for this path.
  const chosenModel = process.env.OPENROUTER_MODEL || "openai/gpt-5-nano";
  const modelsToTry = [...new Set([
    chosenModel,
    "openai/gpt-5-mini",
    "google/gemini-3.5-flash",
    "google/gemini-2.5-flash"
  ])];

  let finalResponse = null;
  let lastError: any = null;

  for (const modelId of modelsToTry) {
    let attempt = 1;
    const maxRetries = 3;
    while (attempt <= maxRetries) {
      try {
        console.log(`[OpenRouter API Request] Trying model: "${modelId}" (Attempt ${attempt}/${maxRetries})`);

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.APP_URL || "https://youglowgirl.app",
            "X-Title": "Ada Glow"
          },
          body: JSON.stringify({
            model: modelId,
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: parts }
            ],
            temperature: 0.7
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`OpenRouter API Error (${response.status}): ${errText}`);
        }

        const data = await response.json();

        if (data.choices && data.choices.length > 0) {
          finalResponse = data;
          break;
        } else {
          throw new Error("Invalid response from OpenRouter API.");
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err.message || "").toLowerCase();
        const isTransient = errMsg.includes("503") ||
          errMsg.includes("unavailable") ||
          errMsg.includes("429") ||
          errMsg.includes("demand") ||
          errMsg.includes("rate limit") ||
          errMsg.includes("overloaded");

        console.warn(`[OpenRouter API Warning] Attempt ${attempt}/${maxRetries} with model ${modelId} triggered error:`, err);

        if (!isTransient) {
          throw err;
        }

        attempt++;
        if (attempt <= maxRetries) {
          const waitTime = Math.pow(2, attempt) * 600;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }
    if (finalResponse) {
      break;
    }
    console.warn(`[OpenRouter API Fallback] Model "${modelId}" overloaded or failed after all retries. Attempting next stable model...`);
  }

  if (!finalResponse) {
    throw lastError || new Error("All fallback models exhausted due to high API demand.");
  }

  return finalResponse.choices[0].message.content || 'No response from Ada.';
}

/**
 * OpenRouter is primary - one key covers every model (Gemini 3.5 Flash by
 * default), so that's the only thing most people need to set up. A direct
 * GEMINI_API_KEY is an optional fallback/override for anyone who'd rather
 * call Google's API straight (e.g. to use its separate free-tier quota).
 */
export async function generateContentAI(message: string, image?: string, systemInstruction?: string) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (!geminiKey && !openRouterKey) {
    throw new Error('OPENROUTER_API_KEY (or GEMINI_API_KEY) environment variable is required');
  }

  const finalInstruction = systemInstruction || DEFAULT_SYSTEM_INSTRUCTION;

  if (openRouterKey) {
    try {
      return await generateWithOpenRouter(message, image, finalInstruction, openRouterKey);
    } catch (err) {
      if (!geminiKey) throw err;
      console.warn("[AI Provider] OpenRouter failed, falling back to direct Gemini:", err);
    }
  }

  return generateWithGemini(message, image, finalInstruction, geminiKey!);
}
