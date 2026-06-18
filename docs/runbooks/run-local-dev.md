# Runbook: run AI Town locally (frontend + Convex backend)

**Trigger:** You want to bring up the simulation on your machine to develop or debug — a
fresh clone, or after pulling changes that touch `convex/` or `src/`.

**Prereqs:** Node + npm installed; a Convex account (free) for the standard cloud-dev
setup. An LLM provider is required for agents to talk — set one before the world runs (see
step 4).

1. Install dependencies: `npm install`
2. Configure an LLM provider on the Convex deployment. For local Ollama no key is needed;
   otherwise set one, e.g. `npx convex env set OPENAI_API_KEY '<your-key>'` (Together uses
   `TOGETHER_API_KEY`, a custom OpenAI-compatible endpoint uses `LLM_API_URL`). The
   selected provider's embedding dimension must match `EMBEDDING_DIMENSION` in
   `convex/util/llm.ts` (see INV-005).
3. Start everything (frontend + backend in parallel): `npm run dev`. The `predev` hook
   first runs `convex dev --run init --until-success`, which seeds the default world via
   `convex/init.ts`. On first run this prompts you to log into Convex.
4. **Verify:** open http://localhost:5173 — the town renders and characters begin moving
   and chatting within a minute. Backend logs stream in the `dev:backend` terminal; a
   missing-API-key error there means step 2 was skipped.

**Run halves separately** (handy when iterating on backend functions):
- Terminal 1: `npm run dev:backend`
- Terminal 2: `npm run dev:frontend`

**Before pushing a change:** `npm test` (Jest util/engine suite) and `npm run build`
(`tsc && vite build`) must pass; `npm run lint` clean. See `docs/grounding/verification.md`.

**Rollback / reset:** stop the dev processes (Ctrl-C). To wipe and reseed the world, clear
the Convex tables from the dashboard (`npm run dashboard`) and re-run `npm run dev` so
`init` reseeds. No production data is touched by local dev.

**Validated-by:** commands cross-checked against `package.json` scripts and the README
"Standard Setup" on 2026-06-18. (No `last_verified` field until a job actually stamps it.)
