# AI Town Conversation Inspector

View active conversations, message history, and archived chats.

## Usage
```
/conversation <command> [args]
```

## Commands

- `/conversation active` — List all currently active conversations
- `/conversation messages <conversationId>` — Show messages in a conversation
- `/conversation history <playerId>` — Previous conversation for a player
- `/conversation recent` — Most recent archived conversations

## Implementation

```bash
cd /Users/subway/code/python/项目/openclaw/ai-town
WORLD_ID=$(npx convex run --no-push world:defaultWorldStatus '{}' 2>&1 | grep -o '"worldId":"[^"]*"' | cut -d'"' -f4)
```

| Command | Method | Details |
|---------|--------|---------|
| `active` | `world:worldState` | Parse `world.conversations` array from state |
| `messages CID` | `messages:listMessages` | `{"worldId":"$WORLD_ID","conversationId":"CID"}` |
| `history PID` | `world:previousConversation` | `{"worldId":"$WORLD_ID","playerId":"PID"}` |
| `recent` | Query `archivedConversations` | Needs custom query or direct DB access |

### Active conversations:
```bash
# Get world state and extract conversations
npx convex run --no-push world:worldState '{"worldId":"$WORLD_ID"}'
# Look for "conversations" array — each has: id, creator, participants, numMessages, lastMessage
```

### Message history:
```bash
npx convex run --no-push messages:listMessages '{"worldId":"$WORLD_ID","conversationId":"c:123"}'
```

## Output Format

For `active`:
```
| Conv ID | Players      | Messages | Status       |
|---------|-------------|----------|--------------|
| c:625   | Lucky, Bob   | 4        | participating |
| c:694   | Stella, Pete | 2        | walkingOver   |
```

For `messages`:
```
Lucky to Bob: Hey there! How's the gardening going?
Bob to Lucky: *grumbles* It's fine. The tomatoes are coming in.
Lucky to Bob: That's wonderful! I just got back from exploring a new planet!
Bob to Lucky: Sounds exhausting. I prefer my garden.
```

$ARGUMENTS
