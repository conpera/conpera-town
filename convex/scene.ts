/**
 * Scene API — interior room management for buildings.
 *
 * Scenes are tilemap-based rooms that agents can "enter" when visiting a POI.
 * Each scene has: tilemap layers, furniture items, spawn/exit points.
 *
 * Workflow:
 *   1. Use level editor (npm run le) to draw room with small dimensions (e.g. 10x8)
 *   2. Export map.js, then call scene:importFromEditor to load into DB
 *   3. Or call scene:create to build a room programmatically
 *   4. Link scene to a POI via poi.sceneName
 *   5. AI agents query scene:getFurniture to perceive room contents
 *
 * Queries:
 *   getScene         — full scene data by name
 *   listScenes       — all scenes for a world
 *   getFurniture     — furniture list for AI perception
 *   getSceneForPOI   — resolve POI → scene
 *
 * Mutations:
 *   create           — create scene from tilemap data
 *   importFromEditor — import editor-exported map data
 *   addFurniture     — add furniture item to scene
 *   removeFurniture  — remove furniture item
 *   moveFurniture    — reposition furniture
 *   updateFurniture  — change furniture properties
 *   generateDefault  — auto-generate default interiors for shop/workplace
 */

import { v } from 'convex/values';
import { internalQuery, mutation, query } from './_generated/server';

// ─── Queries ─────────────────────────────────────────────

export const getScene = query({
  args: { worldId: v.id('worlds'), name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('scenes')
      .withIndex('byName', (q) => q.eq('worldId', args.worldId).eq('name', args.name))
      .first();
  },
});

export const listScenes = query({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, args) => {
    const scenes = await ctx.db
      .query('scenes')
      .withIndex('byWorld', (q) => q.eq('worldId', args.worldId))
      .collect();
    return scenes.map((s) => ({
      id: s._id,
      name: s.name,
      displayName: s.displayName,
      width: s.width,
      height: s.height,
      furnitureCount: s.furniture.length,
      spawnPoint: s.spawnPoint,
      exitPoint: s.exitPoint,
    }));
  },
});

export const getFurniture = query({
  args: { worldId: v.id('worlds'), sceneName: v.string() },
  handler: async (ctx, args) => {
    const scene = await ctx.db
      .query('scenes')
      .withIndex('byName', (q) => q.eq('worldId', args.worldId).eq('name', args.sceneName))
      .first();
    if (!scene) return [];
    return scene.furniture;
  },
});

export const getSceneForPOI = query({
  args: { worldId: v.id('worlds'), poiName: v.string() },
  handler: async (ctx, args) => {
    const poi = await ctx.db
      .query('pointsOfInterest')
      .withIndex('byName', (q) => q.eq('worldId', args.worldId).eq('name', args.poiName))
      .first();
    if (!poi?.sceneName) return null;
    const sceneName = poi.sceneName;
    return await ctx.db
      .query('scenes')
      .withIndex('byName', (q) => q.eq('worldId', args.worldId).eq('name', sceneName))
      .first();
  },
});

// Internal query for agent perception
export const perceiveRoom = internalQuery({
  args: { worldId: v.id('worlds'), sceneName: v.string() },
  handler: async (ctx, args) => {
    const scene = await ctx.db
      .query('scenes')
      .withIndex('byName', (q) => q.eq('worldId', args.worldId).eq('name', args.sceneName))
      .first();
    if (!scene) return null;
    return {
      name: scene.displayName,
      size: { w: scene.width, h: scene.height },
      furniture: scene.furniture.map((f) => ({
        name: f.name,
        type: f.type,
        position: { x: f.x, y: f.y },
        action: f.action,
      })),
      interactables: scene.furniture
        .filter((f) => f.action)
        .map((f) => ({ name: f.name, action: f.action, position: { x: f.x, y: f.y } })),
    };
  },
});

// ─── Mutations ───────────────────────────────────────────

