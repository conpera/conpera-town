/**
 * Furniture management module for the AI Town level editor.
 *
 * Furniture items are a data layer on top of the tilemap.
 * They render as colored rectangles with labels on the composite view.
 * Type 'blocked' furniture auto-syncs with the collision layer.
 */

import * as PIXI from 'pixi.js';
import { g_ctx } from './lecontext.js';

// ─── Templates ───────────────────────────────────────────

export const FURNITURE_TEMPLATES = {
  counter:   { name: 'Counter',   type: 'interact', w: 2, h: 1, action: 'buy_food', color: 0x4488ff },
  forge:     { name: 'Forge',     type: 'interact', w: 2, h: 2, action: 'work',     color: 0xff6644 },
  desk:      { name: 'Work Desk', type: 'interact', w: 2, h: 1, action: 'work',     color: 0xdd8833 },
  shelf:     { name: 'Shelf',     type: 'decor',    w: 2, h: 1, action: null,        color: 0x8b6914 },
  chair:     { name: 'Chair',     type: 'decor',    w: 1, h: 1, action: null,        color: 0x886644 },
  bookshelf: { name: 'Bookshelf', type: 'decor',    w: 1, h: 2, action: null,        color: 0x664422 },
  plant:     { name: 'Plant',     type: 'decor',    w: 1, h: 1, action: null,        color: 0x44aa44 },
  crate:     { name: 'Crate',     type: 'blocked',  w: 1, h: 1, action: null,        color: 0x888888 },
  table:     { name: 'Table',     type: 'blocked',  w: 2, h: 1, action: null,        color: 0x996633 },
  bed:       { name: 'Bed',       type: 'blocked',  w: 1, h: 2, action: null,        color: 0xcc4444 },
  barrel:    { name: 'Barrel',    type: 'blocked',  w: 1, h: 1, action: null,        color: 0x775533 },
};

// ─── State ───────────────────────────────────────────────

let furnitureContainer = null;  // PIXI Container on composite
let nextId = 1;

// ─── Init ────────────────────────────────────────────────

export function initFurnitureLayer() {
  if (!g_ctx.composite) return;
  furnitureContainer = new PIXI.Container();
  furnitureContainer.zIndex = 900;
  furnitureContainer.sortableChildren = true;
  g_ctx.composite.container.addChild(furnitureContainer);
}

// ─── CRUD ────────────────────────────────────────────────

export function addFurnitureItem(templateKey, tileX, tileY) {
  const tmpl = FURNITURE_TEMPLATES[templateKey];
  if (!tmpl) {
    console.warn('Unknown furniture template:', templateKey);
    return null;
  }

  // Bounds check
  if (g_ctx.sceneMode) {
    if (tileX + tmpl.w > g_ctx.sceneWidth || tileY + tmpl.h > g_ctx.sceneHeight) {
      console.warn('Furniture out of scene bounds');
      return null;
    }
  }

  const item = {
    id: `furn_${nextId++}`,
    name: tmpl.name,
    type: tmpl.type,
    x: tileX,
    y: tileY,
    w: tmpl.w,
    h: tmpl.h,
    action: tmpl.action,
    config: null,
    _color: tmpl.color,
  };
  g_ctx.furniture.push(item);
  renderAll();
  updatePlacedList();
  return item;
}

export function addCustomFurniture(name, type, action, w, h, tileX, tileY) {
  const colors = { interact: 0x4488ff, decor: 0x8b6914, blocked: 0x888888 };
  const item = {
    id: `furn_${nextId++}`,
    name: name || 'Custom',
    type: type || 'decor',
    x: tileX,
    y: tileY,
    w: w || 1,
    h: h || 1,
    action: action || null,
    config: null,
    _color: colors[type] || 0xcccccc,
  };
  g_ctx.furniture.push(item);
  renderAll();
  updatePlacedList();
  return item;
}

export function removeFurnitureItem(id) {
  g_ctx.furniture = g_ctx.furniture.filter((f) => f.id !== id);
  renderAll();
  updatePlacedList();
}

export function moveFurnitureItem(id, newX, newY) {
  const item = g_ctx.furniture.find((f) => f.id === id);
  if (item) {
    item.x = newX;
    item.y = newY;
    renderAll();
    updatePlacedList();
  }
}

