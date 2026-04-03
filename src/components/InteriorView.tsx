import { useCallback, useMemo } from 'react';
import { Container, Graphics, Sprite, Text } from '@pixi/react';
import { Graphics as PixiGraphics, TextStyle, Texture } from 'pixi.js';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Player as ServerPlayer } from '../../convex/aiTown/player';
import { GameId } from '../../convex/aiTown/ids';
import { PlayerDescription } from '../../convex/aiTown/playerDescription';
import { INTERACTION_DISTANCE } from '../../convex/constants';
import { distance } from '../../convex/util/geometry';
import { SelectElement } from './Player';

const TILE_PX = 32;

const SCENE_NAME_MAP: Record<string, string> = {
  shop: 'shop_interior',
  workplace: 'workplace_interior',
};

const BUILDING_LABELS: Record<string, { title: string; emoji: string }> = {
  shop: { title: 'General Store', emoji: '🏪' },
  workplace: { title: 'Internet Cafe', emoji: '🏢' },
};

// Colors for furniture types (fallback when no sprite)
const FURN_COLORS: Record<string, number> = {
  interact: 0x4488ff,
  work: 0x4488ff,
  decor: 0x8b6914,
  blocked: 0x666666,
};

// Map furniture names to sprite images
const FURN_SPRITES: Record<string, string> = {
  'Shop Counter': '/ai-town/assets/furniture/counter_long.png',
  'Cash Register': '/ai-town/assets/furniture/computer.png',
  'Product Shelves': '/ai-town/assets/furniture/shelf_grocery.png',
  'Storage Crates': '/ai-town/assets/furniture/crate.png',
  'Storage Barrels': '/ai-town/assets/furniture/barrel.png',
  'Chair': '/ai-town/assets/furniture/chair.png',
  'Potted Plant': '/ai-town/assets/furniture/plant.png',
  'PC Station': '/ai-town/assets/furniture/pc_station.png',
  'Reception': '/ai-town/assets/furniture/reception.png',
  'Vending Machine': '/ai-town/assets/furniture/vending.png',
  'Water Cooler': '/ai-town/assets/furniture/water_cooler.png',
  'Counter': '/ai-town/assets/furniture/counter.png',
  'Shelf': '/ai-town/assets/furniture/shelf_books.png',
  'Bookshelf': '/ai-town/assets/furniture/shelf_books.png',
  'Table': '/ai-town/assets/furniture/table_long.png',
  'Bench': '/ai-town/assets/furniture/bench.png',
  'Bed': '/ai-town/assets/furniture/bed.png',
  'Cabinet': '/ai-town/assets/furniture/cabinet.png',
  'Barrel': '/ai-town/assets/furniture/barrel.png',
  'Crate': '/ai-town/assets/furniture/crate.png',
  'Plant': '/ai-town/assets/furniture/plant.png',
};

// Match by prefix (e.g. "PC Station 1" → "PC Station")
function getFurnSprite(name: string): string | null {
  if (FURN_SPRITES[name]) return FURN_SPRITES[name];
  for (const [key, url] of Object.entries(FURN_SPRITES)) {
    if (name.startsWith(key)) return url;
  }
  return null;
}

// Wall/floor colors
const WALL_COLOR = 0x372319;
const DOOR_COLOR = 0x5a4129;

