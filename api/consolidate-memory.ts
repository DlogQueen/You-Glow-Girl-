import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateContentAI } from "../src/lib/gemini.server.js";

// Adapted from the Ansuz project's memory consolidation pattern: distill a
// chunk of raw conversation into one compact long-term memory instead of
// keeping every message forever. No embeddings/vector search here (that
// project uses Supabase+pgvector; this app has no budget for a second
// backend) - Ada just gets the highest-importance recent memories every
// turn instead of a per-query semantic match. See selectMemoriesForContext
// in src/lib/memory.ts.
const SUMMARIZATION_INSTRUCTION = `You distill a chunk of conversation between a user and Ada (an AI beauty coach) into one long-term memory. Focus on facts about the user - preferences, skin/beauty details, goals, recurring themes - and any decisions or advice given, not small talk.

Reply with ONLY a JSON object, no markdown fences, no commentary:
{"summary": "2-4 sentences, third person, specific enough to be useful weeks from now", "importance": 1-5}

importance guide: 1 = forgettable small talk, 3 = a normal useful exchange, 5 = a fact/preference/decision that should clearly shape future conversations.`;

function parseSummary(raw: string): { summary: string; importance: number } | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw) as { summary?: string; importance?: number };
    if (typeof parsed.summary === "string" && parsed.summary.trim()) {
      const importance = Math.min(5, Math.max(1, Math.round(parsed.importance ?? 3)));
      return { summary: parsed.summary.trim(), importance };
    }
  } catch {
    // fall through
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { transcript } = req.body || {};
  if (!transcript || typeof transcript !== "string") {
    res.status(400).json({ error: "Missing transcript" });
    return;
  }

  try {
    const raw = await generateContentAI(transcript, undefined, SUMMARIZATION_INSTRUCTION);
    const parsed = parseSummary(raw);
    if (!parsed) {
      // Model didn't return the expected JSON - still worth keeping something
      // rather than silently dropping the whole chunk.
      res.json({ summary: raw.trim().slice(0, 400), importance: 3 });
      return;
    }
    res.json(parsed);
  } catch (error: any) {
    console.error("Memory consolidation error:", error);
    res.status(500).json({ error: "Consolidation failed" });
  }
}
