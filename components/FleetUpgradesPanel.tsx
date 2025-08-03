

import React from 'react';
import { ShipType, Resources, ResearchLevels, QueueItem, BuildingLevels, ShipLevels } from '../types';
import { SHIP_UPGRADE_DATA, SHIPYARD_DATA } from '../constants';
import FleetUpgradesRow from './FleetUpgradesRow';

interface FleetUpgradesPanelProps {
  research: ResearchLevels;
  buildings: BuildingLevels;
  shipLevels: ShipLevels;
  resources: Resources;
  onUpgrade: (type: ShipType) => void;
  buildQueue: QueueItem[];
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

const FleetUpgradesPanel: React.FC<FleetUpgradesPanelProps> = ({ research, buildings, shipLevels, resources, onUpgrade, buildQueue }) => {
  const labLevel = buildings['RESEARCH_LAB'];

  if (labLevel < 4) {
      return (
          <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-6 text-center">
              <h2 className="text-2xl font-bold text-cyan-300 mb-4">Ulepszenia Floty</h2>
              <p className="text-gray-400">Musisz najpierw rozbudować Laboratorium Badawcze do poziomu 4, aby móc ulepszać statki.</p>
          </div>
      )
  }

  return (
    <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-4 md:p-6">
      <h2 className="text-2xl font-bold text-cyan-300 mb-6 border-b-2 border-cyan-800 pb-3">Dostępne Ulepszenia Statków</h2>
      <div className="space-y-6">
        {(Object.keys(SHIP_UPGRADE_DATA) as ShipType[])
        .filter(type => type !== ShipType.SHADOW_CORSAIR)
        .map((type) => {
          const level = shipLevels[type];
          const data = SHIP_UPGRADE_DATA[type];
          const cost = data.cost(level + 1);
          const canAfford = resources.metal >= cost.metal && resources.crystal >= cost.crystal && resources.deuterium >= cost.deuterium;
          const isQueued = buildQueue.some(item => ['building', 'research', 'ship_upgrade'].includes(item.type));
          const requirementsMet = checkRequirements(data.requirements, buildings, research);

          return (
            <FleetUpgradesRow
              key={type}
              type={type}
              level={level}
              onUpgrade={onUpgrade}
              canAfford={canAfford}
              isQueued={isQueued}
              requirementsMet={requirementsMet}
              buildings={buildings}
              research={research}
              resources={resources}
            />
          );
        })}
      </div>
    </div>
  );
};

export default FleetUpgradesPanel;
