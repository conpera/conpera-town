import { ObjectType, v } from 'convex/values';
import { GameId, parseGameId, playerId } from './ids';

export const serializedPlayerDescription = {
  playerId,
  name: v.string(),
  description: v.string(),
  character: v.string(),
  active: v.optional(v.boolean()),
};
export type SerializedPlayerDescription = ObjectType<typeof serializedPlayerDescription>;

export class PlayerDescription {
  playerId: GameId<'players'>;
  name: string;
  description: string;
  character: string;
  active: boolean;

  constructor(serialized: SerializedPlayerDescription) {
    const { playerId, name, description, character, active } = serialized;
    this.playerId = parseGameId('players', playerId);
    this.name = name;
    this.description = description;
    this.character = character;
    this.active = active ?? true;
  }

  serialize(): SerializedPlayerDescription {
    const { playerId, name, description, character, active } = this;
    return {
      playerId,
      name,
      description,
      character,
      active,
    };
  }
}
