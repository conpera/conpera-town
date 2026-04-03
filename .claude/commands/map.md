# AI Town Map, Scene & Economy Tool

Map inspection, POI management, interior scene editing, and economy dashboard for Conpera Town.

## Usage

```
/map <command> [args]
```

## Commands

### Info & Inspection
- `/map info` — Map dimensions, tileset, layer count
- `/map tile <x> <y>` — Check walkability and tile IDs at position
- `/map find-space [size] [limit]` — Find NxN walkable grass areas
- `/map status` — Economy dashboard: all agents' hunger, money, tokens

### POI Management
- `/map poi list` — List all active Points of Interest
- `/map poi add <name> <type> <x> <y> [label] [spriteUrl] [color]` — Add new POI
- `/map poi move <name> <x> <y>` — Move POI
- `/map poi remove <name>` — Deactivate POI
- `/map poi update <name> [--label X] [--sprite URL] [--color HEX]` — Update POI
- `/map poi seed` — Create default shop + workplace
- `/map poi activate <name>` / `/map poi deactivate <name>` — Toggle POI

### Scene Management (Interior Rooms)
- `/map scene list` — List all interior scenes
- `/map scene show <name>` — Full scene data (tilemap, furniture, spawn/exit)
- `/map scene create <name> <displayName> <width> <height>` — Create empty scene
- `/map scene delete <name>` — Delete scene
- `/map scene defaults` — Generate default shop + workplace interiors
- `/map scene import <name> <displayName>` — Import editor-exported map.js (read file, pass as mapData)

### Furniture Management
- `/map furniture list <sceneName>` — List all furniture in a scene
- `/map furniture add <sceneName> <name> <type> <x> <y> [--action ACTION] [--w W] [--h H]` — Add furniture
- `/map furniture remove <sceneName> <furnitureId>` — Remove furniture
- `/map furniture move <sceneName> <furnitureId> <x> <y>` — Move furniture

### AI Perception
- `/map perceive <sceneName>` — What an AI agent sees in a room (furniture + interactables)

### Economy Management
- `/map feed <playerId> <amount>` — Adjust agent hunger (+/-)
- `/map pay <playerId> <amount>` — Adjust agent money (+/-)
- `/map reset-economy [hunger] [money]` — Reset all agents

### Tile Editing
- `/map block <x> <y>` — Make tile impassable
- `/map unblock <x> <y>` — Make tile walkable
- `/map building-collision <x> <y>` — Set 3x3 building collision footprint

## Implementation

When the user runs `/map <command>`, execute the corresponding `npx convex run` command.

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
| `scene list` | `scene:listScenes` | `{"worldId":"$WORLD_ID"}` |
| `scene show` | `scene:getScene` | `{"worldId":"$WORLD_ID","name":"..."}` |
| `scene create` | `scene:create` | `{"worldId":"$WORLD_ID","name":"...","displayName":"...","width":W,"height":H}` |
| `scene delete` | `scene:deleteScene` | `{"worldId":"$WORLD_ID","name":"..."}` |
| `scene defaults` | `scene:generateDefaults` | `{"worldId":"$WORLD_ID"}` |
| `scene import` | `scene:importFromEditor` | `{"worldId":"$WORLD_ID","name":"...","displayName":"...","mapData":{...}}` |
| `furniture list` | `scene:getFurniture` | `{"worldId":"$WORLD_ID","sceneName":"..."}` |
| `furniture add` | `scene:addFurniture` | `{"worldId":"$WORLD_ID","sceneName":"...","name":"...","type":"...","x":X,"y":Y}` |
| `furniture remove` | `scene:removeFurniture` | `{"worldId":"$WORLD_ID","sceneName":"...","furnitureId":"..."}` |
| `furniture move` | `scene:moveFurniture` | `{"worldId":"$WORLD_ID","sceneName":"...","furnitureId":"...","x":X,"y":Y}` |
| `perceive` | `scene:perceiveRoom` | `{"worldId":"$WORLD_ID","sceneName":"..."}` |
| `feed P AMT` | `map:adjustHunger` | `{"worldId":"$WORLD_ID","playerId":"P","amount":AMT}` |
| `pay P AMT` | `map:adjustMoney` | `{"worldId":"$WORLD_ID","playerId":"P","amount":AMT}` |
| `reset-economy` | `map:resetEconomy` | `{"worldId":"$WORLD_ID","hunger":100,"money":200}` |
| `block X Y` | `map:setTileBlocked` | `{"worldId":"$WORLD_ID","x":X,"y":Y,"blocked":true}` |
| `unblock X Y` | `map:setTileBlocked` | `{"worldId":"$WORLD_ID","x":X,"y":Y,"blocked":false}` |
| `building-collision` | `map:setBuildingCollision` | `{"worldId":"$WORLD_ID","x":X,"y":Y,"blocked":true}` |

**All commands run from:** `cd /Users/subway/code/python/项目/openclaw/ai-town`

**Format:** Always use `npx convex run --no-push <function> '<json_args>'`

**Note:** `perceiveRoom` is a public query — run via `npx convex run --no-push scene:perceiveRoom`.

## Editor Workflow

To create a new interior scene using the level editor:

```bash
# 1. Launch the editor
npm run le
# Opens at http://localhost:5174

# 2. In the editor:
#    - Set canvas to small room size (e.g. 10x8 tiles)
#    - Load a tileset (gentle-obj.png or CuteRPG interior tiles)
#    - Draw floor on layer 0, walls on object layer
#    - Press 's' to export map.js

# 3. Import the exported map into DB
/map scene import my_room "My Room"
# (reads the map.js file and passes it as mapData)

# 4. Add furniture programmatically
/map furniture add my_room "Table" interact 4 3 --action sit
/map furniture add my_room "Bookshelf" decor 1 1 --w 3 --h 2

# 5. Link to a POI
/map poi update my_poi --sceneName my_room
```

## Furniture Types

| Type | Purpose | Example |
|------|---------|---------|
| `interact` | Agent can do action here | Counter (buy_food), Desk (work) |
| `decor` | Visual only, no action | Chair, Shelf, Painting |
| `blocked` | Impassable obstacle | Crate, Barrel, Wall |

## Furniture Actions

| Action | What it does |
|--------|-------------|
| `buy_food` | Agent buys food (costs money, restores hunger) |
| `work` | Agent works (earns money, takes time) |
| `sit` | Agent sits (cosmetic) |
| `sleep` | Agent sleeps (future: restore energy) |

## Output Format

Present results as clean tables. For `status`:
```
| Agent   | Hunger | Money | Tokens  | Activity          |
|---------|--------|-------|---------|-------------------|
| Lucky   |   45   |   30  | 52,341  | heading to shop   |
```

For `furniture list`:
```
| ID       | Name           | Type     | Pos   | Action   |
|----------|----------------|----------|-------|----------|
| shelf_1  | Display Shelf  | decor    | (1,1) | -        |
| counter  | Shop Counter   | interact | (2,4) | buy_food |
```

$ARGUMENTS
