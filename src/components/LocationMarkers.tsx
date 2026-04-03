import { useCallback } from 'react';
import { Container, Graphics, Text } from '@pixi/react';
import { Graphics as PixiGraphics, TextStyle } from 'pixi.js';
import { SHOP_POSITION, WORKPLACE_POSITION } from '../../convex/constants';

const MARKER_RADIUS = 12;

function LocationMarker({
  position,
  color,
  emoji,
  label,
  tileDim,
}: {
  position: { x: number; y: number };
  color: number;
  emoji: string;
  label: string;
  tileDim: number;
}) {
  const x = (position.x + 0.5) * tileDim;
  const y = (position.y + 0.5) * tileDim;

  const draw = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      // Outer glow
      g.beginFill(color, 0.2);
      g.drawCircle(x, y, MARKER_RADIUS + 8);
      g.endFill();
      // Inner circle
      g.beginFill(color, 0.6);
      g.drawCircle(x, y, MARKER_RADIUS);
      g.endFill();
      // Border
      g.lineStyle(2, color, 1);
      g.drawCircle(x, y, MARKER_RADIUS);
    },
    [x, y, color],
  );

  const labelStyle = new TextStyle({
    fontSize: 10,
    fill: 0xffffff,
    fontWeight: 'bold',
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowDistance: 1,
  });

  const emojiStyle = new TextStyle({
    fontSize: 14,
  });

  return (
    <Container>
      <Graphics draw={draw} />
      <Text text={emoji} style={emojiStyle} x={x - 7} y={y - 8} />
      <Text text={label} style={labelStyle} x={x - label.length * 3} y={y + MARKER_RADIUS + 2} />
    </Container>
  );
}

export function LocationMarkers({ tileDim }: { tileDim: number }) {
  return (
    <Container>
      <LocationMarker
        position={SHOP_POSITION}
        color={0x00cc00}
        emoji="🏪"
        label="Shop"
        tileDim={tileDim}
      />
      <LocationMarker
        position={WORKPLACE_POSITION}
        color={0x3366ff}
        emoji="🏢"
        label="Work"
        tileDim={tileDim}
      />
    </Container>
  );
}