export const create = mutation({
  args: {
    worldId: v.id('worlds'),
    name: v.string(),
    displayName: v.string(),
    width: v.number(),
    height: v.number(),
    tileDim: v.optional(v.number()),
    tileSetUrl: v.optional(v.string()),
    tileSetDimX: v.optional(v.number()),
    tileSetDimY: v.optional(v.number()),
    bgTiles: v.optional(v.array(v.array(v.array(v.number())))),
    objectTiles: v.optional(v.array(v.array(v.array(v.number())))),
    furniture: v.optional(v.array(v.any())),
    spawnPoint: v.optional(v.object({ x: v.number(), y: v.number() })),
    exitPoint: v.optional(v.object({ x: v.number(), y: v.number() })),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('scenes')
      .withIndex('byName', (q) => q.eq('worldId', args.worldId).eq('name', args.name))
      .first();
    if (existing) {
      throw new Error(`Scene "${args.name}" already exists. Delete it first.`);
    }

    const w = args.width;
    const h = args.height;

    // Generate empty tilemap if not provided
    const emptyLayer = Array.from({ length: w }, () => Array(h).fill(-1));
    const bgTiles = args.bgTiles ?? [emptyLayer.map((col) => [...col])];
    const objectTiles = args.objectTiles ?? [emptyLayer.map((col) => [...col])];

    const id = await ctx.db.insert('scenes', {
      worldId: args.worldId,
      name: args.name,
      displayName: args.displayName,
      width: w,
      height: h,
      tileDim: args.tileDim ?? 32,
      tileSetUrl: args.tileSetUrl ?? '/ai-town/assets/gentle-obj.png',
      tileSetDimX: args.tileSetDimX ?? 1440,
      tileSetDimY: args.tileSetDimY ?? 1024,
      bgTiles,
      objectTiles,
      furniture: args.furniture ?? [],
      spawnPoint: args.spawnPoint ?? { x: Math.floor(w / 2), y: h - 2 },
      exitPoint: args.exitPoint ?? { x: Math.floor(w / 2), y: h - 1 },
    });
    return { id, name: args.name };
  },
});

export const importFromEditor = mutation({
  args: {
    worldId: v.id('worlds'),
    name: v.string(),
    displayName: v.string(),
    // Raw editor export data
    mapData: v.object({
      tilesetpath: v.string(),
      tiledim: v.number(),
      tilesetpxw: v.number(),
      tilesetpxh: v.number(),
      bgtiles: v.array(v.array(v.array(v.number()))),
      objmap: v.array(v.array(v.array(v.number()))),
      mapwidth: v.number(),
      mapheight: v.number(),
    }),
    furniture: v.optional(v.array(v.any())),
    spawnPoint: v.optional(v.object({ x: v.number(), y: v.number() })),
    exitPoint: v.optional(v.object({ x: v.number(), y: v.number() })),
  },
  handler: async (ctx, args) => {
    const { mapData } = args;

    // Delete existing scene with same name
    const existing = await ctx.db
      .query('scenes')
      .withIndex('byName', (q) => q.eq('worldId', args.worldId).eq('name', args.name))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    const id = await ctx.db.insert('scenes', {
      worldId: args.worldId,
      name: args.name,
      displayName: args.displayName,
      width: mapData.mapwidth,
      height: mapData.mapheight,
      tileDim: mapData.tiledim,
      tileSetUrl: mapData.tilesetpath,
      tileSetDimX: mapData.tilesetpxw,
      tileSetDimY: mapData.tilesetpxh,
      bgTiles: mapData.bgtiles,
      objectTiles: mapData.objmap,
      furniture: args.furniture ?? [],
      spawnPoint: args.spawnPoint ?? { x: Math.floor(mapData.mapwidth / 2), y: mapData.mapheight - 2 },
      exitPoint: args.exitPoint ?? { x: Math.floor(mapData.mapwidth / 2), y: mapData.mapheight - 1 },
    });
    return { id, name: args.name, width: mapData.mapwidth, height: mapData.mapheight };
  },
});

