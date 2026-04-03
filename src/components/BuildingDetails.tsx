import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import closeImg from '../../assets/close.svg';
import { SelectElement } from './Player';
import { ServerGame } from '../hooks/serverGame';
import { INTERACTION_DISTANCE } from '../../convex/constants';
import { distance } from '../../convex/util/geometry';

const FURNITURE_TYPE_COLORS: Record<string, string> = {
  interact: 'text-blue-400',
  decor: 'text-yellow-600',
  blocked: 'text-red-400',
  work: 'text-blue-400',
  spawn: 'text-green-400',
  exit: 'text-red-300',
};

const INTERIOR_IMAGES: Record<string, string> = {
  shop: '/ai-town/assets/shop_interior.png',
  workplace: '/ai-town/assets/work_interior.png',
};

const BUILDING_INFO: Record<string, { title: string; desc: string; emoji: string }> = {
  shop: {
    title: 'General Store',
    desc: 'Buy food to restore hunger. Fresh supplies daily!',
    emoji: '🏪',
  },
  workplace: {
    title: 'Workshop',
    desc: 'Work here to earn money. Hard work pays off!',
    emoji: '🏢',
  },
};

export default function BuildingDetails({
  worldId,
  buildingName,
  game,
  setSelectedElement,
}: {
  worldId: Id<'worlds'>;
  buildingName: string;
  game: ServerGame;
  setSelectedElement: SelectElement;
}) {
  const pois = useQuery(api.map.listPOI, { worldId });
  const poi = pois?.find((p) => p.name === buildingName);
  const info = BUILDING_INFO[buildingName] ?? {
    title: buildingName,
    desc: 'A point of interest.',
    emoji: '📍',
  };
  const interiorImg = INTERIOR_IMAGES[buildingName];

  // Query scene furniture from DB
  const sceneName = buildingName === 'shop' ? 'shop_interior' : buildingName === 'workplace' ? 'workplace_interior' : null;
  const sceneFurniture = useQuery(
    api.scene.getFurniture,
    sceneName ? { worldId, sceneName } : 'skip',
  );

  // Find agents near this building
  const players = [...game.world.players.values()];
  const playerDescs = game.playerDescriptions;
  const nearbyPlayers = poi
    ? players.filter((p) => distance(p.position, poi.position) < INTERACTION_DISTANCE * 2)
    : [];

  return (
    <>
      {/* Header */}
      <div className="flex gap-4">
        <div className="box w-3/4 sm:w-full mr-auto">
          <h2 className="bg-brown-700 p-2 font-display text-2xl sm:text-4xl tracking-wider shadow-solid text-center">
            {info.emoji} {info.title}
          </h2>
        </div>
        <a
          className="button text-white shadow-solid text-2xl cursor-pointer pointer-events-auto"
          onClick={() => setSelectedElement(undefined)}
        >
          <h2 className="h-full bg-clay-700">
            <img className="w-4 h-4 sm:w-5 sm:h-5" src={closeImg} />
          </h2>
        </a>
      </div>

      {/* Interior Scene */}
      {interiorImg && (
        <div className="box mt-4">
          <div className="bg-brown-900 p-1 flex justify-center">
            <img
              src={interiorImg}
              alt={`${buildingName} interior`}
              className="w-full max-w-[320px] image-rendering-pixelated"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        </div>
      )}

      {/* Building Info */}
      <div className="desc my-4">
        <p className="leading-tight -m-4 bg-brown-700 text-base sm:text-sm">
          {info.desc}
        </p>
      </div>

      {/* POI Config */}
      {poi?.config && (
        <div className="box my-4">
          <div className="bg-brown-700 p-2 text-sm">
            {poi.type === 'shop' && (
              <>
                <div className="flex justify-between mb-1">
                  <span>Food price:</span>
                  <span className="text-yellow-300 font-bold">${poi.config.foodCost}</span>
                </div>
                <div className="flex justify-between">
                  <span>Hunger restored:</span>
                  <span className="text-green-400 font-bold">+{poi.config.hungerRestore}</span>
                </div>
              </>
            )}
            {poi.type === 'workplace' && (
              <>
                <div className="flex justify-between mb-1">
                  <span>Work reward:</span>
                  <span className="text-yellow-300 font-bold">${poi.config.workReward}</span>
                </div>
                <div className="flex justify-between">
                  <span>Work duration:</span>
                  <span className="text-blue-300">{(poi.config.workDuration / 1000).toFixed(0)}s</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Location */}
      {poi && (
        <div className="box my-4">
          <h2 className="bg-brown-700 text-sm text-center p-1">
            Location: ({poi.position.x}, {poi.position.y})
          </h2>
        </div>
      )}

      {/* Scene Furniture from DB */}
      {sceneFurniture && sceneFurniture.length > 0 && (
        <>
          <div className="box my-4">
            <h2 className="bg-brown-700 text-lg text-center">Furniture ({sceneFurniture.length})</h2>
          </div>
          <div className="box my-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <div className="bg-brown-700 p-2 text-xs">
              {sceneFurniture.map((f: any, i: number) => (
                <div key={i} className="flex justify-between py-0.5 border-b border-brown-600">
                  <span>
                    <span className={FURNITURE_TYPE_COLORS[f.type] || 'text-gray-400'}>[{f.type}]</span>
                    {' '}{f.name}
                  </span>
                  <span className="text-gray-400">
                    ({f.x},{f.y}) {f.action ? `→ ${f.action}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Nearby Agents */}
      <div className="box my-4">
        <h2 className="bg-brown-700 text-lg text-center">
          {nearbyPlayers.length > 0 ? 'Agents Inside' : 'No agents nearby'}
        </h2>
      </div>
      {nearbyPlayers.map((p) => {
        const desc = playerDescs.get(p.id);
        return (
          <div
            key={p.id}
            className="box my-2 cursor-pointer hover:opacity-80"
            onClick={() => setSelectedElement({ kind: 'player', id: p.id })}
          >
            <div className="bg-brown-700 p-2 text-sm flex justify-between items-center">
              <span className="font-bold">{desc?.name ?? p.id}</span>
              <span className="text-xs opacity-70">{p.activity?.emoji} {p.activity?.description}</span>
            </div>
          </div>
        );
      })}
    </>
  );
}
