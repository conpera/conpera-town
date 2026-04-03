import { v } from 'convex/values';
import { internalAction } from '../_generated/server';
import { WorldMap, serializedWorldMap } from './worldMap';
import { rememberConversation } from '../agent/memory';
import { GameId, agentId, conversationId, playerId } from './ids';
import {
  continueConversationMessage,
  leaveConversationMessage,
  startConversationMessage,
} from '../agent/conversation';
import { assertNever } from '../util/assertNever';
import { serializedAgent } from './agent';
import {
  ACTIVITIES,
  ACTIVITY_COOLDOWN,
  CONVERSATION_COOLDOWN,
  HUNGER_CRITICAL,
  MONEY_LOW,
  SHOP_POSITION,
  WORKPLACE_POSITION,
  FOOD_COST,
  FOOD_HUNGER_RESTORE,
  WORK_DURATION,
  WORK_REWARD,
} from '../constants';
import { api, internal } from '../_generated/api';
import { sleep } from '../util/sleep';
import { serializedPlayer } from './player';

export const agentRememberConversation = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId,
    agentId,
    conversationId,
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    await rememberConversation(
      ctx,
      args.worldId,
      args.agentId as GameId<'agents'>,
      args.playerId as GameId<'players'>,
      args.conversationId as GameId<'conversations'>,
    );
    await sleep(Math.random() * 1000);
    await ctx.runMutation(api.aiTown.main.sendInput, {
      worldId: args.worldId,
      name: 'finishRememberConversation',
      args: {
        agentId: args.agentId,
        operationId: args.operationId,
      },
    });
  },
});

export const agentGenerateMessage = internalAction({
  args: {
    worldId: v.id('worlds'),
    playerId,
    agentId,
    conversationId,
    otherPlayerId: playerId,
    operationId: v.string(),
    type: v.union(v.literal('start'), v.literal('continue'), v.literal('leave')),
    messageUuid: v.string(),
  },
  handler: async (ctx, args) => {
    let completionFn;
    switch (args.type) {
      case 'start':
        completionFn = startConversationMessage;
        break;
      case 'continue':
        completionFn = continueConversationMessage;
        break;
      case 'leave':
        completionFn = leaveConversationMessage;
        break;
      default:
        assertNever(args.type);
    }
    const { text, usage } = await completionFn(
      ctx,
      args.worldId,
      args.conversationId as GameId<'conversations'>,
      args.playerId as GameId<'players'>,
      args.otherPlayerId as GameId<'players'>,
    );

    // Record token usage
    await ctx.runMutation(internal.aiTown.agent.recordTokenUsage, {
      worldId: args.worldId,
      playerId: args.playerId,
      operation: `${args.type}Conversation`,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    });

    await ctx.runMutation(internal.aiTown.agent.agentSendMessage, {
      worldId: args.worldId,
      conversationId: args.conversationId,
      agentId: args.agentId,
      playerId: args.playerId,
      text,
      messageUuid: args.messageUuid,
      leaveConversation: args.type === 'leave',
      operationId: args.operationId,
    });
  },
});

