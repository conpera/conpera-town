/**
 * Map & POI API — query/mutation endpoints for map inspection and management.
 *
 * Queries (read-only):
 *   mapInfo          — map dimensions, tileset info
 *   tileAt           — check walkability & tile IDs at a position
 *   findWalkableArea — scan for NxN walkable regions on grass
 *   listPOI          — list all points of interest
 *   economyStatus    — all agents' hunger/money/tokens at a glance
 *
 * Mutations (write):
 *   addPOI           — create a new point of interest
 *   movePOI          — relocate an existing POI
 *   removePOI        — deactivate a POI
 *   updatePOI        — update POI config/label/sprite
 *   setTileBlocked   — toggle a tile's collision layer
 *   seedDefaultPOIs  — create default shop + workplace if missing
 */

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { playerId } from './aiTown/ids';
import { insertInput } from './aiTown/insertInput';
import {
  SHOP_POSITION,
  WORKPLACE_POSITION,
  FOOD_COST,
  FOOD_HUNGER_RESTORE,
  WORK_REWARD,
  WORK_DURATION,
} from './constants';

// ─── Queries ─────────────────────────────────────────────

export const mapInfo = query({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, args) => {
    const map = await ctx.db
      .query('maps')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .first();
    if (!map) throw new Error(`No map for world ${args.worldId}`);
    return {
      width: map.width,
      height: map.height,
      tileDim: map.tileDim,
      tileSetUrl: map.tileSetUrl,
      bgLayers: map.bgTiles.length,
      objLayers: map.objectTiles.length,
      animatedSprites: map.animatedSprites.length,
    };
  },
});

export const tileAt = query({
  args: {
    worldId: v.id('worlds'),
    x: v.number(),
    y: v.number(),
  },
  handler: async (ctx, args) => {
    const map = await ctx.db
      .query('maps')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .first();
    if (!map) throw new Error(`No map for world ${args.worldId}`);
    const { x, y } = args;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
      return { inBounds: false, walkable: false, bgTiles: [], objTiles: [] };
    }
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    // Both bgTiles and objectTiles use [x][y] indexing
    const bgTiles = map.bgTiles.map((layer: number[][]) => layer[ix]?.[iy] ?? -1);
    const objTiles = map.objectTiles.map((layer: number[][]) => layer[ix]?.[iy] ?? -1);
    const walkable = objTiles.every((t: number) => t === -1);
    return { inBounds: true, walkable, bgTiles, objTiles, x: ix, y: iy };
  },
});

export const findWalkableArea = query({
  args: {
    worldId: v.id('worlds'),
    size: v.optional(v.number()),   // NxN area, default 5
    limit: v.optional(v.number()),  // max results, default 10
    grassOnly: v.optional(v.boolean()), // only grass tiles (bg=271)
  },
  handler: async (ctx, args) => {
    const map = await ctx.db
      .query('maps')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .first();
    if (!map) throw new Error(`No map for world ${args.worldId}`);
    const size = args.size ?? 5;
    const limit = args.limit ?? 10;
    const grassOnly = args.grassOnly ?? true;
    const half = Math.floor(size / 2);
    const results: Array<{ x: number; y: number }> = [];

    for (let y = half; y < map.height - half && results.length < limit; y++) {
      for (let x = half; x < map.width - half && results.length < limit; x++) {
        let ok = true;
        for (let dy = -half; dy <= half && ok; dy++) {
          for (let dx = -half; dx <= half && ok; dx++) {
            const tx = x + dx;
            const ty = y + dy;
            // Check collision layers — objectTiles is [layer][x][y]
            for (const layer of map.objectTiles) {
              if (layer[tx]?.[ty] !== -1) { ok = false; break; }
            }
            if (ok && grassOnly) {
              // bgTiles uses [x][y] indexing
              const bg = map.bgTiles[0]?.[tx]?.[ty];
              if (bg !== 271) ok = false;
            }
          }
        }
        if (ok) results.push({ x, y });
      }
    }
    return { count: results.length, positions: results };
  },
});

