/**
 * Convex integration for the AI Town level editor.
 * Uses ConvexHttpClient to save/load scenes directly to/from the database.
 */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import { g_ctx } from './lecontext.js';
import * as FURNITURE from './lefurniture.js';
import * as MAPFILE from './mapfile.js';

let client = null;

// ─── Init ────────────────────────────────────────────────

export function initClient() {
  // Try env var first, then .env.local via Vite
  const url = g_ctx.convexUrl || import.meta.env.VITE_CONVEX_URL;
  if (!url) {
    console.warn('No Convex URL configured');
    return false;
  }
  try {
    client = new ConvexHttpClient(url);
    console.log('Convex client connected to:', url);
    return true;
  } catch (e) {
    console.error('Failed to create Convex client:', e);
    return false;
  }
}

function ensureClient() {
  if (!client) {
    if (!initClient()) {
      throw new Error('Convex client not initialized. Set World ID first.');
    }
  }
  return client;
}

// ─── Scene Operations ────────────────────────────────────

export async function listScenes(worldId) {
  const c = ensureClient();
  return await c.query(api.scene.listScenes, { worldId });
}

export async function loadScene(worldId, sceneName) {
  const c = ensureClient();
  return await c.query(api.scene.getScene, { worldId, name: sceneName });
}

export async function saveScene(worldId) {
  const c = ensureClient();

  if (!g_ctx.sceneName) {
    throw new Error('Scene name is required');
  }

  // Build tilemap data from editor state
  const mapData = MAPFILE.generate_scene_data();

  // Sync furniture collision before save
  FURNITURE.syncCollision();

  const result = await c.mutation(api.scene.importFromEditor, {
    worldId,
    name: g_ctx.sceneName,
    displayName: g_ctx.sceneDisplayName || g_ctx.sceneName,
    mapData,
    furniture: FURNITURE.serializeFurniture(),
    spawnPoint: g_ctx.spawnPoint || { x: Math.floor(g_ctx.sceneWidth / 2), y: g_ctx.sceneHeight - 2 },
    exitPoint: g_ctx.exitPoint || { x: Math.floor(g_ctx.sceneWidth / 2), y: g_ctx.sceneHeight - 1 },
  });

  console.log('Scene saved:', result);
  return result;
}

export async function getDefaultWorld() {
  const c = ensureClient();
  return await c.query(api.world.defaultWorldStatus, {});
}

// ─── Load Into Editor ────────────────────────────────────

export function loadSceneIntoEditor(scene) {
  // Set metadata
  g_ctx.sceneName = scene.name;
  g_ctx.sceneDisplayName = scene.displayName;
  g_ctx.sceneWidth = scene.width;
  g_ctx.sceneHeight = scene.height;
  g_ctx.spawnPoint = scene.spawnPoint;
  g_ctx.exitPoint = scene.exitPoint;
  g_ctx.sceneMode = true;

  // Update UI inputs
  const nameInput = document.getElementById('scene-name');
  const displayInput = document.getElementById('scene-display');
  const spawnDisplay = document.getElementById('spawn-display');
  const exitDisplay = document.getElementById('exit-display');
  if (nameInput) nameInput.value = scene.name;
  if (displayInput) displayInput.value = scene.displayName;
  if (spawnDisplay) spawnDisplay.textContent = scene.spawnPoint ? `(${scene.spawnPoint.x}, ${scene.spawnPoint.y})` : 'not set';
  if (exitDisplay) exitDisplay.textContent = scene.exitPoint ? `(${scene.exitPoint.x}, ${scene.exitPoint.y})` : 'not set';

  // Load tilemap into layers (use existing level load mechanism)
  // The scene data matches the mapfile format
  if (scene.bgTiles && scene.bgTiles.length > 0) {
    loadTilesIntoLayer(0, scene.bgTiles[0]);
    if (scene.bgTiles[1]) loadTilesIntoLayer(1, scene.bgTiles[1]);
  }
  if (scene.objectTiles && scene.objectTiles.length > 0) {
    loadTilesIntoLayer(2, scene.objectTiles[0]);
    if (scene.objectTiles[1]) loadTilesIntoLayer(3, scene.objectTiles[1]);
  }

  // Load furniture
  FURNITURE.deserializeFurniture(scene.furniture);

  updateStatusBar();
  console.log('Scene loaded into editor:', scene.name);
}

function loadTilesIntoLayer(layerNum, tileArray) {
  const layer = g_ctx.g_layers[layerNum];
  if (!layer || !tileArray) return;

  const dim = g_ctx.tiledimx;
  // tileArray is [x][y] format
  for (let x = 0; x < tileArray.length; x++) {
    for (let y = 0; y < tileArray[x].length; y++) {
      const tileIndex = tileArray[x][y];
      if (tileIndex >= 0) {
        layer.addTileLevelPx(x * dim, y * dim, tileIndex);
      }
    }
  }
}

// ─── Validation ──────────────────────────────────────────

