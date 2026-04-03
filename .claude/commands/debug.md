# AI Town Debug Tools

Testing utilities for LLM, embeddings, and engine debugging.

## Usage
```
/debug <command> [args]
```

## Commands

- `/debug llm` — Test LLM chat completion endpoint
- `/debug embedding <text>` — Test embedding generation
- `/debug spawn-robots <n>` — Spawn N debug robot players
- `/debug random-move` — Move all players to random positions
- `/debug engine-logs [lines]` — Show recent engine logs from tmux
- `/debug token-stats` — Detailed token usage breakdown by operation type

## Implementation

```bash
cd /Users/subway/code/python/项目/openclaw/ai-town
WORLD_ID=$(npx convex run --no-push world:defaultWorldStatus '{}' 2>&1 | grep -o '"worldId":"[^"]*"' | cut -d'"' -f4)
```

| Command | Convex Function | Args |
|---------|----------------|------|
| `llm` | `testing:testCompletion` | `{}` |
| `embedding TEXT` | `testing:testEmbedding` | `{"input":"TEXT"}` |
| `spawn-robots N` | `testing:debugCreatePlayers` (internal) | `{"numPlayers":N}` |
| `random-move` | `testing:randomPositions` (internal) | `{}` |
| `engine-logs` | tmux capture | `tmux capture-pane -t ai-town-backend -p -S -50` |
| `token-stats` | `world:tokenUsageStats` | `{"worldId":"$WORLD_ID","playerId":"..."}` per agent |

### LLM test:
```bash
npx convex run --no-push testing:testCompletion '{}'
# Returns: { content: "...", ms: 1234, retries: 0, usage: { prompt_tokens, completion_tokens, total_tokens } }
```

### Engine logs:
```bash
tmux capture-pane -t ai-town-backend -p -S -50 -J 2>&1 | grep -E "(Error|agent|conversation|token|hungry)" | tail -20
```

### Token breakdown:
```bash
# Per agent
npx convex run --no-push world:tokenUsageStats '{"worldId":"$WORLD_ID","playerId":"p:0"}'
# Shows last 50 records with operation type, tokens, timestamp
```

$ARGUMENTS
