import { useCallback, useMemo } from 'react';
import { Container, Graphics, Sprite, Text } from '@pixi/react';
import { Graphics as PixiGraphics, TextStyle, Texture, BaseTexture, Rectangle, SCALE_MODES } from 'pixi.js';
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

// Fallback PNG images (used when scene has no valid tilemap data)
const FALLBACK_IMAGES: Record<string, string> = {
  shop: '/ai-town/assets/shop_interior.png',
  workplace: '/ai-town/assets/work_interior.png',
};

/**
 * Create a texture for a specific tile ID from a tileset image.
 * tileId is 0-based. Tileset is laid out in a grid of COLS columns.
 */
function tileTexture(baseTexture: BaseTexture, tileId: number, tileDim: number, cols: number): Texture {
  const gx = tileId % cols;
  const gy = Math.floor(tileId / cols);
  return new Texture(baseTexture, new Rectangle(gx * tileDim, gy * tileDim, tileDim, tileDim));
}

/** Check if a scene has real tilemap data (not all -1) */
function hasValidTilemap(scene: any): boolean {
  if (!scene?.bgTiles?.[0]) return false;
  for (const col of scene.bgTiles[0]) {
    for (const val of col) {
      if (val >= 0) return true;
    }
  }
  return false;
}

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
  const scene = useQuery(api.scene.getScene, { worldId, name: sceneName });
  const fallbackImg = FALLBACK_IMAGES[buildingName];

  const sceneW = scene?.width ?? 10;
  const sceneH = scene?.height ?? 8;
  const roomW = sceneW * TILE_PX;
  const roomH = sceneH * TILE_PX;
  const scale = Math.min((screenWidth * 0.85) / roomW, (screenHeight * 0.75) / roomH);
  const scaledW = roomW * scale;
  const scaledH = roomH * scale;
  const offsetX = (screenWidth - scaledW) / 2;
  const offsetY = (screenHeight - scaledH) / 2 + 20;
  const ts = TILE_PX * scale;

  const usesTilemap = scene && hasValidTilemap(scene);

  // Precompute tile textures for tilemap rendering
  const tileSprites = useMemo(() => {
    if (!usesTilemap || !scene) return [];
    const sprites: Array<{ x: number; y: number; tileId: number }> = [];
    const tileDim = scene.tileDim || 32;
    const tilesetW = scene.tileSetDimX || 512;
    const cols = Math.floor(tilesetW / tileDim);

    // Background layers
    for (const layer of scene.bgTiles || []) {
      for (let x = 0; x < layer.length; x++) {
        for (let y = 0; y < (layer[x]?.length ?? 0); y++) {
          const tid = layer[x][y];
          if (tid >= 0) sprites.push({ x, y, tileId: tid });
        }
      }
    }
    return { sprites, tileDim, cols, tilesetUrl: scene.tileSetUrl };
  }, [usesTilemap, scene]);

  const nearbyPlayers = useMemo(() => {
    return players.filter((p) => distance(p.position, buildingPosition) < INTERACTION_DISTANCE * 3);
  }, [players, buildingPosition]);

  // Dark overlay
  const drawBg = useCallback((g: PixiGraphics) => {
    g.clear();
    g.beginFill(0x000000, 0.75);
    g.drawRect(0, 0, screenWidth, screenHeight);
    g.endFill();
  }, [screenWidth, screenHeight]);

  // Room border
  const drawBorder = useCallback((g: PixiGraphics) => {
    g.clear();
    g.beginFill(0x000000, 0.4);
    g.drawRoundedRect(offsetX - 6, offsetY - 6, scaledW + 12, scaledH + 12, 8);
    g.endFill();
    g.lineStyle(3, 0x8b6914, 1);
    g.drawRoundedRect(offsetX - 2, offsetY - 2, scaledW + 4, scaledH + 4, 4);
  }, [offsetX, offsetY, scaledW, scaledH]);

  // Wall overlay for collision tiles
  const drawWalls = useCallback((g: PixiGraphics) => {
    g.clear();
    if (!scene?.objectTiles) return;
    for (const layer of scene.objectTiles) {
      for (let x = 0; x < layer.length; x++) {
        for (let y = 0; y < (layer[x]?.length ?? 0); y++) {
          if (layer[x][y] >= 0) {
            g.beginFill(0x372319, 0.95);
            g.drawRect(offsetX + x * ts, offsetY + y * ts, ts, ts);
            g.endFill();
          }
        }
      }
    }
    // Door gap overlay (lighter)
    if (scene.exitPoint) {
      g.beginFill(0x5a4129);
      g.drawRect(offsetX + scene.exitPoint.x * ts, offsetY + scene.exitPoint.y * ts, ts, ts);
      g.endFill();
    }
  }, [scene, offsetX, offsetY, ts]);

  // Exit button
  const exitBtnX = offsetX + scaledW - 80;
  const exitBtnY = offsetY - 35;
  const drawExitBtn = useCallback((g: PixiGraphics) => {
    g.clear();
    g.beginFill(0x8b2500, 0.9);
    g.drawRoundedRect(exitBtnX, exitBtnY, 72, 24, 6);
    g.endFill();
    g.lineStyle(1, 0xff6040, 0.8);
    g.drawRoundedRect(exitBtnX, exitBtnY, 72, 24, 6);
  }, [exitBtnX, exitBtnY]);

  const titleStyle = new TextStyle({
    fontSize: 18, fill: 0xffffff, fontWeight: 'bold',
    dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 2,
  });
  const exitStyle = new TextStyle({ fontSize: 12, fill: 0xffffff, fontWeight: 'bold' });
  const nameStyle = new TextStyle({
    fontSize: 9 * scale, fill: 0xffffff, fontWeight: 'bold',
    dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 1,
  });

  return (
    <Container sortableChildren>
      <Graphics draw={drawBg} zIndex={100} interactive pointerdown={onExit} />

      <Text
        text={`${label.emoji} ${scene?.displayName ?? label.title}`}
        style={titleStyle} x={offsetX} y={offsetY - 35} zIndex={106}
      />

      <Graphics draw={drawBorder} zIndex={101} />

      {/* Option A: Real tilemap rendering from DB tile IDs */}
      {usesTilemap && tileSprites && 'sprites' in tileSprites && (
        <Container zIndex={102}>
          {tileSprites.sprites.map((s, i) => (
            <Sprite
              key={i}
              texture={tileTexture(
                BaseTexture.from(tileSprites.tilesetUrl, { scaleMode: SCALE_MODES.NEAREST }),
                s.tileId,
                tileSprites.tileDim,
                tileSprites.cols,
              )}
              x={offsetX + s.x * ts}
              y={offsetY + s.y * ts}
              width={ts}
              height={ts}
            />
          ))}
        </Container>
      )}

      {/* Option B: Fallback to pre-rendered PNG */}
      {!usesTilemap && fallbackImg && (
        <Sprite
          texture={Texture.from(fallbackImg)}
          x={offsetX} y={offsetY}
          width={scaledW} height={scaledH}
          zIndex={102}
        />
      )}

      {/* Walls (collision layer) rendered on top */}
      <Graphics draw={drawWalls} zIndex={103} />

      {/* Exit button */}
      <Graphics draw={drawExitBtn} zIndex={106} interactive pointerdown={onExit} cursor="pointer" />
      <Text text="← Exit" style={exitStyle} x={exitBtnX + 12} y={exitBtnY + 5} zIndex={107}
        interactive pointerdown={onExit} cursor="pointer"
      />

      {/* Agents */}
      {nearbyPlayers.map((player, i) => {
        const desc = playerDescriptions.get(player.id);
        const agentX = offsetX + (2 + (i % 6) * 1.2) * ts;
        const agentY = offsetY + (sceneH - 3) * ts + Math.floor(i / 6) * 1.5 * ts;
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
            {desc && <Text text={desc.name} style={nameStyle} x={0} y={r + 4} anchor={{ x: 0.5, y: 0 }} />}
          </Container>
        );
      })}
    </Container>
  );
}
