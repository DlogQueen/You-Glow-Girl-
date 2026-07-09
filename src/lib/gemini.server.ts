import { GoogleGenAI } from "@google/genai";
import { GoogleAuth } from "google-auth-library";

let aiClient: GoogleGenAI | null = null;

export function getAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

function parseDataUrl(dataUrl: string) {
  if (!dataUrl) {
    return { mimeType: "image/jpeg", base64Data: "" };
  }
  const trimmed = dataUrl.trim();
  // Matching with [\s\S]+ allows multi-line base64 payloads to parse correctly
  const match = trimmed.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (match) {
    return {
      mimeType: match[1],
      // Strip all formatting whitespace, line breaks, or carriage returns from base64 string
      base64Data: match[2].replace(/[\s\r\n]+/g, "")
    };
  }
  
  // Safe fallback if it's purely base64 or has a custom/different structure
  const cleanData = trimmed.includes(",") ? trimmed.split(",")[1] : trimmed;
  return {
    mimeType: "image/jpeg",
    base64Data: cleanData.replace(/[\s\r\n]+/g, "")
  };
}

export async function queryVertexDataStore(query: string) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || "gen-lang-client-0871747406";
  const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
  const dataStoreId = process.env.VERTEX_DATA_STORE_ID;

  if (!dataStoreId) {
    console.log("No Vertex Data Store ID configured. Skipping Data Store search grounding.");
    return null;
  }

  try {
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"]
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) {
      console.warn("Unable to obtain Google Cloud OAuth access token for Vertex Search.");
      return null;
    }

    const url = `https://discoveryengine.googleapis.com/v1beta/projects/${projectId}/locations/${location}/dataStores/${dataStoreId}/servingConfigs/default_serving_config:search`;

    const payload = {
      query,
      pageSize: 3,
      contentSearchSpec: {
        snippetSpec: {
          maxSnippetCount: 2
        }
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        // Silently skip Vertex Grounding when permissions are missing to prevent alarming console logs
        return null;
      }
      const errText = await response.text();
      console.warn(`Vertex Search API error (${response.status}):`, errText);
      return null;
    }

    const data: any = await response.json();
    const results = data.results || [];
    
    return results.map((r: any) => {
      const document = r.document || {};
      const derivedStructData = document.derivedStructData || {};
      const snippetsList = derivedStructData.snippets || [];
      const title = derivedStructData.title || document.id || "Verified Info";
      const link = derivedStructData.link || "";
      const textFromSnippets = snippetsList.map((s: any) => s.snippet).join("\n");
      return {
        title,
        link,
        content: textFromSnippets || JSON.stringify(derivedStructData)
      };
    }).filter((s: any) => s.content && s.content.trim().length > 0);

  } catch (err) {
    console.warn("Exception while calling Vertex Search:", err);
    return null;
  }
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

  // 1. Check if there is Vertex AI Search Data Store Grounding to fetch
  const dataStoreId = process.env.VERTEX_DATA_STORE_ID;
  let dataStoreGrounding = "";
  if (dataStoreId) {
    const snippets = await queryVertexDataStore(message);
    if (snippets && snippets.length > 0) {
      dataStoreGrounding = "\n\n[VERTEX DATA STORE DETAILS - USE THIS FOR RELEVANT VERIFIED DETAILS]:\n";
      snippets.forEach((s: any, idx: number) => {
        dataStoreGrounding += `Source ${idx + 1}: ${s.title}\nInfo: ${s.content}\nURL: ${s.link || 'N/A'}\n\n`;
      });
      dataStoreGrounding += "Reference these verified product/routine specifics dynamically while keeping your persona active.";
    }
  }

  const finalInstruction = systemInstruction 
    ? `${systemInstruction}${dataStoreGrounding}` 
    : `You are Ada, an elite beauty tech expert and digital pioneer trained on female tech pioneers. Named after mathematician Ada Lovelace. ${dataStoreGrounding}`;

  const chosenModel = process.env.MODEL || process.env.OPENROUTER_MODEL || "google/gemini-flash-1.5";
  const fallbackModel = process.env.MODEL2 || "google/gemini-pro-1.5";
  
  // Resilient model try sequence with retry exponential backoff
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
           break; // Success! Break out of the retry loop.
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
          const waitTime = Math.pow(2, attempt) * 600; // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }
    if (finalResponse) {
      break; // Success! Break out of model sequence.
    }
    console.warn(`[OpenRouter API Fallback] Model "${modelId}" overloaded or failed after all retries. Attempting next stable model...`);
  }

  if (!finalResponse) {
    throw lastError || new Error("All fallback models exhausted due to high API demand.");
  }

  return finalResponse.choices[0].message.content || 'No response from Ada.';
}
