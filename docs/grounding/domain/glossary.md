---
grounding_kind: domain-glossary
status: reviewed
last_verified: "2026-06-18"
source_anchors:
  - path: convex/aiTown/world.ts
  - path: convex/aiTown/conversation.ts
    symbol: Conversation
owners: [conpera-town-maintainers]
---

# Domain Glossary — Ubiquitous Language

The shared, authoritative vocabulary for AI Town. One row per term as it appears in code
and docs, a one-line plain-language definition, and the code anchor where the concept
lives.

## Terms

| Term | Definition | Code anchor |
| --- | --- | --- |
| World | A single map plus everyone on it; all live players, agents, and conversations are stored in one `worlds` document. | [[anchor: convex/aiTown/world.ts#World]] |
| Engine | The game-agnostic loop that loads state, applies ordered inputs, steps time, and saves the result. | [[anchor: convex/engine/abstractGame.ts#AbstractGame]] |
| Game | The AI-Town subclass of the engine that holds the actual game rules and state. | [[anchor: convex/aiTown/game.ts#Game]] |
| Player | A character on the map, human or agent; has a position, may be pathfinding, and (in this fork) hunger/money. | [[anchor: convex/aiTown/player.ts#Player]] |
| Agent | The autonomous controller bound to a player: decides movement, conversation, and economy actions each tick. | [[anchor: convex/aiTown/agent.ts#Agent]] |
| Input | A named, validated request (human or agent) the engine processes deterministically to change world state. | [[anchor: convex/aiTown/inputs.ts#inputs]] |
| Conversation | A time-bounded exchange between (currently two) players; messages and lifecycle are tracked here. | [[anchor: convex/aiTown/conversation.ts#Conversation]] |
| Membership | A player's state within a conversation: `invited`, `walkingOver`, or `participating`. | [[anchor: convex/aiTown/conversationMembership.ts#ConversationMembership]] |
| Memory | A per-agent recollection (e.g. a conversation summary) embedded as a vector and searched by relevance + recency + importance. | [[anchor: convex/agent/memory.ts#rememberConversation]] |
| Operation | Async work an agent kicks off outside the loop (LLM calls, remembering); it re-enters via an input. | [[anchor: convex/aiTown/agentOperations.ts#agentDoSomething]] |
| Hunger | This fork's per-player resource that drains as the agent consumes LLM tokens; restored by buying food. | [[anchor: convex/aiTown/player.ts#consumeTokens]] |

## How to use this table

- Definitions state intent; the anchor carries the implementation.
- One anchor per term — the canonical type/function that owns the concept.
