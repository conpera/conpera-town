---
grounding_kind: code-map
status: reviewed
last_verified: "2026-06-18"
source_anchors:
  - path: convex/aiTown/main.ts
    symbol: runStep
  - path: convex/engine/abstractGame.ts
    symbol: AbstractGame
  - path: convex/aiTown/game.ts
    symbol: Game
  - path: src/editor/le.js
  - path: src/editor/leconvex.js
    symbol: saveScene
owners: [conpera-town-maintainers]
---

# Code Map

The structural ground truth for AI Town (this `conpera-town` fork): the modules, the
seams most likely to break when changed, the allowed dependency direction, and where to
go to change a given thing. Every claim that names a file or symbol is traced with an
inline anchors (double-bracket `anchor:` + repo-relative path, optionally `#Symbol`),
which the drift-checker resolves against the tree.

## 1. System overview

AI Town is a Convex-backed multi-agent simulation: AI characters (and optional human
players) live on a tile map, walk around, and hold LLM-driven conversations, with
per-character long-term memory stored as vector embeddings. The backend is a
deterministic, server-authoritative **game engine** running inside Convex actions: a
single `worlds` document holds all live state, players and agents submit **inputs**, and
the engine processes them tick-by-tick in `runStep` [[anchor: convex/aiTown/main.ts#runStep]].
The frontend is a Vite + React + PixiJS client under `src/` that subscribes to world
state and renders it. This fork additionally layers an **economy** on top of stock AI
Town: agents have hunger and money, spend hunger as they burn LLM tokens, and walk to a
shop or workplace to buy food or earn money.

## 2. Module inventory

`entry` is the file/symbol you open first to understand the module. `depends-on` /
`depended-by` reference other module names in this same table.

| Module          | Purpose (1 line)                                                        | Entry                                                  | Key files                                                                                  | Depends-on            | Depended-by         |
| --------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ | --------------------- | ------------------- |
| `engine`        | Generic, game-agnostic simulation loop: load/save state, feed inputs, step time | `convex/engine/abstractGame.ts#AbstractGame`           | `convex/engine/abstractGame.ts`, `convex/engine/historicalObject.ts`, `convex/engine/schema.ts` | (Convex)              | `aiTown`            |
| `aiTown`        | The game itself: world/player/conversation rules, inputs, agent game-loop logic | `convex/aiTown/game.ts#Game`                           | `convex/aiTown/game.ts`, `convex/aiTown/main.ts`, `convex/aiTown/player.ts`, `convex/aiTown/inputs.ts`, `convex/aiTown/agent.ts` | `engine`, `agent`, `util` | `frontend`          |
| `agent`         | Async LLM work outside the game loop: conversation generation + memory/embeddings | `convex/agent/conversation.ts#startConversationMessage` | `convex/agent/conversation.ts`, `convex/agent/memory.ts`, `convex/agent/embeddingsCache.ts`, `convex/agent/schema.ts` | `util`                | `aiTown`            |
| `util`          | Dependency-free helpers: LLM client, geometry, compression, async/object utils | `convex/util/llm.ts#chatCompletion`                    | `convex/util/llm.ts`, `convex/util/geometry.ts`, `convex/util/compression.ts`, `convex/util/minheap.ts` | (none)                | `aiTown`, `agent`   |
| `world-data`    | World bootstrap, map data, music/scene assets, messages, vacuuming crons | `convex/init.ts`                                       | `convex/init.ts`, `convex/world.ts`, `convex/map.ts`, `convex/messages.ts`, `convex/crons.ts` | `aiTown`              | `frontend`          |
| `frontend`      | PixiJS/React client: renders world state, sends player inputs over Convex | `src/components/Game.tsx`                               | `src/App.tsx`, `src/components/PixiGame.tsx`, `src/hooks/serverGame.ts`, `src/hooks/sendInput.ts` | `aiTown`, `world-data` | (browser)           |
| `level-editor`  | Standalone Vite/PixiJS authoring tools (`npm run le` / `se`): tile/object map editor + sprite/animation editor that emit map composite files and read/write scenes to Convex | `src/editor/le.js#loadMapFromModule`                   | `src/editor/le.js`, `src/editor/se.js`, `src/editor/mapfile.js`, `src/editor/lefurniture.js`, `src/editor/leconvex.js`, `src/editor/leconfig.js` | `aiTown` (via `convex/_generated/api`) | (offline tool — output consumed by `world-data`) |

## 3. Boundaries / seams

The interfaces most likely to break when changed, and the compatibility rule for each.

| Seam                            | Kind   | What crosses it                                                | Owner / definition                                       | Compatibility rule                                                                 |
| ------------------------------- | ------ | ------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Engine input handlers           | RPC    | Named inputs (`join`, `moveTo`, `startConversation`, economy ops) submitted by humans/agents | `convex/aiTown/inputs.ts#inputs`, `convex/aiTown/agentInputs.ts#agentInputs` | Inputs are processed deterministically; never change an existing input's arg validator without updating every caller (`sendInput`, agent ops). |
| Serialized world state          | DB     | The single `worlds` doc + descriptions/map serialized objects | `convex/aiTown/schema.ts#aiTownTables`, `convex/aiTown/player.ts#serializedPlayer` | Treat serialized fields as a wire contract; add fields as `v.optional(...)` so existing world docs still parse (the economy fields were added this way). |
| Engine save protocol            | DB     | `EngineUpdate` written back under a generation-number guard    | `convex/engine/abstractGame.ts#applyEngineUpdate`        | Generation-number + monotonic-time guards must hold; never bypass `applyEngineUpdate` to mutate engine state. |
| LLM provider contract           | HTTP   | Chat/embedding requests to OpenAI/Together/Ollama/custom       | `convex/util/llm.ts#getLLMConfig`                        | `EMBEDDING_DIMENSION` must match the embeddings table vector length; switching providers is a data-model change, not a config tweak. |

## 4. Data-model pointers

Where the authoritative data shapes live. Point at the source of truth; do not
transcribe schema here.

- Game tables (worlds, descriptions, archives, history graph): `convex/aiTown/schema.ts#aiTownTables`.
- Per-player serialized state, including the fork's `hunger`/`money` economy fields: `convex/aiTown/player.ts#serializedPlayer`.
- Engine-internal tables (engines, inputs): `convex/engine/schema.ts`.
- Agent memory + embedding tables (vector index lives here): `convex/agent/schema.ts`.
- Top-level schema that stitches them together: `convex/schema.ts`.

## 5. Dependency-direction rules

**Allowed (imports point this way):**
- `frontend` -> `aiTown` / `world-data` (the client reads game state and submits inputs; it never reaches into the engine).
- `aiTown` -> `engine` (the game extends the abstract engine; `Game` subclasses `AbstractGame`).
- `aiTown` / `agent` -> `util` (anyone may use the dependency-free helpers).
- `agent` -> `aiTown` only through inputs (async actions submit inputs back, they do not mutate world state directly).

**Forbidden:**
- `engine` -> `aiTown` (the engine is game-agnostic; it must never import AI-Town-specific rules — see `INV-001`).
- `util` -> anything in-app (`convex/util/llm.ts` is deliberately import-free; keep it that way — see `INV-002`).
- Any actor writing the `worlds` doc outside the engine's input/step path (see `INV-003`).

## 6. Where do I change X? (task -> files index)

| Task ("I want to change…")                         | Files to edit                                                              | Watch out for                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Add or change an agent behavior                    | `convex/aiTown/agent.ts`, `convex/aiTown/agentOperations.ts`               | Operations are async; they must finish by submitting an input, never by mutating state. |
| Add a new gameplay input (human + agent)           | `convex/aiTown/inputs.ts`, `convex/aiTown/agentInputs.ts`, `convex/aiTown/player.ts` | New inputs go through the engine input seam (§3); keep arg validators stable. |
| Tune economy (hunger/money/shop/workplace)         | `convex/constants.ts`, `convex/aiTown/agentInputs.ts`, `convex/aiTown/player.ts` | Serialized economy fields are `v.optional`; do not make them required (`INV-004`). |
| Change LLM provider / model                        | `convex/util/llm.ts`, env vars on the Convex deployment                    | Embedding dimension must match the vector index; this is a migration, not a flag. |
| Change how the world renders                       | `src/components/PixiGame.tsx`, `src/components/Game.tsx`, `src/hooks/serverGame.ts` | Client is read-mostly; gameplay changes belong in `convex/aiTown`, not the renderer. |
| Edit/author a map or sprite (level editor)         | `src/editor/le.js`, `src/editor/mapfile.js`, `src/editor/lefurniture.js`; sprite editor `src/editor/se.js` | Separate build (`npm run le` / `npm run se`) — NOT part of `npm run build`; edits here never touch the live world directly (see §7). |
| Change how the editor talks to Convex (load/save scenes) | `src/editor/leconvex.js`                                                    | Imports `convex/_generated/api`; regenerate types (`convex dev`) after changing scene queries/mutations, or the editor's API calls break. |

## 7. Level editor (`src/editor/`)

A **standalone, offline authoring tool**, not part of the running game and not part of
`npm run build`. It is its own Vite root served by separate scripts in `package.json`
[[anchor: package.json]]: `npm run le` / `npm run level-editor` (the tile/object map
editor, entry `src/editor/le.html` + `le.js`) and `npm run se` (the sprite/animation
editor, `se.html` + `se.js`). The map editor lets an author paint a background layer
(no collision) and an object layer (with collision), place furniture, and then **export a
map composite file** [[anchor: src/editor/mapfile.js#generate_level_file]] that is checked
into the repo and wired into the world at `convex/init.ts` (see `src/editor/README.md`).

It also has an **optional live path to Convex**: `leconvex.js` builds a
`ConvexHttpClient` against `VITE_CONVEX_URL` and imports `convex/_generated/api` to list,
load, and save *scenes* directly [[anchor: src/editor/leconvex.js#saveScene]]. This is the
one place outside `convex/` and `src/` (the game client) that depends on the generated
Convex API; when scene queries/mutations change, the generated types must be regenerated
(`convex dev`) or the editor's calls drift.

**Why it is its own module/seam:** it does not import the game engine or the React client,
and the *only* thing that flows from it into the game is data — committed map composite
files (consumed by `world-data` via `convex/init.ts`) and scene rows written through the
Convex API. It is intentionally outside the `tsc && vite build` gate; treat it as a
developer tool, and verify changes by running it (see `verification.md` §2e), not by the
game's type/lint gates alone.