export function getFurnitureAt(tileX, tileY) {
  return g_ctx.furniture.find((f) => {
    const fw = f.w || 1;
    const fh = f.h || 1;
    return tileX >= f.x && tileX < f.x + fw && tileY >= f.y && tileY < f.y + fh;
  });
}

// ─── Rendering ───────────────────────────────────────────

export function renderAll() {
  if (!furnitureContainer) return;
  furnitureContainer.removeChildren();

  const dim = g_ctx.tiledimx;

  for (const item of g_ctx.furniture) {
    const px = item.x * dim;
    const py = item.y * dim;
    const pw = (item.w || 1) * dim;
    const ph = (item.h || 1) * dim;
    const color = item._color || 0xcccccc;

    // Filled rect
    const g = new PIXI.Graphics();
    g.beginFill(color, 0.45);
    g.lineStyle(2, 0xffffff, 0.7);
    g.drawRect(px, py, pw, ph);
    g.endFill();

    // Type indicator border color
    const typeColors = { interact: 0x4488ff, decor: 0x8b6914, blocked: 0xff4444 };
    g.lineStyle(1, typeColors[item.type] || 0xffffff, 0.9);
    g.drawRect(px + 2, py + 2, pw - 4, ph - 4);

    furnitureContainer.addChild(g);

    // Name label
    const nameText = new PIXI.Text(item.name, {
      fontSize: Math.min(10, dim * 0.35),
      fill: 0xffffff,
      fontWeight: 'bold',
    });
    nameText.x = px + 3;
    nameText.y = py + 2;
    furnitureContainer.addChild(nameText);

    // Action label
    if (item.action) {
      const actionText = new PIXI.Text(item.action, {
        fontSize: Math.min(8, dim * 0.25),
        fill: 0xffff44,
      });
      actionText.x = px + 3;
      actionText.y = py + ph - 12;
      furnitureContainer.addChild(actionText);
    }
  }

  // Spawn point marker
  if (g_ctx.spawnPoint) {
    const sp = new PIXI.Graphics();
    sp.beginFill(0x00ff88, 0.6);
    sp.drawCircle(g_ctx.spawnPoint.x * dim + dim / 2, g_ctx.spawnPoint.y * dim + dim / 2, dim * 0.35);
    sp.endFill();
    furnitureContainer.addChild(sp);
    const st = new PIXI.Text('S', { fontSize: 10, fill: 0xffffff, fontWeight: 'bold' });
    st.x = g_ctx.spawnPoint.x * dim + dim / 2 - 4;
    st.y = g_ctx.spawnPoint.y * dim + dim / 2 - 6;
    furnitureContainer.addChild(st);
  }

  // Exit point marker
  if (g_ctx.exitPoint) {
    const ep = new PIXI.Graphics();
    ep.beginFill(0xff4444, 0.6);
    ep.drawCircle(g_ctx.exitPoint.x * dim + dim / 2, g_ctx.exitPoint.y * dim + dim / 2, dim * 0.35);
    ep.endFill();
    furnitureContainer.addChild(ep);
    const et = new PIXI.Text('E', { fontSize: 10, fill: 0xffffff, fontWeight: 'bold' });
    et.x = g_ctx.exitPoint.x * dim + dim / 2 - 4;
    et.y = g_ctx.exitPoint.y * dim + dim / 2 - 6;
    furnitureContainer.addChild(et);
  }

  // Scene boundary
  if (g_ctx.sceneMode) {
    const boundary = new PIXI.Graphics();
    boundary.lineStyle(2, 0xe94560, 0.8);
    boundary.drawRect(0, 0, g_ctx.sceneWidth * dim, g_ctx.sceneHeight * dim);
    furnitureContainer.addChild(boundary);
  }
}

// ─── Collision Sync ──────────────────────────────────────

