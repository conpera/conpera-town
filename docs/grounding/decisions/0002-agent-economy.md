---
grounding_kind: adr
status: reviewed
last_verified: "2026-06-18"
source_anchors:
  - path: convex/constants.ts
    symbol: HUNGER_CRITICAL
  - path: convex/aiTown/player.ts
    symbol: serializedPlayer
  - path: convex/aiTown/agentInputs.ts
    symbol: agentBuyFood
owners: [conpera-town-maintainers]
---

# ADR-0002: Add a hunger/money economy on top of stock AI Town

## Context

This `conpera-town` fork extends stock AI Town with resource pressure: agents should burn
a budget as they think (LLM tokens cost money in the real world) and have to act to
sustain themselves, producing more goal-directed behavior than aimless socializing. We
needed a way to attach this without a destructive schema migration of existing worlds and
without breaking the engine's determinism. The tunables live in
[[anchor: convex/constants.ts#HUNGER_CRITICAL]], the per-player state in
[[anchor: convex/aiTown/player.ts#serializedPlayer]], and the player-facing actions in
[[anchor: convex/aiTown/agentInputs.ts#agentBuyFood]].

## Decision

We will model the economy as three optional serialized player fields — `hunger`, `money`,
and `totalTokensUsed` — added with `v.optional` so pre-economy worlds keep loading. Hunger
decreases as tokens are consumed (`consumeTokens`), and agents restore it by walking to a
shop tile to buy food (`agentBuyFood`) or earn money by working (`agentWork`). All economy
mutations go through the normal engine input path, so the simulation stays deterministic
and server-authoritative. Thresholds, costs, and the shop/workplace tile positions are all
constants so the economy can be retuned in one file.

## Consequences

Agents gain a maintenance loop that shapes movement and conversation choices; map authors
must keep `SHOP_POSITION`/`WORKPLACE_POSITION` on walkable tiles. The optional fields mean
economy-aware code must handle `undefined` (old players) gracefully. Because the fields
are part of the serialized world contract, they can be extended but not made required or
removed without a migration.

## Invariants established [INV-ids]

- INV-004 — economy fields stay `v.optional`; old worlds must still deserialize.

## Status

accepted