export function InteriorView({
  worldId,
  buildingName,
  buildingPosition,
  screenWidth,
  screenHeight,
  players,
  playerDescriptions,
  onExit,
  onClickPlayer,
}: {
  worldId: Id<'worlds'>;
  buildingName: string;
  buildingPosition: { x: number; y: number };
  screenWidth: number;
  screenHeight: number;
  players: ServerPlayer[];
  playerDescriptions: Map<GameId<'players'>, PlayerDescription>;
  onExit: () => void;
  onClickPlayer: SelectElement;
}) {
  const sceneName = SCENE_NAME_MAP[buildingName] ?? buildingName;
  const label = BUILDING_LABELS[buildingName] ?? { title: buildingName, emoji: '📍' };

  // Query scene from DB
  const scene = useQuery(api.scene.getScene, { worldId, name: sceneName });

  const roomW = (scene?.width ?? 10) * TILE_PX;
  const roomH = (scene?.height ?? 8) * TILE_PX;
  const scale = Math.min(
    (screenWidth * 0.85) / roomW,
    (screenHeight * 0.75) / roomH,
  );
  const scaledW = roomW * scale;
  const scaledH = roomH * scale;
  const offsetX = (screenWidth - scaledW) / 2;
  const offsetY = (screenHeight - scaledH) / 2 + 20;

  const nearbyPlayers = useMemo(() => {
    return players.filter(
      (p) => distance(p.position, buildingPosition) < INTERACTION_DISTANCE * 3,
    );
  }, [players, buildingPosition]);

  // Dark overlay
  const drawBg = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.beginFill(0x000000, 0.75);
      g.drawRect(0, 0, screenWidth, screenHeight);
      g.endFill();
    },
    [screenWidth, screenHeight],
  );

  // Room border
  const drawBorder = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.beginFill(0x000000, 0.4);
      g.drawRoundedRect(offsetX - 6, offsetY - 6, scaledW + 12, scaledH + 12, 8);
      g.endFill();
      g.lineStyle(3, 0x8b6914, 1);
      g.drawRoundedRect(offsetX - 2, offsetY - 2, scaledW + 4, scaledH + 4, 4);
    },
    [offsetX, offsetY, scaledW, scaledH],
  );

  // Render the room: floor, walls, collision tiles, furniture — all from DB scene data
  const drawRoom = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      if (!scene) return;

      const w = scene.width;
      const h = scene.height;
      const ts = TILE_PX * scale;

      // Floor color based on building type
      const floorColor = buildingName === 'workplace' ? 0x8a7a6a : 0xc4a870;

      // Draw floor
      g.beginFill(floorColor);
      g.drawRect(offsetX, offsetY, w * ts, h * ts);
      g.endFill();

      // Draw collision/wall tiles from objectTiles
      if (scene.objectTiles) {
        for (const layer of scene.objectTiles) {
          for (let x = 0; x < layer.length; x++) {
            for (let y = 0; y < (layer[x]?.length ?? 0); y++) {
              const tileId = layer[x][y];
              if (tileId >= 0) {
                // It's a blocked tile — draw as wall
                const isEdge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
                const isDoor = y === h - 1 && (x === Math.floor(w / 2) - 1 || x === Math.floor(w / 2));
                if (isDoor) {
                  g.beginFill(DOOR_COLOR);
                } else if (isEdge) {
                  g.beginFill(WALL_COLOR);
                } else {
                  // Interior obstacle — slightly lighter
                  g.beginFill(0x554433, 0.7);
                }
                g.drawRect(offsetX + x * ts, offsetY + y * ts, ts, ts);
                g.endFill();
              }
            }
          }
        }
      }

      // Grid lines (subtle)
      g.lineStyle(0.5, 0x000000, 0.08);
      for (let x = 0; x <= w; x++) {
        g.moveTo(offsetX + x * ts, offsetY);
        g.lineTo(offsetX + x * ts, offsetY + h * ts);
      }
      for (let y = 0; y <= h; y++) {
        g.moveTo(offsetX, offsetY + y * ts);
        g.lineTo(offsetX + w * ts, offsetY + y * ts);
      }
    },
    [scene, offsetX, offsetY, scale, buildingName],
  );

  // Draw furniture items from scene DB
  const drawFurniture = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      if (!scene?.furniture) return;

      const ts = TILE_PX * scale;

      for (const f of scene.furniture) {
        const fx = offsetX + f.x * ts;
        const fy = offsetY + f.y * ts;
        const fw = (f.w ?? 1) * ts;
        const fh = (f.h ?? 1) * ts;
        const color = FURN_COLORS[f.type] ?? 0x888888;

        // Fill
        g.beginFill(color, 0.5);
        g.lineStyle(2 * scale, 0xffffff, 0.6);
        g.drawRoundedRect(fx + 1, fy + 1, fw - 2, fh - 2, 3 * scale);
        g.endFill();

        // Type indicator inner border
        const typeColor = f.type === 'blocked' ? 0xff4444 : f.type === 'interact' || f.type === 'work' ? 0x44aaff : 0xaa8833;
        g.lineStyle(1 * scale, typeColor, 0.8);
        g.drawRoundedRect(fx + 3, fy + 3, fw - 6, fh - 6, 2 * scale);
      }

      // Spawn point
      if (scene.spawnPoint) {
        const sx = offsetX + scene.spawnPoint.x * ts + ts / 2;
        const sy = offsetY + scene.spawnPoint.y * ts + ts / 2;
        g.lineStyle(0);
        g.beginFill(0x00ff88, 0.6);
        g.drawCircle(sx, sy, ts * 0.3);
        g.endFill();
      }

      // Exit point
      if (scene.exitPoint) {
        const ex = offsetX + scene.exitPoint.x * ts + ts / 2;
        const ey = offsetY + scene.exitPoint.y * ts + ts / 2;
        g.lineStyle(0);
        g.beginFill(0xff4444, 0.6);
        g.drawCircle(ex, ey, ts * 0.3);
        g.endFill();
      }
    },
    [scene, offsetX, offsetY, scale],
  );

  // Exit button
  const exitBtnX = offsetX + scaledW - 80;
  const exitBtnY = offsetY - 35;
  const drawExitBtn = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.beginFill(0x8b2500, 0.9);
      g.drawRoundedRect(exitBtnX, exitBtnY, 72, 24, 6);
      g.endFill();
      g.lineStyle(1, 0xff6040, 0.8);
      g.drawRoundedRect(exitBtnX, exitBtnY, 72, 24, 6);
    },
    [exitBtnX, exitBtnY],
  );

  const titleStyle = new TextStyle({
    fontSize: 18, fill: 0xffffff, fontWeight: 'bold',
    dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 2,
  });
  const exitStyle = new TextStyle({ fontSize: 12, fill: 0xffffff, fontWeight: 'bold' });
  const furnLabelStyle = new TextStyle({
    fontSize: Math.max(7, 8 * scale), fill: 0xffffff, fontWeight: 'bold',
    dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 1,
  });
  const furnActionStyle = new TextStyle({
    fontSize: Math.max(6, 7 * scale), fill: 0xffff44,
  });
  const nameStyle = new TextStyle({
    fontSize: 9 * scale, fill: 0xffffff, fontWeight: 'bold',
    dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 1,
  });

  const ts = TILE_PX * scale;

  return (
    <Container sortableChildren>
      <Graphics draw={drawBg} zIndex={100} interactive pointerdown={onExit} />

      <Text
        text={`${label.emoji} ${scene?.displayName ?? label.title}`}
        style={titleStyle}
        x={offsetX}
        y={offsetY - 35}
        zIndex={103}
      />

      <Graphics draw={drawBorder} zIndex={101} />

      {/* Room tilemap from DB */}
      <Graphics draw={drawRoom} zIndex={102} />

      {/* Furniture overlay from DB */}
      <Graphics draw={drawFurniture} zIndex={103} />

      {/* Furniture sprites + labels */}
      {scene?.furniture?.map((f: any, i: number) => {
        const spriteUrl = getFurnSprite(f.name);
        const fx = offsetX + f.x * ts;
        const fy = offsetY + f.y * ts;
        const fw = (f.w ?? 1) * ts;
        const fh = (f.h ?? 1) * ts;
        return (
          <Container key={`furn-${i}`} zIndex={104}>
            {spriteUrl && (
              <Sprite
                texture={Texture.from(spriteUrl)}
                x={fx}
                y={fy}
                width={fw}
                height={fh}
              />
            )}
            <Text
              text={f.name}
              style={furnLabelStyle}
              x={fx + 2}
              y={fy + 1}
            />
          </Container>
        );
      })}

      {/* Exit button */}
      <Graphics draw={drawExitBtn} zIndex={105} interactive pointerdown={onExit} cursor="pointer" />
      <Text text="← Exit" style={exitStyle} x={exitBtnX + 12} y={exitBtnY + 5} zIndex={106}
        interactive pointerdown={onExit} cursor="pointer"
      />

      {/* Agents */}
      {nearbyPlayers.map((player, i) => {
        const desc = playerDescriptions.get(player.id);
        const agentX = offsetX + (2 + (i % 6) * 1.2) * ts;
        const agentY = offsetY + (scene ? scene.height - 3 : 5) * ts + Math.floor(i / 6) * 1.5 * ts;
        const r = 10 * scale;
        const colors = [0x4488ff, 0xff6644, 0x44cc66, 0xcc44cc, 0xffaa22];

        const drawAgent = (g: PixiGraphics) => {
          g.clear();
          g.beginFill(colors[i % 5], 0.9);
          g.drawCircle(0, 0, r);
          g.endFill();
          g.lineStyle(2, 0xffffff, 0.8);
          g.drawCircle(0, 0, r);
        };

        return (
          <Container key={player.id} x={agentX} y={agentY} zIndex={105}
            interactive pointerdown={() => onClickPlayer({ kind: 'player', id: player.id })} cursor="pointer"
          >
            <Graphics draw={drawAgent} />
            {desc && (
              <Text text={desc.name} style={nameStyle} x={0} y={r + 4} anchor={{ x: 0.5, y: 0 }} />
            )}
          </Container>
        );
      })}
    </Container>
  );
}
