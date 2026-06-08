# Gemini AI Coding Patterns

- Prefer the @google/genai TypeScript SDK.
- Keep API keys server-side (in `server.ts`).
- Never expose API keys to the browser.
- Use `process.env.GEMINI_API_KEY` in server-side contexts.
- Implement lazy initialization of SDK clients within API routes.
