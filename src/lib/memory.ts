import { LongTermMemoryEntry, Message } from "../types";

// How many new messages accumulate before the client fires a consolidation
// pass (raw short-term history -> one summarized long-term memory entry).
export const MEMORY_CONSOLIDATION_CHUNK_SIZE = 8;

// Long-term memory isn't semantically searched per-query (no embeddings, no
// vector DB - this is a zero-budget app) - instead every chat turn gets the
// same curated set: the highest-importance, most-recent entries. This caps
// how many are kept on the profile at all, and how many get folded into the
// system prompt.
export const MAX_STORED_MEMORIES = 30;
export const MEMORIES_IN_CONTEXT = 8;

export function buildTranscript(messages: Message[]): string {
  return messages.map((m) => `${m.role}: ${m.content}`).join("\n");
}

function rankMemories(memories: LongTermMemoryEntry[]): LongTermMemoryEntry[] {
  return [...memories].sort((a, b) => b.importance - a.importance || b.createdAt - a.createdAt);
}

export function addMemory(
  existing: LongTermMemoryEntry[] | undefined,
  entry: { summary: string; importance: number }
): LongTermMemoryEntry[] {
  const next: LongTermMemoryEntry = {
    id: Math.random().toString(36).slice(2),
    summary: entry.summary,
    importance: Math.min(5, Math.max(1, Math.round(entry.importance))),
    createdAt: Date.now(),
  };
  return rankMemories([...(existing || []), next]).slice(0, MAX_STORED_MEMORIES);
}

export function selectMemoriesForContext(memories: LongTermMemoryEntry[] | undefined): LongTermMemoryEntry[] {
  if (!memories || memories.length === 0) return [];
  return rankMemories(memories).slice(0, MEMORIES_IN_CONTEXT);
}
