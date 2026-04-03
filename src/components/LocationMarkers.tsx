import { useCallback } from 'react';
import { Container, Graphics, Sprite, Text } from '@pixi/react';
import { Graphics as PixiGraphics, TextStyle, Texture } from 'pixi.js';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { SHOP_POSITION, WORKPLACE_POSITION } from '../../convex/constants';

const BUILDING_WIDTH = 160;
const BUILDING_HEIGHT = 256;

function BuildingMarker({
  position,
  label,
  labelColor,
  textureUrl,
  tileDim,
}: {
  position: { x: number; y: number };
  label: string;
  labelColor: string;
  textureUrl: string;
  tileDim: number;
}) {
  const buildingScale = (tileDim * 3) / BUILDING_WIDTH;
  const x = (position.x - 0.5) * tileDim;
  const y = (position.y - 3) * tileDim;
  const labelX = (position.x + 0.5) * tileDim;
  const labelY = (position.y + 1.2) * tileDim;

  const labelStyle = new TextStyle({
    fontSize: 11,
    fill: 0xffffff,
    fontWeight: 'bold',
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowDistance: 1,
    dropShadowBlur: 2,
    align: 'center',
  });

  const numColor = parseInt(labelColor.replace('#', ''), 16) || 0x666666;

  const drawShadow = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      const cx = (position.x + 0.5) * tileDim;
      const cy = (position.y + 0.3) * tileDim;
      g.beginFill(0x000000, 0.15);
      g.drawEllipse(cx, cy, tileDim * 1.5, tileDim * 0.4);
      g.endFill();
    },
    [position, tileDim],
  );

  const drawLabelBg = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      const w = label.length * 7 + 12;
      g.beginFill(numColor, 0.85);
      g.drawRoundedRect(labelX - w / 2, labelY - 2, w, 16, 4);
      g.endFill();
    },
    [labelX, labelY, label, numColor],
  );

  return (
    <Container sortableChildren>
      <Graphics draw={drawShadow} zIndex={0} />
      <Sprite
        texture={Texture.from(textureUrl)}
        x={x}
        y={y}
        width={BUILDING_WIDTH * buildingScale}
        height={BUILDING_HEIGHT * buildingScale}
        zIndex={1}
      />
      <Graphics draw={drawLabelBg} zIndex={2} />
      <Text
        text={label}
        style={labelStyle}
        x={labelX - label.length * 3.5}
        y={labelY}
        zIndex={3}
      />
    </Container>
  );
}

// Fallback POIs when DB has none yet
const FALLBACK_POIS = [
  {
    name: 'shop',
    label: 'SHOP',
    position: SHOP_POSITION,
    spriteUrl: '/ai-town/assets/shop.png',
    labelColor: '#cc6600',
  },
  {
    name: 'workplace',
    label: 'WORK',
    position: WORKPLACE_POSITION,
    spriteUrl: '/ai-town/assets/workplace.png',
    labelColor: '#336633',
  },
];

export function LocationMarkers({
  worldId,
  tileDim,
}: {
  worldId: Id<'worlds'>;
  tileDim: number;
}) {
  const pois = useQuery(api.map.listPOI, { worldId });
  const markers = pois && pois.length > 0 ? pois : FALLBACK_POIS;

  return (
    <Container sortableChildren>
      {markers.map((poi) =>
        poi.spriteUrl ? (
          <BuildingMarker
            key={poi.name}
            position={poi.position}
            label={poi.label}
            labelColor={poi.labelColor ?? '#666666'}
            textureUrl={poi.spriteUrl}
            tileDim={tileDim}
          />
        ) : null,
      )}
    </Container>
  );
}
