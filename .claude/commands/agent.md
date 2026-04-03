# AI Town Agent Management

Spawn, inspect, modify, and manage AI agents in Conpera Town.

## Usage
```
/agent <command> [args]
```

## Commands

### Inspection
- `/agent list` — List all agents with name, hunger, money, tokens, activity
- `/agent inspect <playerId>` — Detailed agent info (personality, plan, position, memories)
- `/agent conversations <playerId>` — Recent conversation history for agent

### Lifecycle
- `/agent spawn [characterIndex]` — Spawn new agent (index into Descriptions array, 0-4)
- `/agent remove <playerId>` — Remove agent from world
- `/agent respawn` — Remove all agents and recreate from character definitions

### Economy
- `/agent feed <playerId> <amount>` — Adjust hunger (alias for /map feed)
- `/agent pay <playerId> <amount>` — Adjust money (alias for /map pay)

### Personality
- `/agent identity <agentId>` — Show agent's identity and plan
- `/agent set-plan <agentId> <plan>` — Update agent's conversation goal/plan

## Implementation

**Get world ID first:**
```bash
cd /Users/subway/code/python/项目/openclaw/ai-town
WORLD_ID=$(npx convex run --no-push world:defaultWorldStatus '{}' 2>&1 | grep -o '"worldId":"[^"]*"' | cut -d'"' -f4)
```

| Command | Method | Details |
|---------|--------|---------|
| `list` | `map:economyStatus` | `{"worldId":"$WORLD_ID"}` — shows all agents with economy stats |
| `inspect P` | `world:worldState` + grep | Get full world state, filter by playerId P |
| `conversations P` | `world:previousConversation` | `{"worldId":"$WORLD_ID","playerId":"P"}` |
| `spawn N` | `map:seedDefaultPOIs` then engine input | Send `createAgent` input via `npx convex run init` |
| `remove P` | Engine input | Send `leave` input: `{"playerId":"P"}` via sendInput |
| `identity A` | Query `agentDescriptions` | Filter by agentId in gameDescriptions |
| `feed P AMT` | `map:adjustHunger` | `{"worldId":"$WORLD_ID","playerId":"P","amount":AMT}` |
| `pay P AMT` | `map:adjustMoney` | `{"worldId":"$WORLD_ID","playerId":"P","amount":AMT}` |

### Inspect agent details (composite query):
```bash
# Get world state and extract agent info
npx convex run --no-push world:worldState '{"worldId":"$WORLD_ID"}'
# Then filter for specific playerId in the JSON output

# Get agent descriptions (personality)
npx convex run --no-push world:gameDescriptions '{"worldId":"$WORLD_ID"}'

# Get token usage history
npx convex run --no-push world:tokenUsageStats '{"worldId":"$WORLD_ID","playerId":"P"}'
```

### Character roster (hardcoded in data/characters.ts):
| Index | Name | Character | Personality |
|-------|------|-----------|-------------|
| 0 | Lucky | f1 | Happy, curious, loves cheese, space explorer |
| 1 | Bob | f4 | Grumpy, gardener, avoids people |
| 2 | Stella | f6 | Charming sociopath, manipulative |
| 3 | Alice | f3 | Famous scientist, speaks in riddles |
| 4 | Pete | f7 | Deeply religious, warns about hell |

## Output Format

For `list`:
```
| ID   | Name   | Hunger | Money | Tokens  | Activity              |
|------|--------|--------|-------|---------|----------------------|
| p:0  | Lucky  |   71   |  200  | 3,012   | reading a book        |
| p:2  | Bob    |   78   |  200  | 2,549   | heading to shop       |
```

For `inspect`:
```
Agent: Lucky (p:0, agent a:1)
Position: (12.4, 13.0)
Hunger: 71/100  Money: $200  Tokens: 3,012
Identity: Lucky is always happy and curious...
Plan: You want to hear all the gossip.
Activity: reading a book
```

$ARGUMENTS
