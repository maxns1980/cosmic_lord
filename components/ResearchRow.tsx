


import React from 'react';
import { ResearchType, Resources, QueueItem, BuildingLevels, ResearchLevels, BuildingType } from '../types';
import { RESEARCH_DATA, ALL_GAME_OBJECTS } from '../constants';

interface ResearchRowProps {
  type: ResearchType;
  level: number;
  onUpgrade: (type: ResearchType) => void;
  canAfford: boolean;
  isQueued: boolean;
  isQueueFull: boolean;
  requirementsMet: boolean;
  buildings: BuildingLevels;
  research: ResearchLevels;
  resources: Resources;
}

const formatNumber = (num: number): string => {
    return Math.floor(num).toLocaleString('pl-PL');
};

const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const CostDisplay: React.FC<{ cost: Resources; available: Resources }> = ({ cost, available }) => {
    const renderResource = (resKey: keyof Resources, icon: string, name: string) => {
        const resCost = cost[resKey];
        if (!resCost || resCost <= 0) return null;
        const hasEnough = available[resKey] >= resCost;
        const textColorClass = hasEnough ? 'text-green-400' : 'text-red-500';

        return (
            <span key={resKey} className={`flex items-center ${textColorClass}`}>
                {icon}<span className="ml-1">{name}:</span><span className="ml-2 font-mono">{formatNumber(resCost)}</span>
            </span>
        );
    };

    const costs = [
        renderResource('metal', '🔩', 'Metal'),
        renderResource('crystal', '💎', 'Kryształ'),
        renderResource('deuterium', '💧', 'Deuter'),
    ].filter(Boolean);

    if (costs.length === 0) return <span>-</span>;
    
    return (
        <div className="flex flex-col md:flex-row md:space-x-4 text-sm">
            {costs}
        </div>
    );
};

const RequirementsDisplay: React.FC<{ 
    requirements?: Partial<BuildingLevels & ResearchLevels>,
    currentBuildings: BuildingLevels,
    currentResearch: ResearchLevels
}> = ({ requirements, currentBuildings, currentResearch }) => {
    if (!requirements || Object.keys(requirements).length === 0) return null;
    
    const requirementItems = Object.entries(requirements).map(([reqId, reqLevel]) => {
        const reqInfo = ALL_GAME_OBJECTS[reqId as keyof typeof ALL_GAME_OBJECTS];
        const isBuilding = Object.values(BuildingType).includes(reqId as BuildingType);
        
        const isMet = isBuilding 
            ? currentBuildings[reqId as BuildingType] >= (reqLevel as number)
            : currentResearch[reqId as ResearchType] >= (reqLevel as number);

        return (
            <span key={reqId} className={isMet ? 'line-through text-gray-500' : 'text-amber-400'}>
                {reqInfo.name} (poz. {reqLevel})
            </span>
        );
    });

    return (
        <div className="text-xs mt-1">
            <strong className="text-gray-400 mr-1">Wymagania:</strong>
            {requirementItems.map((item, index) => (
                <React.Fragment key={index}>
                    {item}
                    {index < requirementItems.length - 1 && ', '}
                </React.Fragment>
            ))}
        </div>
    );
};


const ResearchRow: React.FC<ResearchRowProps> = ({ type, level, onUpgrade, canAfford, isQueued, isQueueFull, requirementsMet, buildings, research, resources }) => {
  const data = RESEARCH_DATA[type];
  const cost = data.cost(level + 1);
  const isDisabled = isQueued || !canAfford || !requirementsMet || (isQueueFull && !isQueued);
  
  const researchLabLevel = buildings[BuildingType.RESEARCH_LAB];
  const timeFactor = (1 + researchLabLevel);
  const buildTimeSeconds = data.buildTime(level + 1) / timeFactor;
  
  let buttonText = 'Badaj';
  if (isQueued) buttonText = 'W kolejce...';
  else if (isQueueFull) buttonText = 'Kolejka pełna';
  else if (!requirementsMet) buttonText = 'Brak wymagań';

  return (
    <div className={`flex flex-col md:flex-row items-center justify-between bg-gray-900 bg-opacity-50 p-4 rounded-lg border border-gray-700 transition-all duration-300 ${!isDisabled && 'hover:border-cyan-600'}`}>
      <div className="flex-1 mb-4 md:mb-0">
        <h3 className="text-xl font-bold text-white flex items-center">
          <span className="text-2xl mr-3">{data.icon}</span>
          {data.name} <span className="ml-3 text-lg font-normal text-cyan-400">(Poziom {level})</span>
        </h3>
        <p className="text-gray-400 mt-1 text-sm">{data.description}</p>
        <RequirementsDisplay requirements={data.requirements} currentBuildings={buildings} currentResearch={research} />
      </div>
      <div className="flex flex-col items-start md:items-end w-full md:w-auto">
        <div className="mb-2 w-full text-left md:text-right">
            <p className="text-sm font-semibold text-gray-400">Wymagania do poz. {level + 1}:</p>
            <div className="space-y-1">
                <CostDisplay cost={cost} available={resources} />
                <div className="flex items-center justify-start md:justify-end text-sm">
                    <span className="text-gray-400 mr-2">Czas badania:</span>
                    <span className="font-mono text-white">{formatTime(buildTimeSeconds)}</span>
                </div>
            </div>
        </div>
        <button
          onClick={() => onUpgrade(type)}
          disabled={isDisabled}
          className={`w-full md:w-auto px-6 py-2 text-base font-bold text-white rounded-md shadow-md transition-all duration-300 transform
            ${!isDisabled
              ? 'bg-cyan-600 hover:bg-cyan-500 focus:ring-4 focus:ring-cyan-400 focus:ring-opacity-50 hover:scale-105'
              : 'bg-gray-600 cursor-not-allowed opacity-70'
            }`}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};

export default ResearchRow;