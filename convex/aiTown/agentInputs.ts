import { v } from 'convex/values';
import { agentId, conversationId, parseGameId } from './ids';
import { Player, activity } from './player';
import { Conversation, conversationInputs } from './conversation';
import { movePlayer } from './movement';
import { inputHandler } from './inputHandler';
import { point } from '../util/types';
import { Descriptions } from '../../data/characters';
import { AgentDescription } from './agentDescription';
import { Agent } from './agent';
import {
  FOOD_COST,
  FOOD_HUNGER_RESTORE,
  WORK_REWARD,
  SHOP_POSITION,
  WORKPLACE_POSITION,
  INTERACTION_DISTANCE,
  INITIAL_HUNGER,
  INITIAL_MONEY,
} from '../constants';
import { distance } from '../util/geometry';

export const agentInputs = {
  finishRememberConversation: inputHandler({
    args: {
      operationId: v.string(),
      agentId,
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        throw new Error(`Couldn't find agent: ${agentId}`);
      }
      if (
        !agent.inProgressOperation ||
        agent.inProgressOperation.operationId !== args.operationId
      ) {
        console.debug(`Agent ${agentId} isn't remembering ${args.operationId}`);
      } else {
        delete agent.inProgressOperation;
        delete agent.toRemember;
      }
      return null;
    },
  }),
  finishDoSomething: inputHandler({
    args: {
      operationId: v.string(),
      agentId: v.id('agents'),
      destination: v.optional(point),
      invitee: v.optional(v.id('players')),
      activity: v.optional(activity),
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        throw new Error(`Couldn't find agent: ${agentId}`);
      }
      if (
        !agent.inProgressOperation ||
        agent.inProgressOperation.operationId !== args.operationId
      ) {
        console.debug(`Agent ${agentId} didn't have ${args.operationId} in progress`);
        return null;
      }
      delete agent.inProgressOperation;
      const player = game.world.players.get(agent.playerId)!;
      if (args.invitee) {
        const inviteeId = parseGameId('players', args.invitee);
        const invitee = game.world.players.get(inviteeId);
        if (!invitee) {
          throw new Error(`Couldn't find player: ${inviteeId}`);
        }
        Conversation.start(game, now, player, invitee);
        agent.lastInviteAttempt = now;
      }
      if (args.destination) {
        movePlayer(game, now, player, args.destination);
      }
      if (args.activity) {
        player.activity = args.activity;
      }
      return null;
    },
  }),
  agentFinishSendingMessage: inputHandler({
    args: {
      agentId,
      conversationId,
      timestamp: v.number(),
      operationId: v.string(),
      leaveConversation: v.boolean(),
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        throw new Error(`Couldn't find agent: ${agentId}`);
      }
      const player = game.world.players.get(agent.playerId);
      if (!player) {
        throw new Error(`Couldn't find player: ${agent.playerId}`);
      }
      const conversationId = parseGameId('conversations', args.conversationId);
      const conversation = game.world.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`Couldn't find conversation: ${conversationId}`);
      }
      if (
        !agent.inProgressOperation ||
        agent.inProgressOperation.operationId !== args.operationId
      ) {
        console.debug(`Agent ${agentId} wasn't sending a message ${args.operationId}`);
        return null;
      }
      delete agent.inProgressOperation;
      conversationInputs.finishSendingMessage.handler(game, now, {
        playerId: agent.playerId,
        conversationId: args.conversationId,
        timestamp: args.timestamp,
      });
      if (args.leaveConversation) {
        conversation.leave(game, now, player);
      }
      return null;
    },
  }),
  createAgent: inputHandler({
    args: {
      descriptionIndex: v.number(),
    },
    handler: (game, now, args) => {
      const description = Descriptions[args.descriptionIndex];
      const playerId = Player.join(
        game,
        now,
        description.name,
        description.character,
        description.identity,
      );
      const agentId = game.allocId('agents');
      game.world.agents.set(
        agentId,
        new Agent({
          id: agentId,
          playerId: playerId,
          inProgressOperation: undefined,
          lastConversation: undefined,
          lastInviteAttempt: undefined,
          toRemember: undefined,
        }),
      );
      game.agentDescriptions.set(
        agentId,
        new AgentDescription({
          agentId: agentId,
          identity: description.identity,
          plan: description.plan,
        }),
      );
      return { agentId };
    },
  }),

  // Economy: Update player hunger/tokens after LLM call
  agentConsumeTokens: inputHandler({
    args: {
      playerId: v.string(),
      totalTokens: v.number(),
    },
    handler: (game, now, args) => {
      const playerGameId = parseGameId('players', args.playerId);
      const player = game.world.players.get(playerGameId);
      if (!player) {
        console.warn(`Player ${args.playerId} not found for token consumption`);
        return null;
      }
      player.consumeTokens(args.totalTokens);
      console.log(`Player ${args.playerId} consumed ${args.totalTokens} tokens: hunger=${player.hunger}, totalTokens=${player.totalTokensUsed}`);
      return null;
    },
  }),

  // Economy: Reset all players' hunger/money/tokens
  resetPlayerEconomy: inputHandler({
    args: {
      hunger: v.number(),
      money: v.number(),
    },
    handler: (game, now, args) => {
      for (const player of game.world.players.values()) {
        player.hunger = args.hunger;
        player.money = args.money;
        player.totalTokensUsed = 0;
      }
      console.log(`Reset all players: hunger=${args.hunger}, money=${args.money}`);
      return null;
    },
  }),

  // Economy: Agent buys food at the shop
  // Accepts optional position override for dynamic POI support
  agentBuyFood: inputHandler({
    args: {
      agentId,
      playerId: v.string(),
      poiPosition: v.optional(v.object({ x: v.number(), y: v.number() })),
      foodCost: v.optional(v.number()),
      hungerRestore: v.optional(v.number()),
    },
    handler: (game, now, args) => {
      const playerGameId = parseGameId('players', args.playerId);
      const player = game.world.players.get(playerGameId);
      if (!player) {
        throw new Error(`Player ${args.playerId} not found`);
      }
      const shopPos = args.poiPosition ?? SHOP_POSITION;
      const cost = args.foodCost ?? FOOD_COST;
      const restore = args.hungerRestore ?? FOOD_HUNGER_RESTORE;
      const dist = distance(player.position, shopPos);
      if (dist > INTERACTION_DISTANCE) {
        console.log(`Player ${args.playerId} too far from shop (${dist.toFixed(1)})`);
        return null;
      }
      if (player.money < cost) {
        console.log(`Player ${args.playerId} can't afford food (${player.money})`);
        return null;
      }
      player.money -= cost;
      player.hunger = Math.min(100, player.hunger + restore);
      console.log(`Player ${args.playerId} bought food: hunger=${player.hunger}, money=${player.money}`);
      return null;
    },
  }),

  // Economy: Agent works at the workplace
  agentWork: inputHandler({
    args: {
      agentId,
      playerId: v.string(),
      poiPosition: v.optional(v.object({ x: v.number(), y: v.number() })),
      workReward: v.optional(v.number()),
    },
    handler: (game, now, args) => {
      const playerGameId = parseGameId('players', args.playerId);
      const player = game.world.players.get(playerGameId);
      if (!player) {
        throw new Error(`Player ${args.playerId} not found`);
      }
      const workPos = args.poiPosition ?? WORKPLACE_POSITION;
      const reward = args.workReward ?? WORK_REWARD;
      const dist = distance(player.position, workPos);
      if (dist > INTERACTION_DISTANCE) {
        console.log(`Player ${args.playerId} too far from workplace (${dist.toFixed(1)})`);
        return null;
      }
      player.money += reward;
      console.log(`Player ${args.playerId} earned ${reward}: money=${player.money}`);
      return null;
    },
  }),
};
