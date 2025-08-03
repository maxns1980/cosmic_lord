
import React, { useState } from 'react';
import { BuildingType, Resources, BuildingLevels, QueueItem, ResearchLevels, ResearchType, BuildingCategory } from '../types';
import { BUILDING_DATA } from '../constants';
import BuildingRow from './BuildingRow';

interface BuildingsPanelProps {
  buildings: BuildingLevels;
  research: ResearchLevels;
  resources: Resources;
  onUpgrade: (type: BuildingType) => void;
  onDestroy: (type: BuildingType) => void;
  buildQueue: QueueItem[];
  energyEfficiency: number;
  isMoon: boolean;
  usedFields: number;
  maxFields: number;
}

const checkRequirements = (requirements: any, buildings: BuildingLevels, research: ResearchLevels) => {
    if (!requirements) return true;
    return Object.entries(requirements).every(([reqId, reqLevel]) => {
        if (reqId in buildings) {
            return buildings[reqId as BuildingType] >= (reqLevel as number);
        }
        if (reqId in research) {
            return research[reqId as ResearchType] >= (reqLevel as number);
        }
        return false;
    });
}

const BuildingsPanel: React.FC<BuildingsPanelProps> = ({ buildings, research, resources, onUpgrade, onDestroy, buildQueue, energyEfficiency, isMoon, usedFields, maxFields }) => {
  const [activeCategory, setActiveCategory] = useState<BuildingCategory>(isMoon ? BuildingCategory.INDUSTRIAL : BuildingCategory.RESOURCE);
  
  const buildingContext = isMoon ? 'MOON' : 'PLANET';

  const categories = [
      { id: BuildingCategory.RESOURCE, label: "Surowcowe", showOn: 'PLANET' },
      { id: BuildingCategory.INDUSTRIAL, label: "Przemysłowe", showOn: 'BOTH' },
      { id: BuildingCategory.STORAGE, label: "Magazyny", showOn: 'BOTH' }
  ];

  const availableCategories = categories.filter(c => c.showOn === 'BOTH' || (isMoon && c.showOn === 'MOON') || (!isMoon && c.showOn === 'PLANET'));

  const fieldsUsage = maxFields > 0 ? usedFields / maxFields : 0;
  let fieldsColor = 'text-cyan-300';
  if (fieldsUsage >= 1) {
    fieldsColor = 'text-red-500 animate-pulse';
  } else if (fieldsUsage > 0.9) {
    fieldsColor = 'text-yellow-400';
  }

  return (
    <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-4 md:p-6">
      <div className="flex justify-between items-center mb-4 border-b-2 border-cyan-800 pb-3">
        <h2 className="text-2xl font-bold text-cyan-300">{isMoon ? 'Zarządzanie Księżycem' : 'Budynki'}</h2>
        <div className="text-right">
          <span className="text-sm font-semibold text-gray-400">Pola</span>
          <p className={`text-lg font-bold ${fieldsColor}`}>{usedFields} / {maxFields}</p>
        </div>
      </div>
      
      <div className="flex mb-6 border-b border-gray-600">
          {availableCategories.map(category => (
              <button 
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-4 py-2 text-base font-semibold transition-colors duration-200 -mb-px border-b-2
                    ${activeCategory === category.id
                        ? 'text-cyan-300 border-cyan-400'
                        : 'text-gray-400 border-transparent hover:text-white hover:border-gray-500'
                    }`}
              >
                  {category.label}
              </button>
          ))}
      </div>

      <div className="space-y-6">
        {(Object.keys(BUILDING_DATA) as BuildingType[])
        .filter(type => {
            const data = BUILDING_DATA[type];
            const buildableOn = data.buildableOn || ['PLANET', 'MOON'];
            return data.category === activeCategory && buildableOn.includes(buildingContext);
        })
        .map((type) => {
          const level = buildings[type];
          const data = BUILDING_DATA[type];
          const cost = data.cost(level + 1);
          const canAfford = resources.metal >= cost.metal && resources.crystal >= cost.crystal && resources.deuterium >= cost.deuterium;
          const isQueued = buildQueue.some(item => item.id === type);
          const requirementsMet = checkRequirements(data.requirements, buildings, research);

          return (
            <BuildingRow
              key={type}
              type={type}
              level={level}
              onUpgrade={onUpgrade}
              onDestroy={onDestroy}
              canAfford={canAfford}
              isQueued={isQueued}
              requirementsMet={requirementsMet}
              allBuildings={buildings}
              allResearch={research}
              energyEfficiency={energyEfficiency}
              resources={resources}
            />
          );
        })}
      </div>
    </div>
  );
};

export default BuildingsPanel;
