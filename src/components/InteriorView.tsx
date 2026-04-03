import { useCallback, useMemo } from 'react';
import { Container, Graphics, Sprite, Text } from '@pixi/react';
import { Graphics as PixiGraphics, TextStyle, Texture } from 'pixi.js';
import { Player as ServerPlayer } from '../../convex/aiTown/player';
import { Character } from './Character';
import { characters } from '../../data/characters';
import { GameId } from '../../convex/aiTown/ids';
import { PlayerDescription } from '../../convex/aiTown/playerDescription';
import { INTERACTION_DISTANCE } from '../../convex/constants';
import { distance } from '../../convex/util/geometry';
import { SelectElement } from './Player';

const INTERIOR_IMAGES: Record<string, string> = {
  shop: '/ai-town/assets/shop_interior.png',
  workplace: '/ai-town/assets/work_interior.png',
};

const ROOM_TILES_W = 10;
const ROOM_TILES_H = 8;
const TILE_PX = 32;

// Interior labels
const BUILDING_LABELS: Record<string, { title: string; emoji: string }> = {
  shop: { title: 'General Store', emoji: '🏪' },
  workplace: { title: 'Workshop', emoji: '🏢' },
};

export function InteriorView({
  buildingName,
  buildingPosition,
  screenWidth,
  screenHeight,
  players,
  playerDescriptions,
  onExit,
  onClickPlayer,
}: {
  buildingName: string;
  buildingPosition: { x: number; y: number };
  screenWidth: number;
  screenHeight: number;
  players: ServerPlayer[];
  playerDescriptions: Map<GameId<'players'>, PlayerDescription>;
  onExit: () => void;
  onClickPlayer: SelectElement;
}) {
  const interiorImg = INTERIOR_IMAGES[buildingName];
  const label = BUILDING_LABELS[buildingName] ?? { title: buildingName, emoji: '📍' };

  // Scale interior to fit the viewport
  const roomW = ROOM_TILES_W * TILE_PX;
  const roomH = ROOM_TILES_H * TILE_PX;
  const scale = Math.min(
    (screenWidth * 0.85) / roomW,
    (screenHeight * 0.75) / roomH,
  );
  const scaledW = roomW * scale;
  const scaledH = roomH * scale;
  const offsetX = (screenWidth - scaledW) / 2;
  const offsetY = (screenHeight - scaledH) / 2 + 20;

  // Find agents near this building
  const nearbyPlayers = useMemo(() => {
    return players.filter(
      (p) => distance(p.position, buildingPosition) < INTERACTION_DISTANCE * 3,
    );
  }, [players, buildingPosition]);

  // Dark overlay background
  const drawBg = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      g.beginFill(0x000000, 0.75);
      g.drawRect(0, 0, screenWidth, screenHeight);
      g.endFill();
    },
    [screenWidth, screenHeight],
  );

  // Room border glow
  const drawBorder = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      // Shadow
      g.beginFill(0x000000, 0.4);
      g.drawRoundedRect(offsetX - 6, offsetY - 6, scaledW + 12, scaledH + 12, 8);
      g.endFill();
      // Border
      g.lineStyle(3, 0x8b6914, 1);
      g.drawRoundedRect(offsetX - 2, offsetY - 2, scaledW + 4, scaledH + 4, 4);
    },
    [offsetX, offsetY, scaledW, scaledH],
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
    fontSize: 18,
    fill: 0xffffff,
    fontWeight: 'bold',
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowDistance: 2,
  });

  const exitStyle = new TextStyle({
    fontSize: 12,
    fill: 0xffffff,
    fontWeight: 'bold',
  });

  const nameStyle = new TextStyle({
    fontSize: 9 * scale,
    fill: 0xffffff,
    fontWeight: 'bold',
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowDistance: 1,
  });

  return (
    <Container sortableChildren>
      {/* Dark overlay — click to exit */}
      <Graphics draw={drawBg} zIndex={100} interactive pointerdown={onExit} />

      {/* Title */}
      <Text
        text={`${label.emoji} ${label.title}`}
        style={titleStyle}
        x={offsetX}
        y={offsetY - 35}
        zIndex={103}
      />

      {/* Room border */}
      <Graphics draw={drawBorder} zIndex={101} />

      {/* Interior image */}
      {interiorImg && (
        <Sprite
          texture={Texture.from(interiorImg)}
          x={offsetX}
          y={offsetY}
          width={scaledW}
          height={scaledH}
          zIndex={102}
        />
      )}

      {/* Exit button */}
      <Graphics draw={drawExitBtn} zIndex={103} interactive pointerdown={onExit} cursor="pointer" />
      <Text
        text="← Exit"
        style={exitStyle}
        x={exitBtnX + 12}
        y={exitBtnY + 5}
        zIndex={104}
        interactive
        pointerdown={onExit}
        cursor="pointer"
      />

      {/* Agents inside the building */}
      {nearbyPlayers.map((player, i) => {
        const desc = playerDescriptions.get(player.id);
        const charData = desc && characters.find((c) => c.name === desc.character);
        // Position agents in the room walkable area (y: 3-6, x: 2-7)
        const agentX = offsetX + (2 + (i % 6)) * TILE_PX * scale;
        const agentY = offsetY + (3 + Math.floor(i / 6)) * TILE_PX * scale;
        const agentScale = scale * 1.2;

        return (
          <Container
            key={player.id}
            x={agentX}
            y={agentY}
            zIndex={103}
            interactive
            pointerdown={() => onClickPlayer({ kind: 'player', id: player.id })}
            cursor="pointer"
          >
            {charData && (
              <Sprite
                texture={Texture.from(charData.textureUrl)}
                width={32 * agentScale}
                height={32 * agentScale}
                anchor={{ x: 0.5, y: 0.5 }}
              />
            )}
            {desc && (
              <Text
                text={desc.name}
                style={nameStyle}
                x={0}
                y={16 * agentScale}
                anchor={{ x: 0.5, y: 0 }}
              />
            )}
          </Container>
        );
      })}
    </Container>
  );
}
