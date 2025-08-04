

import React from 'react';
import { ResearchType, Resources, ResearchLevels, QueueItem, BuildingLevels } from '../types';
import { RESEARCH_DATA, BUILDING_DATA } from '../constants';
import ResearchRow from './ResearchRow';

interface ResearchPanelProps {
  research: ResearchLevels;
  buildings: BuildingLevels;
  resources: Resources;
  onUpgrade: (type: ResearchType) => void;
  buildQueue: QueueItem[];
  buildingQueueCapacity: number;
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

const ResearchPanel: React.FC<ResearchPanelProps> = ({ research, buildings, resources, onUpgrade, buildQueue, buildingQueueCapacity }) => {
  const labLevel = buildings['RESEARCH_LAB'];

  if (labLevel === 0) {
      return (
          <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-6 text-center">
              <h2 className="text-2xl font-bold text-cyan-300 mb-4">Badania</h2>
              <p className="text-gray-400">Musisz najpierw zbudować Laboratorium Badawcze, aby móc prowadzić badania.</p>
          </div>
      )
  }

  const isQueueFull = buildQueue.length >= buildingQueueCapacity;

  return (
    <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-4 md:p-6">
      <h2 className="text-2xl font-bold text-cyan-300 mb-6 border-b-2 border-cyan-800 pb-3">Dostępne Badania (Lab. poz. {labLevel})</h2>
      <div className="space-y-6">
        {(Object.keys(RESEARCH_DATA) as ResearchType[]).map((type) => {
          const level = research[type];
          const data = RESEARCH_DATA[type];
          const cost = data.cost(level + 1);
          const canAfford = resources.metal >= cost.metal && resources.crystal >= cost.crystal && resources.deuterium >= cost.deuterium;
          const isQueued = buildQueue.some(item => item.id === type);
          const requirementsMet = checkRequirements(data.requirements, buildings, research);

          return (
            <ResearchRow
              key={type}
              type={type}
              level={level}
              onUpgrade={onUpgrade}
              canAfford={canAfford}
              isQueued={isQueued}
              isQueueFull={isQueueFull}
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

export default ResearchPanel;