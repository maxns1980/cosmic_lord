
import React from 'react';
import { DefenseType, Resources, ResearchLevels, QueueItem, BuildingLevels, Defenses } from '../types';
import { DEFENSE_DATA } from '../constants';
import DefenseRow from './DefenseRow';

interface DefensePanelProps {
  research: ResearchLevels;
  buildings: BuildingLevels;
  resources: Resources;
  onBuild: (type: DefenseType, amount: number) => void;
  buildQueue: QueueItem[];
  defenses: Defenses;
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

const DefensePanel: React.FC<DefensePanelProps> = ({ research, buildings, resources, onBuild, buildQueue, defenses }) => {
  const shipyardLevel = buildings['SHIPYARD'];

  if (shipyardLevel === 0) {
      return (
          <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-6 text-center">
              <h2 className="text-2xl font-bold text-cyan-300 mb-4">Obrona</h2>
              <p className="text-gray-400">Musisz najpierw zbudować Stocznię, aby produkować systemy obronne.</p>
          </div>
      )
  }

  return (
    <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-4 md:p-6">
      <h2 className="text-2xl font-bold text-cyan-300 mb-6 border-b-2 border-cyan-800 pb-3">Systemy Obronne (Stocznia poz. {shipyardLevel})</h2>
      <div className="space-y-6">
        {(Object.keys(DEFENSE_DATA) as DefenseType[]).map((type) => {
          const data = DEFENSE_DATA[type];
          const requirementsMet = checkRequirements(data.requirements, buildings, research);

          return (
            <DefenseRow
              key={type}
              type={type}
              onBuild={onBuild}
              resources={resources}
              isQueued={buildQueue.some(item => item.id === type)}
              requirementsMet={requirementsMet}
              amountOwned={defenses[type] || 0}
              buildings={buildings}
              research={research}
            />
          );
        })}
      </div>
    </div>
  );
};

export default DefensePanel;
