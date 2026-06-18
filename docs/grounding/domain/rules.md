---
grounding_kind: domain-rules
status: reviewed
last_verified: "2026-06-18"
source_anchors:
  - path: convex/aiTown/conversation.ts
    symbol: acceptInvite
  - path: convex/constants.ts
owners: [conpera-town-maintainers]
---

# Domain Rules — Business Logic

The business rules AI Town enforces, in plain language. Each rule is a single MUST / MUST
NOT statement, optionally linked to the `INV-id` that hardens it in `invariants.md`, plus a
code anchor to where it is implemented. Numeric thresholds named below are defined in
`convex/constants.ts`.

## Rules

| Rule (plain statement) | INV-id | Code anchor |
| --- | --- | --- |
| A player MUST be in at most one conversation at a time; starting one requires the player be free. | — | [[anchor: convex/aiTown/conversation.ts#startConversation]] |
| A conversation MUST end once it exceeds `MAX_CONVERSATION_MESSAGES` messages or `MAX_CONVERSATION_DURATION`. | — | [[anchor: convex/aiTown/agent.ts#Agent]] |
| An invited player only joins once close enough; the membership progresses `invited -> walkingOver -> participating`. | — | [[anchor: convex/aiTown/conversation.ts#acceptInvite]] |
| Movement is destination-based: an agent requests a target and the engine pathfinds, bounded by `MAX_PATHFINDS_PER_STEP` per step. | INV-003 | [[anchor: convex/aiTown/movement.ts#movePlayer]] |
| An agent's async operation MUST conclude by submitting an input; it never writes world state directly. | INV-006 | [[anchor: convex/aiTown/agentOperations.ts#agentDoSomething]] |
| Consuming LLM tokens MUST reduce the player's hunger proportionally (`TOKENS_PER_HUNGER_POINT`). | INV-004 | [[anchor: convex/aiTown/player.ts#consumeTokens]] |
| Buying food MUST require sufficient money and is rejected otherwise; it costs `FOOD_COST` and restores `FOOD_HUNGER_RESTORE`. | INV-004 | [[anchor: convex/aiTown/agentInputs.ts#agentBuyFood]] |
| Stale memories older than `VACUUM_MAX_AGE` MUST be vacuumed by the daily cron. | — | [[anchor: convex/crons.ts#vacuumOldEntries]] |

## How to use this table

- One rule per row, one assertion per rule.
- When a rule is safety-critical, it is promoted to `invariants.md` and the `INV-NNN` is
  cited here; the checker errors on any referenced id missing there.
- Anchors point at the function that upholds the rule, not at every call site.