export function validateScene() {
  const errors = [];
  const warnings = [];

  // 1. Scene metadata
  if (!g_ctx.sceneName) errors.push('Scene name is required');
  if (!g_ctx.sceneDisplayName) warnings.push('Display name not set');

  // 2. Spawn point
  if (!g_ctx.spawnPoint) {
    errors.push('No spawn point set (press P to place)');
  } else if (isTileBlocked(g_ctx.spawnPoint.x, g_ctx.spawnPoint.y)) {
    errors.push(`Spawn point (${g_ctx.spawnPoint.x},${g_ctx.spawnPoint.y}) is on a blocked tile`);
  }

  // 3. Exit point
  if (!g_ctx.exitPoint) {
    errors.push('No exit point set (press E to place)');
  } else if (isTileBlocked(g_ctx.exitPoint.x, g_ctx.exitPoint.y)) {
    errors.push(`Exit point (${g_ctx.exitPoint.x},${g_ctx.exitPoint.y}) is on a blocked tile`);
  }

  // 4. Furniture bounds
  for (const f of g_ctx.furniture) {
    const fw = f.w || 1;
    const fh = f.h || 1;
    if (f.x < 0 || f.y < 0 || f.x + fw > g_ctx.sceneWidth || f.y + fh > g_ctx.sceneHeight) {
      errors.push(`"${f.name}" (${f.x},${f.y}) is out of scene bounds`);
    }
  }

  // 5. Interact furniture must have adjacent walkable tile
  for (const f of g_ctx.furniture) {
    if (!f.action) continue;
    const fw = f.w || 1;
    const fh = f.h || 1;
    let hasWalkableNeighbor = false;
    // Check all tiles around the furniture
    for (let dx = -1; dx <= fw; dx++) {
      for (let dy = -1; dy <= fh; dy++) {
        if (dx >= 0 && dx < fw && dy >= 0 && dy < fh) continue; // skip furniture tiles
        const nx = f.x + dx;
        const ny = f.y + dy;
        if (nx >= 0 && ny >= 0 && nx < g_ctx.sceneWidth && ny < g_ctx.sceneHeight) {
          if (!isTileBlocked(nx, ny)) {
            hasWalkableNeighbor = true;
            break;
          }
        }
      }
      if (hasWalkableNeighbor) break;
    }
    if (!hasWalkableNeighbor) {
      warnings.push(`"${f.name}" (action: ${f.action}) has no adjacent walkable tile — agents can't reach it`);
    }
  }

  // 6. Path from spawn to exit (simplified BFS)
  if (g_ctx.spawnPoint && g_ctx.exitPoint) {
    if (!pathExists(g_ctx.spawnPoint, g_ctx.exitPoint)) {
      errors.push('No walkable path from spawn to exit!');
    }
  }

  return { errors, warnings };
}

function isTileBlocked(x, y) {
  if (x < 0 || y < 0 || x >= g_ctx.sceneWidth || y >= g_ctx.sceneHeight) return true;
  // Check collision layers
  const dim = g_ctx.tiledimx;
  for (const layerNum of [2, 3]) {
    const layer = g_ctx.g_layers[layerNum];
    if (!layer) continue;
    for (const child of layer.container.children) {
      if (child === layer.mouseshadow || child === layer.square) continue;
      const cx = Math.floor(child.x / dim);
      const cy = Math.floor(child.y / dim);
      if (cx === x && cy === y) return true;
    }
  }
  // Check blocked furniture
  for (const f of g_ctx.furniture) {
    if (f.type !== 'blocked') continue;
    const fw = f.w || 1;
    const fh = f.h || 1;
    if (x >= f.x && x < f.x + fw && y >= f.y && y < f.y + fh) return true;
  }
  return false;
}

function pathExists(start, end) {
  // BFS pathfinding
  const visited = new Set();
  const queue = [{ x: start.x, y: start.y }];
  const key = (x, y) => `${x},${y}`;
  visited.add(key(start.x, start.y));

  while (queue.length > 0) {
    const { x, y } = queue.shift();
    if (x === end.x && y === end.y) return true;

    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = key(nx, ny);
      if (visited.has(k)) continue;
      if (nx < 0 || ny < 0 || nx >= g_ctx.sceneWidth || ny >= g_ctx.sceneHeight) continue;
      if (isTileBlocked(nx, ny)) continue;
      visited.add(k);
      queue.push({ x: nx, y: ny });
    }
  }
  return false;
}

// ─── UI Helpers ──────────────────────────────────────────

function updateStatusBar() {
  const mode = document.getElementById('status-mode');
  const scene = document.getElementById('status-scene');
  if (mode) mode.textContent = g_ctx.sceneMode ? 'Mode: Scene' : 'Mode: Map';
  if (scene) scene.textContent = g_ctx.sceneName ? `Scene: ${g_ctx.sceneName} (${g_ctx.sceneWidth}x${g_ctx.sceneHeight})` : 'Scene: -';
}