export const addFurniture = mutation({
  args: {
    worldId: v.id('worlds'),
    sceneName: v.string(),
    name: v.string(),
    type: v.string(),       // 'interact' | 'decor' | 'blocked'
    x: v.number(),
    y: v.number(),
    w: v.optional(v.number()),
    h: v.optional(v.number()),
    action: v.optional(v.string()),
    config: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const scene = await ctx.db
      .query('scenes')
      .withIndex('byName', (q) => q.eq('worldId', args.worldId).eq('name', args.sceneName))
      .first();
    if (!scene) throw new Error(`Scene "${args.sceneName}" not found`);
    const id = `furn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const item = {
      id,
      name: args.name,
      type: args.type,
      x: args.x,
      y: args.y,
      w: args.w,
      h: args.h,
      action: args.action,
      config: args.config,
    };
    await ctx.db.patch(scene._id, {
      furniture: [...scene.furniture, item],
    });
    return { id, name: args.name };
  },
});

export const removeFurniture = mutation({
  args: {
    worldId: v.id('worlds'),
    sceneName: v.string(),
    furnitureId: v.string(),
  },
  handler: async (ctx, args) => {
    const scene = await ctx.db
      .query('scenes')
      .withIndex('byName', (q) => q.eq('worldId', args.worldId).eq('name', args.sceneName))
      .first();
    if (!scene) throw new Error(`Scene "${args.sceneName}" not found`);
    const updated = scene.furniture.filter((f) => f.id !== args.furnitureId);
    await ctx.db.patch(scene._id, { furniture: updated });
    return { removed: args.furnitureId };
  },
});

export const moveFurniture = mutation({
  args: {
    worldId: v.id('worlds'),
    sceneName: v.string(),
    furnitureId: v.string(),
    x: v.number(),
    y: v.number(),
  },
  handler: async (ctx, args) => {
    const scene = await ctx.db
      .query('scenes')
      .withIndex('byName', (q) => q.eq('worldId', args.worldId).eq('name', args.sceneName))
      .first();
    if (!scene) throw new Error(`Scene "${args.sceneName}" not found`);
    const updated = scene.furniture.map((f) =>
      f.id === args.furnitureId ? { ...f, x: args.x, y: args.y } : f,
    );
    await ctx.db.patch(scene._id, { furniture: updated });
    return { moved: args.furnitureId, x: args.x, y: args.y };
  },
});

export const deleteScene = mutation({
  args: { worldId: v.id('worlds'), name: v.string() },
  handler: async (ctx, args) => {
    const scene = await ctx.db
      .query('scenes')
      .withIndex('byName', (q) => q.eq('worldId', args.worldId).eq('name', args.name))
      .first();
    if (!scene) throw new Error(`Scene "${args.name}" not found`);
    await ctx.db.delete(scene._id);
    return { deleted: args.name };
  },
});

// Generate default scenes for shop and workplace
export const generateDefaults = mutation({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, args) => {
    const created: string[] = [];
    const W = 10, H = 8;

    for (const def of [
      {
        name: 'shop_interior',
        displayName: 'General Store',
        furniture: [
          { id: 'shelf_1', name: 'Display Shelf', type: 'decor', x: 1, y: 1, w: 8, h: 2 },
          { id: 'counter_1', name: 'Shop Counter', type: 'interact', x: 2, y: 4, w: 6, h: 1, action: 'buy_food' },
          { id: 'crate_l', name: 'Storage Crate', type: 'blocked', x: 1, y: 4 },
          { id: 'crate_r', name: 'Storage Crate', type: 'blocked', x: 8, y: 4 },
          { id: 'chair_1', name: 'Chair', type: 'decor', x: 3, y: 5 },
          { id: 'chair_2', name: 'Chair', type: 'decor', x: 6, y: 5 },
        ],
      },
      {
        name: 'workplace_interior',
        displayName: 'Workshop',
        furniture: [
          { id: 'forge_1', name: 'Forge', type: 'interact', x: 1, y: 1, w: 4, h: 2, action: 'work' },
          { id: 'tools_1', name: 'Tool Rack', type: 'decor', x: 6, y: 1, w: 3, h: 2 },
          { id: 'desk_1', name: 'Work Desk', type: 'interact', x: 4, y: 4, w: 3, h: 1, action: 'work' },
          { id: 'storage_l', name: 'Crate Stack', type: 'blocked', x: 1, y: 4, h: 3 },
          { id: 'shelf_r', name: 'Bookshelf', type: 'decor', x: 8, y: 3, h: 3 },
          { id: 'chair_1', name: 'Chair', type: 'decor', x: 5, y: 5 },
        ],
      },
    ]) {
      const existing = await ctx.db
        .query('scenes')
        .withIndex('byName', (q) => q.eq('worldId', args.worldId).eq('name', def.name))
        .first();
      if (existing) continue;

      // Empty tilemap — visual rendering uses the PNG fallback
      const emptyLayer = Array.from({ length: W }, () => Array(H).fill(-1));
      await ctx.db.insert('scenes', {
        worldId: args.worldId,
        name: def.name,
        displayName: def.displayName,
        width: W,
        height: H,
        tileDim: 32,
        tileSetUrl: '/ai-town/assets/gentle-obj.png',
        tileSetDimX: 1440,
        tileSetDimY: 1024,
        bgTiles: [emptyLayer.map((c) => [...c])],
        objectTiles: [emptyLayer.map((c) => [...c])],
        furniture: def.furniture,
        spawnPoint: { x: 4, y: 6 },
        exitPoint: { x: 4, y: 7 },
      });
      created.push(def.name);
    }
    return { created };
  },
});
