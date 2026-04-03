import { useCallback } from 'react';
import { Container, Graphics, Sprite, Text } from '@pixi/react';
import { Graphics as PixiGraphics, TextStyle, Texture } from 'pixi.js';
import { SHOP_POSITION, WORKPLACE_POSITION } from '../../convex/constants';

// Building sprite dimensions (pixels in source image)
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
  labelColor: number;
  textureUrl: string;
  tileDim: number;
}) {
  // Center the building on the tile position
  // Scale building to ~3x3 tiles
  const buildingScale = (tileDim * 3) / BUILDING_WIDTH;
  const x = (position.x - 0.5) * tileDim;
  const y = (position.y - 3) * tileDim; // offset up so door is at position

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

  // Draw a subtle ground shadow
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

  // Draw label background
  const drawLabelBg = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      const w = label.length * 7 + 12;
      g.beginFill(labelColor, 0.85);
      g.drawRoundedRect(labelX - w / 2, labelY - 2, w, 16, 4);
      g.endFill();
    },
    [labelX, labelY, label, labelColor],
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
        x={labelX - (label.length * 3.5)}
        y={labelY}
        zIndex={3}
      />
    </Container>
  );
}

export function LocationMarkers({ tileDim }: { tileDim: number }) {
  return (
    <Container sortableChildren>
      <BuildingMarker
        position={SHOP_POSITION}
        label="SHOP"
        labelColor={0xcc6600}
        textureUrl="/ai-town/assets/shop.png"
        tileDim={tileDim}
      />
      <BuildingMarker
        position={WORKPLACE_POSITION}
        label="WORK"
        labelColor={0x336633}
        textureUrl="/ai-town/assets/workplace.png"
        tileDim={tileDim}
      />
    </Container>
  );
}