export const listPOI = query({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, args) => {
    const pois = await ctx.db
      .query('pointsOfInterest')
      .withIndex('byWorld', (q) => q.eq('worldId', args.worldId).eq('active', true))
      .collect();
    return pois.map((p) => ({
      id: p._id,
      name: p.name,
      label: p.label,
      type: p.type,
      position: p.position,
      spriteUrl: p.spriteUrl,
      labelColor: p.labelColor,
      config: p.config,
    }));
  },
});

export const economyStatus = query({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) throw new Error(`World ${args.worldId} not found`);

    const playerDescs = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    const nameMap = new Map(playerDescs.map((d) => [d.playerId, d.name]));

    const players = world.players.map((p: any) => ({
      id: p.id,
      name: nameMap.get(p.id) ?? p.id,
      hunger: p.hunger ?? 100,
      money: p.money ?? 100,
      totalTokensUsed: p.totalTokensUsed ?? 0,
      position: p.position,
      activity: p.activity?.description ?? null,
    }));

    // Token usage totals from DB
    const tokenRecords = await ctx.db
      .query('tokenUsage')
      .withIndex('byWorld', (q) => q.eq('worldId', args.worldId))
      .collect();
    const totalTokens = tokenRecords.reduce((s, r) => s + r.totalTokens, 0);
    const totalCost = tokenRecords.reduce((s, r) => s + r.promptTokens + r.completionTokens, 0);

    return {
      players,
      worldTotalTokens: totalTokens,
      worldTotalCost: totalCost,
      tokenRecordCount: tokenRecords.length,
    };
  },
});

// ─── Mutations ───────────────────────────────────────────

export const addPOI = mutation({
  args: {
    worldId: v.id('worlds'),
    name: v.string(),
    label: v.string(),
    type: v.string(),
    x: v.number(),
    y: v.number(),
    spriteUrl: v.optional(v.string()),
    labelColor: v.optional(v.string()),
    config: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Check for duplicate name
    const existing = await ctx.db
      .query('pointsOfInterest')
      .withIndex('byName', (q) => q.eq('worldId', args.worldId).eq('name', args.name))
      .first();
    if (existing && existing.active) {
      throw new Error(`POI "${args.name}" already exists. Use movePOI or removePOI first.`);
    }
    const id = await ctx.db.insert('pointsOfInterest', {
      worldId: args.worldId,
      name: args.name,
      label: args.label,
      type: args.type,
      position: { x: args.x, y: args.y },
      spriteUrl: args.spriteUrl,
      labelColor: args.labelColor,
      config: args.config,
      active: true,
    });
    return { id, name: args.name, position: { x: args.x, y: args.y } };
  },
});

export const movePOI = mutation({
  args: {
    worldId: v.id('worlds'),
    name: v.string(),
    x: v.number(),
    y: v.number(),
  },
  handler: async (ctx, args) => {
    const poi = await ctx.db
      .query('pointsOfInterest')
      .withIndex('byName', (q) => q.eq('worldId', args.worldId).eq('name', args.name))
      .first();
    if (!poi || !poi.active) throw new Error(`POI "${args.name}" not found`);
    await ctx.db.patch(poi._id, { position: { x: args.x, y: args.y } });
    return { name: args.name, oldPosition: poi.position, newPosition: { x: args.x, y: args.y } };
  },
});

