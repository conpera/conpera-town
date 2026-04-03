# AI Town Map & Economy Tool

Map inspection, POI management, and economy dashboard for Conpera Town.

## Usage

```
/map <command> [args]
```

## Commands

### Info & Inspection
- `/map info` — Show map dimensions, tileset, layer count
- `/map tile <x> <y>` — Check walkability and tile IDs at position
- `/map find-space [size] [limit]` — Find NxN walkable grass areas (default 5x5, top 10)
- `/map status` — Economy dashboard: all agents' hunger, money, tokens

### POI Management
- `/map poi list` — List all active Points of Interest
- `/map poi add <name> <type> <x> <y> [label] [spriteUrl] [color]` — Add new POI
- `/map poi move <name> <x> <y>` — Move existing POI to new position
- `/map poi remove <name>` — Deactivate a POI
- `/map poi update <name> [--label X] [--sprite URL] [--color HEX]` — Update POI properties
- `/map poi seed` — Create default shop + workplace if missing

### Economy Management
- `/map feed <playerId> <amount>` — Adjust agent hunger (+/-)
- `/map pay <playerId> <amount>` — Adjust agent money (+/-)
- `/map reset-economy [hunger] [money]` — Reset all agents to initial values

### Tile Editing
- `/map block <x> <y>` — Make a tile impassable
- `/map unblock <x> <y>` — Make a tile walkable

## Implementation

When the user runs `/map <command>`, execute the corresponding `npx convex run` command:

**Get world ID first:**
```bash
cd /Users/subway/code/python/项目/openclaw/ai-town
WORLD_ID=$(npx convex run --no-push world:defaultWorldStatus '{}' 2>&1 | grep -o '"worldId":"[^"]*"' | cut -d'"' -f4)
```

**Command mapping:**

| Command | Convex Function | Args |
|---------|----------------|------|
| `info` | `map:mapInfo` | `{"worldId":"$WORLD_ID"}` |
| `tile X Y` | `map:tileAt` | `{"worldId":"$WORLD_ID","x":X,"y":Y}` |
| `find-space` | `map:findWalkableArea` | `{"worldId":"$WORLD_ID","size":5,"limit":10}` |
| `status` | `map:economyStatus` | `{"worldId":"$WORLD_ID"}` |
| `poi list` | `map:listPOI` | `{"worldId":"$WORLD_ID"}` |
| `poi add` | `map:addPOI` | `{"worldId":"$WORLD_ID","name":"...","type":"...","x":X,"y":Y,...}` |
| `poi move` | `map:movePOI` | `{"worldId":"$WORLD_ID","name":"...","x":X,"y":Y}` |
| `poi remove` | `map:removePOI` | `{"worldId":"$WORLD_ID","name":"..."}` |
| `poi update` | `map:updatePOI` | `{"worldId":"$WORLD_ID","name":"...","label":"..."}` |
| `poi seed` | `map:seedDefaultPOIs` | `{"worldId":"$WORLD_ID"}` |
| `poi activate` | `map:setPOIActive` | `{"worldId":"$WORLD_ID","name":"...","active":true}` |
| `poi deactivate` | `map:setPOIActive` | `{"worldId":"$WORLD_ID","name":"...","active":false}` |
| `feed P AMT` | `map:adjustHunger` | `{"worldId":"$WORLD_ID","playerId":"P","amount":AMT}` |
| `pay P AMT` | `map:adjustMoney` | `{"worldId":"$WORLD_ID","playerId":"P","amount":AMT}` |
| `reset-economy` | `map:resetEconomy` | `{"worldId":"$WORLD_ID"}` |
| `block X Y` | `map:setTileBlocked` | `{"worldId":"$WORLD_ID","x":X,"y":Y,"blocked":true}` |
| `unblock X Y` | `map:setTileBlocked` | `{"worldId":"$WORLD_ID","x":X,"y":Y,"blocked":false}` |

**All commands run from:** `cd /Users/subway/code/python/项目/openclaw/ai-town`

**Format:** Always use `npx convex run --no-push <function> '<json_args>'`

## POI Types

| Type | Purpose | Config Fields |
|------|---------|--------------|
| `shop` | Buy food → restore hunger | `foodCost`, `hungerRestore` |
| `workplace` | Work → earn money | `workDuration`, `workReward` |
| `landmark` | Visual marker only | — |
| `custom` | User-defined behavior | any |

## Output Format

Present results as clean tables. For `status`, show:
```
| Agent   | Hunger | Money | Tokens  | Activity          |
|---------|--------|-------|---------|-------------------|
| Lucky   |   45   |   30  | 52,341  | heading to shop   |
```

$ARGUMENTS
