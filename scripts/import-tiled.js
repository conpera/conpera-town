#!/usr/bin/env node
/**
 * Import a Tiled JSON map into Convex scene database.
 *
 * Usage:
 *   node scripts/import-tiled.js <tiled.json> <scene-name> <display-name> [world-id]
 *
 * Example:
 *   node scripts/import-tiled.js src/editor/tiled/shop.json shop_interior "General Store" m1740pc6j...
 *
 * The script:
 *   1. Reads the Tiled JSON export
 *   2. Converts tile layers to [x][y] format (matching Convex schema)
 *   3. Extracts object layer as furniture items
 *   4. Calls scene:importFromEditor via npx convex run
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Usage: node scripts/import-tiled.js <tiled.json> <scene-name> <display-name> [world-id]');
  console.log('');
  console.log('If world-id is omitted, fetches default world automatically.');
  process.exit(1);
}

const [jsonPath, sceneName, displayName, worldIdArg] = args;

// Read Tiled JSON
const tiledData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
console.log(`Loaded: ${jsonPath}`);
console.log(`  Size: ${tiledData.width} x ${tiledData.height} tiles`);
console.log(`  Tile size: ${tiledData.tilewidth}x${tiledData.tileheight}`);
console.log(`  Layers: ${tiledData.layers.length}`);

// Find tileset info
let tilesetPath = '/ai-town/assets/gentle-obj.png';
let tilesetPxW = 1440;
let tilesetPxH = 1024;
if (tiledData.tilesets && tiledData.tilesets.length > 0) {
  const ts = tiledData.tilesets[0];
  if (ts.image) {
    // Convert to web-accessible path
    const basename = path.basename(ts.image);
    tilesetPath = `/ai-town/assets/${basename}`;
  }
  if (ts.imagewidth) tilesetPxW = ts.imagewidth;
  if (ts.imageheight) tilesetPxH = ts.imageheight;
  console.log(`  Tileset: ${ts.name || ts.image} (${tilesetPxW}x${tilesetPxH})`);
}

const w = tiledData.width;
const h = tiledData.height;
const tileDim = tiledData.tilewidth;

// Convert Tiled layer data (1D row-major) to [x][y] format
function convertLayer(layerData) {
  const arr = [];
  for (let x = 0; x < w; x++) {
    arr[x] = [];
    for (let y = 0; y < h; y++) {
      // Tiled uses 1-based tile IDs, 0 = empty
      // Our format uses tile indices, -1 = empty
      const tiledId = layerData[y * w + x];
      arr[x][y] = tiledId > 0 ? tiledId - 1 : -1;
    }
  }
  return arr;
}

// Process layers
const bgLayers = [];
const objLayers = [];
const furniture = [];
let spawnPoint = { x: Math.floor(w / 2), y: h - 2 };
let exitPoint = { x: Math.floor(w / 2), y: h - 1 };

for (const layer of tiledData.layers) {
  if (layer.type === 'tilelayer') {
    const converted = convertLayer(layer.data);
    const name = (layer.name || '').toLowerCase();
    if (name.includes('collision') || name.includes('obj') || name.includes('wall')) {
      objLayers.push(converted);
      console.log(`  Layer "${layer.name}" → collision`);
    } else {
      bgLayers.push(converted);
      console.log(`  Layer "${layer.name}" → background`);
    }
  } else if (layer.type === 'objectgroup') {
    // Convert Tiled objects to furniture
    for (const obj of (layer.objects || [])) {
      const tileX = Math.floor(obj.x / tileDim);
      const tileY = Math.floor(obj.y / tileDim);
      const tileW = Math.max(1, Math.floor(obj.width / tileDim));
      const tileH = Math.max(1, Math.floor(obj.height / tileDim));

      // Check for special objects
      const objName = (obj.name || '').toLowerCase();
      const objType = (obj.type || obj.class || '').toLowerCase();

      if (objName === 'spawn' || objType === 'spawn') {
        spawnPoint = { x: tileX, y: tileY };
        console.log(`  Spawn point: (${tileX}, ${tileY})`);
        continue;
      }
      if (objName === 'exit' || objType === 'exit' || objName === 'door') {
        exitPoint = { x: tileX, y: tileY };
        console.log(`  Exit point: (${tileX}, ${tileY})`);
        continue;
      }

      // Regular furniture
      let furnType = 'decor';
      let action = null;
      if (objType === 'interact' || objType === 'counter' || objType === 'shop') {
        furnType = 'interact';
        action = obj.properties?.find(p => p.name === 'action')?.value || 'buy_food';
      } else if (objType === 'blocked' || objType === 'wall' || objType === 'obstacle') {
        furnType = 'blocked';
      } else if (objType === 'work' || objType === 'forge' || objType === 'desk') {
        furnType = 'interact';
        action = 'work';
      }

      furniture.push({
        id: `furn_${furniture.length + 1}`,
        name: obj.name || objType || 'Object',
        type: furnType,
        x: tileX,
        y: tileY,
        w: tileW,
        h: tileH,
        action,
      });
      console.log(`  Furniture: "${obj.name || objType}" (${furnType}) at (${tileX},${tileY}) ${tileW}x${tileH}`);
    }
  }
}

// Ensure at least one layer each
if (bgLayers.length === 0) {
  bgLayers.push(Array.from({ length: w }, () => Array(h).fill(-1)));
}
if (objLayers.length === 0) {
  objLayers.push(Array.from({ length: w }, () => Array(h).fill(-1)));
}

// Build mapData for Convex
const mapData = {
  tilesetpath: tilesetPath,
  tiledim: tileDim,
  tilesetpxw: tilesetPxW,
  tilesetpxh: tilesetPxH,
  bgtiles: bgLayers,
  objmap: objLayers,
  mapwidth: w,
  mapheight: h,
};

// Get world ID
let worldId = worldIdArg;
if (!worldId) {
  console.log('\nFetching default world ID...');
  const result = execSync(
    `cd "${path.resolve(__dirname, '..')}" && npx convex run --no-push world:defaultWorldStatus '{}'`,
    { encoding: 'utf-8' }
  );
  const match = result.match(/"worldId"\s*:\s*"([^"]+)"/);
  if (match) {
    worldId = match[1];
    console.log(`  World ID: ${worldId}`);
  } else {
    console.error('Could not find world ID. Pass it as 4th argument.');
    process.exit(1);
  }
}

// Build Convex mutation args
const mutationArgs = JSON.stringify({
  worldId,
  name: sceneName,
  displayName,
  mapData,
  furniture,
  spawnPoint,
  exitPoint,
});

// Write to temp file (args might be too long for CLI)
const tmpFile = '/tmp/tiled-import-args.json';
fs.writeFileSync(tmpFile, mutationArgs);

console.log(`\nImporting scene "${sceneName}" (${w}x${h}, ${furniture.length} furniture)...`);

// Run Convex mutation
try {
  const result = execSync(
    `cd "${path.resolve(__dirname, '..')}" && npx convex run --no-push scene:importFromEditor "$(cat ${tmpFile})"`,
    { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
  );
  console.log('Result:', result.trim());
  console.log('\nDone! Scene imported successfully.');
} catch (e) {
  console.error('Import failed:', e.stderr || e.message);
  process.exit(1);
}