export const removePOI = mutation({
  args: {
    worldId: v.id('worlds'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const poi = await ctx.db
      .query('pointsOfInterest')
      .withIndex('byName', (q) => q.eq('worldId', args.worldId).eq('name', args.name))
      .first();
    if (!poi) throw new Error(`POI "${args.name}" not found`);
    await ctx.db.patch(poi._id, { active: false });
    return { name: args.name, removed: true };
  },
});

export const setPOIActive = mutation({
  args: {
    worldId: v.id('worlds'),
    name: v.string(),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const poi = await ctx.db
      .query('pointsOfInterest')
      .withIndex('byName', (q) => q.eq('worldId', args.worldId).eq('name', args.name))
      .first();
    if (!poi) throw new Error(`POI "${args.name}" not found`);
    await ctx.db.patch(poi._id, { active: args.active });
    return { name: args.name, active: args.active };
  },
});

export const updatePOI = mutation({
  args: {
    worldId: v.id('worlds'),
    name: v.string(),
    label: v.optional(v.string()),
    spriteUrl: v.optional(v.string()),
    labelColor: v.optional(v.string()),
    config: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const poi = await ctx.db
      .query('pointsOfInterest')
      .withIndex('byName', (q) => q.eq('worldId', args.worldId).eq('name', args.name))
      .first();
    if (!poi || !poi.active) throw new Error(`POI "${args.name}" not found`);
    const patch: any = {};
    if (args.label !== undefined) patch.label = args.label;
    if (args.spriteUrl !== undefined) patch.spriteUrl = args.spriteUrl;
    if (args.labelColor !== undefined) patch.labelColor = args.labelColor;
    if (args.config !== undefined) patch.config = args.config;
    await ctx.db.patch(poi._id, patch);
    return { name: args.name, updated: Object.keys(patch) };
  },
});

export const setTileBlocked = mutation({
  args: {
    worldId: v.id('worlds'),
    x: v.number(),
    y: v.number(),
    layer: v.optional(v.number()),
    blocked: v.boolean(),  // true = blocked, false = walkable
  },
  handler: async (ctx, args) => {
    const mapDoc = await ctx.db
      .query('maps')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .first();
    if (!mapDoc) throw new Error(`No map for world ${args.worldId}`);
    const layerIdx = args.layer ?? 0;
    if (layerIdx < 0 || layerIdx >= mapDoc.objectTiles.length) {
      throw new Error(`Invalid layer ${layerIdx}`);
    }
    const ix = Math.floor(args.x);
    const iy = Math.floor(args.y);
    if (ix < 0 || iy < 0 || ix >= mapDoc.width || iy >= mapDoc.height) {
      throw new Error(`Position (${ix},${iy}) out of bounds`);
    }
    // objectTiles is [layer][x][y]
    const newTiles = mapDoc.objectTiles.map((layer: number[][], li: number) => {
      if (li !== layerIdx) return layer;
      const newLayer = layer.map((col: number[], ci: number) => {
        if (ci !== ix) return col;
        const newCol = [...col];
        newCol[iy] = args.blocked ? 367 : -1; // 367 is a common obstacle tile
        return newCol;
      });
      return newLayer;
    });
    await ctx.db.patch(mapDoc._id, { objectTiles: newTiles });
    return { x: ix, y: iy, blocked: args.blocked };
  },
});

export const seedDefaultPOIs = mutation({
  args: { worldId: v.id('worlds') },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('pointsOfInterest')
      .withIndex('byWorld', (q) => q.eq('worldId', args.worldId).eq('active', true))
      .collect();
    const names = new Set(existing.map((p) => p.name));
    const created: string[] = [];

    if (!names.has('shop')) {
      await ctx.db.insert('pointsOfInterest', {
        worldId: args.worldId,
        name: 'shop',
        label: 'SHOP',
        type: 'shop',
        position: SHOP_POSITION,
        spriteUrl: '/ai-town/assets/shop.png',
        labelColor: '#cc6600',
        config: { foodCost: FOOD_COST, hungerRestore: FOOD_HUNGER_RESTORE },
        active: true,
      });
      created.push('shop');
    }
    if (!names.has('workplace')) {
      await ctx.db.insert('pointsOfInterest', {
        worldId: args.worldId,
        name: 'workplace',
        label: 'WORK',
        type: 'workplace',
        position: WORKPLACE_POSITION,
        spriteUrl: '/ai-town/assets/workplace.png',
        labelColor: '#336633',
        config: { workDuration: WORK_DURATION, workReward: WORK_REWARD },
        active: true,
      });
      created.push('workplace');
    }
    return { created, existing: [...names] };
  },
});

