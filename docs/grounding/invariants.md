---
grounding_kind: invariants
status: reviewed
last_verified: "2026-06-18"
source_anchors:
  - path: convex/engine/abstractGame.ts
    symbol: applyEngineUpdate
  - path: convex/aiTown/player.ts
    symbol: serializedPlayer
  - path: convex/util/llm.ts
    symbol: EMBEDDING_DIMENSION
owners: [conpera-town-maintainers]
---

# Invariants

Constraints an agent or human MUST obey, and the forbidden zones they must NEVER touch.
Each row is one invariant: a `MUST`/`NEVER` statement, its category, how to verify it
still holds, and an anchor to the code it governs. IDs are declared here and only
referenced elsewhere (`verification.md`, ADRs). Categories: `security` |
`data-integrity` | `architecture` | `do-not-touch`.

| INV-id  | statement (MUST / NEVER)                                                                                                                                            | category       | how-to-verify                                                                                                          | anchor |
|---------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------|------------------------------------------------------------------------------------------------------------------------|--------|
| INV-001 | The generic engine MUST stay game-agnostic: code under `convex/engine/` MUST NOT import anything from `convex/aiTown/`. The dependency points `aiTown -> engine`, never back. | architecture   | `grep -rn "aiTown" convex/engine/` returns no import lines; `npm run lint` passes; review new imports in `convex/engine/`. | `[[anchor: convex/engine/abstractGame.ts#AbstractGame]]` |
| INV-002 | `convex/util/llm.ts` MUST remain dependency-free (no imports). It is the portable LLM client and its first line documents this contract. | architecture   | Confirm the file has no `import` statements (its header reads "No imports and no dependencies"); review diffs that add any import. | `[[anchor: convex/util/llm.ts#getLLMConfig]]` |
| INV-003 | The single `worlds` document and engine state MUST only be mutated through the engine's input/step path. NEVER write `worlds`/`engines`/`inputs` directly from an action; go through `applyEngineUpdate` under its generation-number guard. | data-integrity | Review any new `ctx.db.patch/replace/insert` touching `worlds`/`engines`; confirm mutations flow through `insertInput`/`applyEngineUpdate`; engine time must move forward, never backward. | `[[anchor: convex/engine/abstractGame.ts#applyEngineUpdate]]` |
| INV-004 | Economy fields on a player (`hunger`, `money`, `totalTokensUsed`) MUST stay `v.optional(...)`. NEVER make them required — existing `worlds` documents predate the economy and must still deserialize. | data-integrity | Read `serializedPlayer`; confirm the three economy fields are wrapped in `v.optional`; load a pre-economy world without a migration error. | `[[anchor: convex/aiTown/player.ts#serializedPlayer]]` |
| INV-005 | `EMBEDDING_DIMENSION` MUST match the vector length of the `embeddings` table and the configured provider's embedding model. NEVER change the provider/model without aligning the dimension (it is a data migration, not a config flag). | data-integrity | Compare `EMBEDDING_DIMENSION` against the embeddings vector index in `convex/agent/schema.ts` and the provider in `getLLMConfig`; re-embed if the dimension changes. | `[[anchor: convex/util/llm.ts#EMBEDDING_DIMENSION]]` |
| INV-006 | Agent operations MUST complete by submitting an input back to the engine, NEVER by mutating game state inline. Async LLM work runs outside the deterministic loop and may only re-enter via inputs. | architecture   | Review `convex/aiTown/agentOperations.ts`: each `internalAction` ends by calling an `agentInputs` handler (e.g. via `insertInput`), not a direct world write. | `[[anchor: convex/aiTown/agentInputs.ts#agentInputs]]` |
| INV-007 | Generated Convex code under `convex/_generated/` MUST NOT be edited by hand. NEVER modify these files; regenerate them by running `convex dev`/`convex codegen`. | do-not-touch   | Confirm no change touches `convex/_generated/`; regenerate and diff to ensure the tree matches generator output. | `[[anchor: convex/_generated/api.d.ts]]` |

## Notes

- `do-not-touch` (INV-007) is the layer that stops automated edits to forbidden zones:
  everything under `convex/_generated/` is owned by the Convex codegen and is read-only
  to agents and humans alike.
- INV-003 and INV-006 together encode the engine's core safety property: the world is
  server-authoritative and only the deterministic step loop, fed by ordered inputs,
  advances it. Async work (LLM calls, memory writes) lives in separate tables and rejoins
  through inputs.
