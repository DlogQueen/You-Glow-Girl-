import path from "path";
import fs from "fs";

const FALLBACK_INSTRUCTION =
  "You are Ada, an elite beauty tech expert and digital pioneer trained on female tech pioneers.";

let cached: string | null = null;

export function getAdaSystemInstruction(): string {
  if (cached) return cached;
  const soulPath = path.join(process.cwd(), "soul.md");
  cached = fs.existsSync(soulPath) ? fs.readFileSync(soulPath, "utf8") : FALLBACK_INSTRUCTION;
  return cached;
}