// ─── Building Collision ──────────────────────────────────

// Set collision tiles for a building footprint around a POI position.
// Building sprite covers ~3 wide x 3 tall above the interaction point.
// The interaction point (door) stays walkable.
export const setBuildingCollision = mutation({
  args: {
    worldId: v.id('worlds'),
    x: v.number(),        // POI x (door position)
    y: v.number(),        // POI y (door position)
    blocked: v.boolean(), // true = place building, false = remove
  },
  handler: async (ctx, args) => {
    const mapDoc = await ctx.db
      .query('maps')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .first();
    if (!mapDoc) throw new Error(`No map for world ${args.worldId}`);

    // Building footprint: 3 wide (x-1 to x+1), 3 tall above door (y-3 to y-1)
    // Door tile (x, y) stays walkable for interaction
    const footprint: Array<{ x: number; y: number }> = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -3; dy <= -1; dy++) {
        const tx = Math.floor(args.x) + dx;
        const ty = Math.floor(args.y) + dy;
        if (tx >= 0 && tx < mapDoc.width && ty >= 0 && ty < mapDoc.height) {
          footprint.push({ x: tx, y: ty });
        }
      }
    }

    // Modify objectTiles layer 0
    const newTiles = mapDoc.objectTiles.map((layer: number[][], li: number) => {
      if (li !== 0) return layer;
      const newLayer = layer.map((col: number[], ci: number) => {
        const matches = footprint.filter((f) => f.x === ci);
        if (matches.length === 0) return col;
        const newCol = [...col];
        for (const m of matches) {
          newCol[m.y] = args.blocked ? 367 : -1;
        }
        return newCol;
      });
      return newLayer;
    });

    await ctx.db.patch(mapDoc._id, { objectTiles: newTiles });
    return { footprint, blocked: args.blocked };
  },
});

// ─── Economy Management ──────────────────────────────────

export const adjustHunger = mutation({
  args: {
    worldId: v.id('worlds'),
    playerId,
    amount: v.number(), // positive = feed, negative = drain
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) throw new Error(`World not found`);
    const idx = world.players.findIndex((p: any) => p.id === args.playerId);
    if (idx === -1) throw new Error(`Player ${args.playerId} not found`);
    const player = world.players[idx];
    const oldHunger = player.hunger ?? 100;
    const newHunger = Math.max(0, Math.min(100, oldHunger + args.amount));
    const updated = [...world.players];
    updated[idx] = { ...player, hunger: newHunger };
    await ctx.db.patch(args.worldId, { players: updated });
    return { playerId: args.playerId, oldHunger, newHunger };
  },
});

export const adjustMoney = mutation({
  args: {
    worldId: v.id('worlds'),
    playerId,
    amount: v.number(), // positive = give, negative = take
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) throw new Error(`World not found`);
    const idx = world.players.findIndex((p: any) => p.id === args.playerId);
    if (idx === -1) throw new Error(`Player ${args.playerId} not found`);
    const player = world.players[idx];
    const oldMoney = player.money ?? 100;
    const newMoney = Math.max(0, oldMoney + args.amount);
    const updated = [...world.players];
    updated[idx] = { ...player, money: newMoney };
    await ctx.db.patch(args.worldId, { players: updated });
    return { playerId: args.playerId, oldMoney, newMoney };
  },
});

export const resetEconomy = mutation({
  args: {
    worldId: v.id('worlds'),
    hunger: v.optional(v.number()),
    money: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const resetHunger = args.hunger ?? 100;
    const resetMoney = args.money ?? 100;
    // Use input system so the engine applies it during its tick cycle
    await insertInput(ctx, args.worldId, 'resetPlayerEconomy', {
      hunger: resetHunger,
      money: resetMoney,
    });
    return { hunger: resetHunger, money: resetMoney };
  },
});
