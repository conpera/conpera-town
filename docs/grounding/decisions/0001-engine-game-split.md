---
grounding_kind: adr
status: reviewed
last_verified: "2026-06-18"
source_anchors:
  - path: convex/engine/abstractGame.ts
    symbol: AbstractGame
  - path: convex/aiTown/game.ts
    symbol: Game
owners: [conpera-town-maintainers]
---

# ADR-0001: Split a game-agnostic engine from AI-Town game rules

## Context

AI Town needs a server-authoritative simulation that runs inside Convex: it must load
world state, feed in ordered inputs from humans and agents, step time deterministically,
and persist the result — all while many clients subscribe to the live state. Mixing this
generic machinery with AI-Town-specific rules (players, conversations, pathfinding, the
economy) would make the simulation hard to fork and reason about, which is a stated goal
of the project (it is "a deployable starter kit meant to be extended"). The generic loop
is concentrated in the abstract base [[anchor: convex/engine/abstractGame.ts#AbstractGame]],
and the AI-Town rules in [[anchor: convex/aiTown/game.ts#Game]].

## Decision

We will keep a generic engine layer under `convex/engine/` that knows nothing about AI
Town, exposing an `AbstractGame` base class with `handleInput`/`tick`/`saveStep`, and put
all game-specific behavior in `convex/aiTown/`, where `Game extends AbstractGame`. State
advances only through the engine's input/step path, guarded by a generation number and a
monotonic time check in `applyEngineUpdate`. The dependency direction is strictly
`aiTown -> engine`; the engine never imports game code.

## Consequences

Forking game or agent behavior is localized to `convex/aiTown/` and `convex/agent/`
without touching the loop. The cost is indirection: any new gameplay element must be
expressed as engine inputs plus serialized state rather than ad-hoc mutations, and async
work (LLM calls) cannot mutate the world directly — it must re-enter through inputs.
Latency-sensitive data that does not need engine semantics is deliberately kept in plain
Convex tables (e.g. chat messages) instead of world state.

## Invariants established [INV-ids]

- INV-001 — the engine stays game-agnostic; `convex/engine/` never imports `convex/aiTown/`.
- INV-003 — world/engine state is mutated only via the input/step path through `applyEngineUpdate`.
- INV-006 — agent operations re-enter the world only by submitting inputs.

## Status

accepted
