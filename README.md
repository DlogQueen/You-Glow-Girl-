# You Glow Girl! 💄✨

An AI beauty companion app starring **Ada** — an AI Beauty Architect & Tech Pioneer who does live-camera makeup coaching, face analysis, virtual try-on, daily beauty tips, and chat, all wrapped in a persona inspired by the history of women in computing (Ada Lovelace, Grace Hopper, Hedy Lamarr, Margaret Hamilton, and more — see `soul.md`).

## Features

- **Ada Live** — real-time camera coaching with voice (Elite tier)
- **Face Scan & Blueprint** — onboarding face analysis (face shape, eye type, undertone)
- **Virtual Try-On** — live makeup color simulation over your camera feed
- **Chat with Ada** — text/voice chat with image context
- **Daily Tips** — AI-generated beauty tips with matching color palettes
- **Profile & Vanity** — personal beauty passport, saved looks, product vanity

Guest users can try the app immediately (progress is saved locally); signing in with Google syncs everything to the cloud and unlocks profile persistence across devices.

## Tech stack

- **Frontend**: Vite + React 19 + TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Vercel serverless functions (`/api/*.ts`)
- **AI**: OpenRouter (primary — `gpt-5-nano` for chat/vision, `gpt-audio-mini` for voice), with a direct Gemini API fallback
- **Data**: Firebase (Auth + Firestore)
- **Payments**: Stripe Payment Link (manual tier upgrade until a webhook is built — see `firestore.rules`)

## Run locally

**Prerequisites**: Node.js, the [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`)

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in at least `OPENROUTER_API_KEY` (get one free at https://openrouter.ai/keys)
3. Run: `npm run dev` (uses `vercel dev`, which serves both the Vite frontend and the `/api` functions)

## Deploy

This project is a standard Vite + Vercel-functions app — connect the repo at https://vercel.com/new, set the environment variables from `.env.example`, and deploy. No other configuration needed (see `vercel.json`).

## Project structure

- `src/` — the React app (`components/`, `lib/`, `hooks/`)
- `api/` — Vercel serverless functions (chat, face analysis, daily tips, TTS, model listing)
- `soul.md` — Ada's persona/system prompt
- `firestore.rules` / `firebase-blueprint.json` — Firestore security rules and data schema
- `ada_training.jsonl` — example fine-tuning conversations capturing Ada's voice
