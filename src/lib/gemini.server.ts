
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

export async function generateContentAI(message: string, image?: string, systemInstruction?: string) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is required');
  }

  const parts: any[] = [];
  
  if (image && typeof image === "string" && image.trim().length > 0) {
    const { mimeType, base64Data } = parseDataUrl(image);
    
    const isValidBase64 = base64Data.length > 150 && /^[A-Za-z0-9+/=]+$/.test(base64Data);
    
    if (isValidBase64) {
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${base64Data}`
        }
      });
    } else {
      console.warn("Skipping corrupt, empty, or invalid inline image attachment to prevent API error 400.");
    }
  }
  
  parts.push({ type: "text", text: message });

  const finalInstruction = systemInstruction 
    ? systemInstruction 
    : "You are Ada, an elite beauty tech expert and digital pioneer trained on female tech pioneers. Named after mathematician Ada Lovelace.";

  const chosenModel = process.env.MODEL || process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001";
  const fallbackModel = process.env.MODEL2 || "google/gemini-flash-1.5";
  
  const modelsToTry = [chosenModel, fallbackModel, "google/gemini-flash-1.5-8b"];
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
            "HTTP-Referer": "https://aistudio.google.com", 
            "X-Title": "Ada Glow"
          },
          body: JSON.stringify({
            model: modelId,
            messages: [
              { role: "system", content: finalInstruction },
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