export function syncCollision() {
  // For each 'blocked' furniture, mark objectTiles on layer 2
  // This is called before save to ensure collision consistency
  if (!g_ctx.g_layers || g_ctx.g_layers.length < 3) return;

  const objLayer = g_ctx.g_layers[2]; // collision layer 0
  const dim = g_ctx.tiledimx;

  for (const item of g_ctx.furniture) {
    if (item.type !== 'blocked') continue;
    const fw = item.w || 1;
    const fh = item.h || 1;
    for (let dx = 0; dx < fw; dx++) {
      for (let dy = 0; dy < fh; dy++) {
        const px = (item.x + dx) * dim;
        const py = (item.y + dy) * dim;
        // Add a collision tile (index 367) at this position
        objLayer.addTileLevelPx(px, py, 367);
      }
    }
  }
}

// ─── Collision Overlay ───────────────────────────────────

let collisionOverlayContainer = null;

export function drawCollisionOverlay() {
  if (!g_ctx.composite) return;

  // Remove existing overlay
  if (collisionOverlayContainer) {
    g_ctx.composite.container.removeChild(collisionOverlayContainer);
    collisionOverlayContainer = null;
  }

  if (!g_ctx.collisionOverlay) return;

  collisionOverlayContainer = new PIXI.Container();
  collisionOverlayContainer.zIndex = 800;

  const dim = g_ctx.tiledimx;
  const maxW = g_ctx.sceneMode ? g_ctx.sceneWidth : Math.ceil(1600 / dim);
  const maxH = g_ctx.sceneMode ? g_ctx.sceneHeight : Math.ceil(1600 / dim);

  // Check obj layers for blocked tiles
  const objLayers = [g_ctx.g_layers[2], g_ctx.g_layers[3]];

  for (let x = 0; x < maxW; x++) {
    for (let y = 0; y < maxH; y++) {
      let blocked = false;
      for (const layer of objLayers) {
        if (!layer) continue;
        // Check if sprite exists at this position
        for (const child of layer.container.children) {
          if (child === layer.mouseshadow || child === layer.square) continue;
          const cx = Math.floor(child.x / dim);
          const cy = Math.floor(child.y / dim);
          if (cx === x && cy === y) {
            blocked = true;
            break;
          }
        }
        if (blocked) break;
      }

      const g = new PIXI.Graphics();
      if (blocked) {
        g.beginFill(0xff0000, 0.25);
      } else {
        g.beginFill(0x00ff00, 0.08);
      }
      g.drawRect(x * dim, y * dim, dim, dim);
      g.endFill();
      collisionOverlayContainer.addChild(g);
    }
  }

  g_ctx.composite.container.addChild(collisionOverlayContainer);
}

// ─── Serialization ───────────────────────────────────────

export function serializeFurniture() {
  return g_ctx.furniture.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    x: f.x,
    y: f.y,
    w: f.w,
    h: f.h,
    action: f.action,
    config: f.config,
  }));
}

export function deserializeFurniture(arr) {
  if (!arr || !Array.isArray(arr)) return;
  g_ctx.furniture = arr.map((f) => {
    const colors = { interact: 0x4488ff, decor: 0x8b6914, blocked: 0x888888 };
    return { ...f, _color: colors[f.type] || 0xcccccc };
  });
  nextId = Math.max(nextId, ...g_ctx.furniture.map((f) => {
    const m = f.id?.match(/furn_(\d+)/);
    return m ? parseInt(m[1]) + 1 : 1;
  }), 1);
  renderAll();
  updatePlacedList();
}

// ─── UI Helpers ──────────────────────────────────────────

function updatePlacedList() {
  const el = document.getElementById('placed-furniture-list');
  if (!el) return;
  if (g_ctx.furniture.length === 0) {
    el.innerHTML = '<em>No furniture placed</em>';
    return;
  }
  el.innerHTML = g_ctx.furniture.map((f) =>
    `<div style="margin:2px 0;">
      <span style="color:${f.type === 'interact' ? '#4488ff' : f.type === 'blocked' ? '#ff4444' : '#8b6914'}">
        [${f.type}]
      </span>
      <strong>${f.name}</strong> (${f.x},${f.y})
      ${f.action ? `→ ${f.action}` : ''}
      <button onclick="window._removeFurniture('${f.id}')" style="font-size:10px;padding:1px 4px;">x</button>
    </div>`
  ).join('');
}

// Expose remove to HTML onclick
window._removeFurniture = function (id) {
  removeFurnitureItem(id);
};
