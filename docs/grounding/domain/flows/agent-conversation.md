---
grounding_kind: flow
status: reviewed
last_verified: "2026-06-18"
source_anchors:
  - path: convex/aiTown/agent.ts
    symbol: Agent
  - path: convex/agent/conversation.ts
    symbol: startConversationMessage
owners: [conpera-town-maintainers]
---

# Flow: agent-conversation — two agents meet, talk, and remember it

One end-to-end use case: how an autonomous agent decides to talk to another, exchanges
LLM-generated messages, and stores a memory of it. Kept at the seam/module level.

## Trigger

During a game step, an idle agent's `tick` runs and the agent is not already in a
conversation, is off cooldown (`CONVERSATION_COOLDOWN`), and finds a nearby eligible
player. Touches [[anchor: convex/aiTown/agent.ts#Agent]].

## Actors / boundaries crossed

Game engine step loop -> agent tick -> engine inputs -> async agent operation -> LLM
provider (`convex/util/llm.ts`) -> messages table + memory/embedding tables.

## Steps

1. **Decide to start a conversation.** The agent tick selects a target and submits a
   `startConversation` input through the engine. Touches [[anchor: convex/aiTown/conversation.ts#startConversation]].
2. **Invite and approach.** The other player's membership moves `invited -> walkingOver ->
   participating` as they path close enough to talk. Touches [[anchor: convex/aiTown/conversation.ts#acceptInvite]].
3. **Generate the opening line.** An async operation gathers prompt context plus relevant
   memories and calls the LLM to produce the first message. Touches [[anchor: convex/agent/conversation.ts#startConversationMessage]].
4. **Write the message.** The generated text is persisted to the messages table (kept
   outside engine state for latency). Touches [[anchor: convex/messages.ts#writeMessage]].
5. **Continue, then leave.** The agents alternate messages until a limit
   (`MAX_CONVERSATION_MESSAGES` / `MAX_CONVERSATION_DURATION`) is hit, then a
   `leaveConversation` input ends it. Touches [[anchor: convex/aiTown/conversation.ts#leaveConversation]].
6. **Remember it.** An async memory operation summarizes the conversation via the LLM,
   embeds the summary, and stores it for future relevance search. Touches [[anchor: convex/agent/memory.ts#rememberConversation]].

## Side effects

- New rows in the messages table and in the agent memory/embedding tables.
- Player `lastConversation` / cooldown timestamps updated so the agent won't immediately
  re-engage.
- In this fork, the LLM tokens spent generating messages drain the player's hunger (see
  `domain/rules.md`).
