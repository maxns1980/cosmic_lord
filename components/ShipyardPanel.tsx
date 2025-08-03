

import React from 'react';
import { ShipType, Resources, ResearchLevels, QueueItem, BuildingLevels, Fleet, ShipLevels } from '../types';
import { SHIPYARD_DATA, ALL_SHIP_DATA } from '../constants';
import ShipRow from './ShipRow';

interface ShipyardPanelProps {
  research: ResearchLevels;
  buildings: BuildingLevels;
  resources: Resources;
  onBuild: (type: ShipType, amount: number) => void;
  buildQueue: QueueItem[];
  fleet: Fleet;
  shipLevels: ShipLevels;
}

const checkRequirements = (requirements: any, buildings: BuildingLevels, research: ResearchLevels) => {
    if (!requirements) return true;
    return Object.entries(requirements).every(([reqId, reqLevel]) => {
        if (reqId in buildings) {
            return buildings[reqId as keyof BuildingLevels] >= (reqLevel as number);
        }
        if (reqId in research) {
            return research[reqId as keyof ResearchLevels] >= (reqLevel as number);
        }
        return false;
    });
}

const ShipyardPanel: React.FC<ShipyardPanelProps> = ({ research, buildings, resources, onBuild, buildQueue, fleet, shipLevels }) => {
  const shipyardLevel = buildings['SHIPYARD'];

  if (shipyardLevel === 0) {
      return (
          <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-6 text-center">
              <h2 className="text-2xl font-bold text-cyan-300 mb-4">Stocznia</h2>
              <p className="text-gray-400">Musisz najpierw zbudować Stocznię, aby produkować statki i obronę.</p>
          </div>
      )
  }

  const buildableShips = Object.keys(SHIPYARD_DATA) as (keyof typeof SHIPYARD_DATA)[];

  return (
    <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-4 md:p-6">
      <h2 className="text-2xl font-bold text-cyan-300 mb-6 border-b-2 border-cyan-800 pb-3">Dostępne Jednostki (Stocznia poz. {shipyardLevel})</h2>
      <div className="space-y-6">
        {buildableShips.map((type) => {
          const data = ALL_SHIP_DATA[type];
          const requirementsMet = checkRequirements(data.requirements, buildings, research);

          return (
            <ShipRow
              key={type}
              type={type}
              onBuild={onBuild}
              resources={resources}
              isQueued={buildQueue.some(item => item.id === type)}
              requirementsMet={requirementsMet}
              amountOwned={fleet[type] || 0}
              buildings={buildings}
              research={research}
              shipLevels={shipLevels}
            />
          );
        })}
      </div>
    </div>
  );
};

export default ShipyardPanel;