import React from 'react';
import { ShipType, Resources, BuildingLevels, ResearchLevels, BuildingType, ResearchType } from '../types';
import { SHIP_UPGRADE_DATA, ALL_SHIP_DATA, ALL_GAME_OBJECTS } from '../constants';

interface FleetUpgradesRowProps {
  type: ShipType;
  level: number;
  onUpgrade: (type: ShipType) => void;
  canAfford: boolean;
  isQueued: boolean;
  requirementsMet: boolean;
  buildings: BuildingLevels;
  research: ResearchLevels;
  resources: Resources;
}

const MAX_UPGRADE_LEVEL = 5;

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

const FleetUpgradesRow: React.FC<FleetUpgradesRowProps> = ({ type, level, onUpgrade, canAfford, isQueued, requirementsMet, buildings, research, resources }) => {
  const upgradeData = SHIP_UPGRADE_DATA[type];
  const shipData = ALL_SHIP_DATA[type];
  const nextLevel = level + 1;
  const cost = upgradeData.cost(nextLevel);
  
  const researchLabLevel = buildings[BuildingType.RESEARCH_LAB];
  const timeFactor = (1 + researchLabLevel);
  const buildTimeSeconds = upgradeData.buildTime(nextLevel) / timeFactor;
  
  const isMaxLevel = level >= MAX_UPGRADE_LEVEL;
  const isDisabled = isQueued || !canAfford || !requirementsMet || isMaxLevel;
  
  let buttonText = 'Ulepsz';
  if (isMaxLevel) buttonText = 'Maks. Poziom';
  else if (isQueued) buttonText = 'W kolejce...';
  else if (!requirementsMet) buttonText = 'Brak wymagań';

  const isTransport = [
      ShipType.CARGO_SHIP,
      ShipType.MEDIUM_CARGO_SHIP,
      ShipType.HEAVY_CARGO_SHIP,
      ShipType.RECYCLER,
      ShipType.COLONY_SHIP,
      ShipType.RESEARCH_VESSEL
  ].includes(type);

  return (
    <div className={`flex flex-col md:flex-row items-center justify-between bg-gray-900 bg-opacity-50 p-4 rounded-lg border border-gray-700 transition-all duration-300 ${!isDisabled && 'hover:border-cyan-600'}`}>
      <div className="flex-1 mb-4 md:mb-0">
        <h3 className="text-xl font-bold text-white flex items-center">
          <span className="text-2xl mr-3">{shipData.icon}</span>
          {shipData.name} 
          <span className="ml-3 text-lg font-normal text-cyan-400 flex items-center gap-1">
            {level > 0 && Array.from({ length: level }).map((_, i) => <span key={i}>★</span>)}
            (Poziom {level} / {MAX_UPGRADE_LEVEL})
          </span>
        </h3>
        <p className="text-gray-400 mt-1 text-sm">{upgradeData.description}</p>
        {level > 0 && (
            <div className="text-sm mt-1">
                <p className="text-green-400">Bonus na obecnym poziomie: +{level * 10}% do ataku, tarcz i struktury.</p>
                {isTransport && <p className="text-yellow-300 font-semibold">Bonus do ładowności: +{level * 10}%.</p>}
            </div>
        )}
        <RequirementsDisplay requirements={upgradeData.requirements} currentBuildings={buildings} currentResearch={research} />
      </div>
      <div className="flex flex-col items-start md:items-end w-full md:w-auto">
        {!isMaxLevel ? (
            <>
                <div className="mb-2 w-full text-left md:text-right">
                    <p className="text-sm font-semibold text-gray-400">Wymagania do poz. {nextLevel}:</p>
                    <div className="space-y-1">
                        <CostDisplay cost={cost} available={resources} />
                        <div className="flex items-center justify-start md:justify-end text-sm">
                            <span className="text-gray-400 mr-2">Czas ulepszenia:</span>
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
            </>
        ) : (
             <p className="text-green-400 font-bold">Ulepszenie na maksymalnym poziomie</p>
        )}
      </div>
    </div>
  );
};

export default FleetUpgradesRow;