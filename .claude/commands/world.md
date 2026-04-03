# AI Town World Management

Control the game world lifecycle — start, stop, reset, inspect.

## Usage
```
/world <command>
```

## Commands

- `/world status` — World and engine status (running/stopped, world ID, engine ID)
- `/world start` — Resume/start the game engine
- `/world stop` — Stop the game engine
- `/world kick` — Force-restart a stuck engine
- `/world reset` — Wipe all data and reinitialize (DESTRUCTIVE)
- `/world init [numAgents]` — Initialize world with agents (run after reset)
- `/world health` — Full health check (engine, agents, frontend, docker)

## Implementation

```bash
cd /Users/subway/code/python/项目/openclaw/ai-town
```

| Command | Convex Function | Notes |
|---------|----------------|-------|
| `status` | `world:defaultWorldStatus` | Returns worldId, engineId, status, lastViewed |
| `start` | `testing:resume` | Resumes from stoppedByDeveloper or inactive |
| `stop` | `testing:stop` | Sets status to stoppedByDeveloper |
| `kick` | `testing:kick` (internal) | Force engine step if stuck |
| `reset` | `testing:wipeAllTables` (internal) | **DESTRUCTIVE** — clears everything |
| `init` | `init` (default export) | `npx convex run init '{"numAgents":5}'` |
| `health` | Multiple checks | See below |

### Health check procedure:
```bash
# 1. Engine status
npx convex run --no-push world:defaultWorldStatus '{}'

# 2. World state (agents count, conversations)
npx convex run --no-push map:economyStatus '{"worldId":"$WORLD_ID"}'

# 3. Docker containers
docker ps --format "table {{.Names}}\t{{.Status}}" | grep ai-town

# 4. Frontend
curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/ai-town

# 5. tmux sessions
tmux list-sessions 2>/dev/null | grep ai-town

# 6. Recent engine logs
tmux capture-pane -t ai-town-backend -p -S -20 2>/dev/null | tail -10
```

### Full reset + reinitialize:
```bash
# 1. Stop engine
npx convex run testing:stop

# 2. Wipe tables (DESTRUCTIVE)
npx convex run testing:wipeAllTables

# 3. Wait a few seconds for wipe to propagate
sleep 5

# 4. Reinitialize world with agents
npx convex run init '{"numAgents":5}'

# 5. Seed POIs and scenes
npx convex run --no-push map:seedDefaultPOIs '{"worldId":"NEW_WORLD_ID"}'
npx convex run --no-push scene:generateDefaults '{"worldId":"NEW_WORLD_ID"}'

# 6. Reset economy
npx convex run --no-push map:resetEconomy '{"worldId":"NEW_WORLD_ID","hunger":100,"money":200}'
```

## Output Format

For `status`:
```
World: m1740pc6j60vz2tckae8h1cqjd845d45
Engine: ks78p10rcc3ahqz0z1td73c2mx845th1
Status: running
Last Viewed: 2026-04-03 15:30:00
```

For `health`:
```
| Check          | Status | Details               |
|----------------|--------|-----------------------|
| Engine         | OK     | running               |
| Agents         | OK     | 5 active              |
| Frontend       | OK     | HTTP 200              |
| Docker Backend | OK     | healthy (2h)          |
| Docker Dash    | OK     | up (2h)               |
```

$ARGUMENTS
