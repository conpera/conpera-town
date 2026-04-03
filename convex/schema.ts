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

  ...agentTables,
  ...aiTownTables,
  ...engineTables,
});
