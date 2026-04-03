import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { agentTables } from './agent/schema';
import { aiTownTables } from './aiTown/schema';
import { conversationId, playerId } from './aiTown/ids';
import { engineTables } from './engine/schema';

export default defineSchema({
  music: defineTable({
    storageId: v.string(),
    type: v.union(v.literal('background'), v.literal('player')),
  }),

  messages: defineTable({
    conversationId,
    messageUuid: v.string(),
    author: playerId,
    text: v.string(),
    worldId: v.optional(v.id('worlds')),
  })
    .index('conversationId', ['worldId', 'conversationId'])
    .index('messageUuid', ['conversationId', 'messageUuid']),

  // Token usage tracking per agent
  tokenUsage: defineTable({
    worldId: v.id('worlds'),
    playerId,
    operation: v.string(), // 'startConversation' | 'continueConversation' | 'leaveConversation' | 'rememberConversation'
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    timestamp: v.number(),
  })
    .index('byPlayer', ['worldId', 'playerId', 'timestamp'])
    .index('byWorld', ['worldId', 'timestamp']),

  // Interior scenes — tilemap rooms for buildings
  scenes: defineTable({
    worldId: v.id('worlds'),
    name: v.string(),           // unique: 'shop_interior', 'workplace_interior'
    displayName: v.string(),    // 'General Store', 'Workshop'
    width: v.number(),          // tiles
    height: v.number(),         // tiles
    tileDim: v.number(),        // pixel size per tile (32)
    tileSetUrl: v.string(),     // tileset image path
    tileSetDimX: v.number(),
    tileSetDimY: v.number(),
    bgTiles: v.array(v.array(v.array(v.number()))),    // [layer][x][y]
    objectTiles: v.array(v.array(v.array(v.number()))), // collision layers
    furniture: v.array(v.object({
      id: v.string(),
      name: v.string(),         // 'counter', 'shelf', 'forge', 'chair'
      type: v.string(),         // 'interact' | 'decor' | 'blocked'
      x: v.number(),
      y: v.number(),
      w: v.optional(v.number()),  // width in tiles (default 1)
      h: v.optional(v.number()),  // height in tiles (default 1)
      action: v.optional(v.string()),  // 'buy_food' | 'work' | 'sit' | null
      config: v.optional(v.any()),     // action-specific config
    })),
    spawnPoint: v.object({ x: v.number(), y: v.number() }), // where agents appear inside
    exitPoint: v.object({ x: v.number(), y: v.number() }),   // door position
  })
    .index('byWorld', ['worldId'])
    .index('byName', ['worldId', 'name']),

  // Points of Interest — dynamic map locations (shop, workplace, etc.)
  pointsOfInterest: defineTable({
    worldId: v.id('worlds'),
    name: v.string(),           // unique name: 'shop', 'workplace', 'tavern', etc.
    label: v.string(),          // display label: 'SHOP', 'WORK'
    type: v.string(),           // 'shop' | 'workplace' | 'landmark' | 'custom'
    position: v.object({ x: v.number(), y: v.number() }),
    spriteUrl: v.optional(v.string()),  // e.g. '/ai-town/assets/shop.png'
    labelColor: v.optional(v.string()), // hex color e.g. '#cc6600'
    config: v.optional(v.any()),        // type-specific config (cost, reward, etc.)
    sceneName: v.optional(v.string()),  // link to scenes table by name
    active: v.boolean(),
  })
    .index('byWorld', ['worldId', 'active'])
    .index('byName', ['worldId', 'name']),

  ...agentTables,
  ...aiTownTables,
  ...engineTables,
});
