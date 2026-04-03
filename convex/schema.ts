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
    active: v.boolean(),
  })
    .index('byWorld', ['worldId', 'active'])
    .index('byName', ['worldId', 'name']),

  ...agentTables,
  ...aiTownTables,
  ...engineTables,
});