export const agentDoSomething = internalAction({
  args: {
    worldId: v.id('worlds'),
    player: v.object(serializedPlayer),
    agent: v.object(serializedAgent),
    map: v.object(serializedWorldMap),
    otherFreePlayers: v.array(v.object(serializedPlayer)),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    const { player, agent } = args;
    const map = new WorldMap(args.map);
    const now = Date.now();

    // Economy-driven behavior: check hunger and money first
    const hunger = player.hunger ?? 100;
    const money = player.money ?? 100;

    // Priority 1: If starving and have money, go to shop
    if (hunger <= HUNGER_CRITICAL && money >= FOOD_COST) {
      console.log(`Agent ${agent.id} is hungry (${hunger}), heading to shop`);
      await sleep(Math.random() * 1000);
      await ctx.runMutation(api.aiTown.main.sendInput, {
        worldId: args.worldId,
        name: 'finishDoSomething',
        args: {
          operationId: args.operationId,
          agentId: agent.id,
          destination: SHOP_POSITION,
          activity: {
            description: 'heading to the shop to buy food',
            emoji: '🏪',
            until: now + 5_000,
          },
        },
      });
      return;
    }

    // Priority 2: If hungry but no money, go work
    if (hunger <= HUNGER_CRITICAL && money < FOOD_COST) {
      console.log(`Agent ${agent.id} is hungry and broke, heading to work`);
      await sleep(Math.random() * 1000);
      await ctx.runMutation(api.aiTown.main.sendInput, {
        worldId: args.worldId,
        name: 'finishDoSomething',
        args: {
          operationId: args.operationId,
          agentId: agent.id,
          destination: WORKPLACE_POSITION,
          activity: {
            description: 'heading to work to earn money',
            emoji: '🏢',
            until: now + 5_000,
          },
        },
      });
      return;
    }

    // Priority 3: If low on money (but not starving), go work sometimes
    if (money < MONEY_LOW && Math.random() < 0.5) {
      console.log(`Agent ${agent.id} is low on money (${money}), heading to work`);
      await sleep(Math.random() * 1000);
      await ctx.runMutation(api.aiTown.main.sendInput, {
        worldId: args.worldId,
        name: 'finishDoSomething',
        args: {
          operationId: args.operationId,
          agentId: agent.id,
          destination: WORKPLACE_POSITION,
          activity: {
            description: 'heading to work to earn money',
            emoji: '🏢',
            until: now + 5_000,
          },
        },
      });
      return;
    }

    // Normal behavior below (original logic)
    // Don't try to start a new conversation if we were just in one.
    const justLeftConversation =
      agent.lastConversation && now < agent.lastConversation + CONVERSATION_COOLDOWN;
    // Don't try again if we recently tried to find someone to invite.
    const recentlyAttemptedInvite =
      agent.lastInviteAttempt && now < agent.lastInviteAttempt + CONVERSATION_COOLDOWN;
    const recentActivity = player.activity && now < player.activity.until + ACTIVITY_COOLDOWN;
    // Decide whether to do an activity or wander somewhere.
    if (!player.pathfinding) {
      if (recentActivity || justLeftConversation) {
        await sleep(Math.random() * 1000);
        await ctx.runMutation(api.aiTown.main.sendInput, {
          worldId: args.worldId,
          name: 'finishDoSomething',
          args: {
            operationId: args.operationId,
            agentId: agent.id,
            destination: wanderDestination(map),
          },
        });
        return;
      } else {
        // TODO: have LLM choose the activity & emoji
        const activity = ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)];
        await sleep(Math.random() * 1000);
        await ctx.runMutation(api.aiTown.main.sendInput, {
          worldId: args.worldId,
          name: 'finishDoSomething',
          args: {
            operationId: args.operationId,
            agentId: agent.id,
            activity: {
              description: activity.description,
              emoji: activity.emoji,
              until: Date.now() + activity.duration,
            },
          },
        });
        return;
      }
    }
    const invitee =
      justLeftConversation || recentlyAttemptedInvite
        ? undefined
        : await ctx.runQuery(internal.aiTown.agent.findConversationCandidate, {
            now,
            worldId: args.worldId,
            player: args.player,
            otherFreePlayers: args.otherFreePlayers,
          });

    // TODO: We hit a lot of OCC errors on sending inputs in this file. It's
    // easy for them to get scheduled at the same time and line up in time.
    await sleep(Math.random() * 1000);
    await ctx.runMutation(api.aiTown.main.sendInput, {
      worldId: args.worldId,
      name: 'finishDoSomething',
      args: {
        operationId: args.operationId,
        agentId: args.agent.id,
        invitee,
      },
    });
  },
});

function wanderDestination(worldMap: WorldMap) {
  // Wander someonewhere at least one tile away from the edge.
  return {
    x: 1 + Math.floor(Math.random() * (worldMap.width - 2)),
    y: 1 + Math.floor(Math.random() * (worldMap.height - 2)),
  };
}
