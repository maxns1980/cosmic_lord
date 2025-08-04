


import React from 'react';
import { BuildingType, Resources, QueueItem, BuildingLevels, ResearchLevels, ResearchType, BuildingCategory } from '../types';
import { BUILDING_DATA, ALL_GAME_OBJECTS, PROTECTED_RESOURCES_FACTOR } from '../constants';

interface BuildingRowProps {
  type: BuildingType;
  level: number;
  onUpgrade: (type: BuildingType) => void;
  onDestroy: (type: BuildingType) => void;
  canAfford: boolean;
  isQueued: boolean;
  isQueueFull: boolean;
  requirementsMet: boolean;
  allBuildings: BuildingLevels;
  allResearch: ResearchLevels;
  energyEfficiency: number;
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
        
        const hasEnough = !available || available[resKey] >= resCost;
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

const BuildingRow: React.FC<BuildingRowProps> = ({ type, level, onUpgrade, onDestroy, canAfford, isQueued, isQueueFull, requirementsMet, allBuildings, allResearch, energyEfficiency, resources }) => {
  const data = BUILDING_DATA[type];
  const cost = data.cost(level + 1);
  const isDisabled = isQueued || !canAfford || !requirementsMet || (isQueueFull && !isQueued);
  
  const buildTimeSeconds = data.buildTime(level + 1);

  let buttonText = 'Rozbuduj';
  if (isQueued) buttonText = 'W kolejce...';
  else if (isQueueFull) buttonText = 'Kolejka pełna';
  else if (!requirementsMet) buttonText = 'Brak wymagań';
  
  const isBlackMarket = type === BuildingType.BLACK_MARKET;

  const currentCapacity = data.capacity ? data.capacity(level) : 0;
  const nextCapacity = data.capacity ? data.capacity(level + 1) : 0;

  const currentEnergyConsumption = data.energyConsumption ? data.energyConsumption(level) : 0;
  const nextEnergyConsumption = data.energyConsumption ? data.energyConsumption(level + 1) : 0;
  const energyConsumptionIncrease = nextEnergyConsumption - currentEnergyConsumption;
  
  const energyTechLevel = allResearch[ResearchType.ENERGY_TECHNOLOGY] || 0;
  const energyTechBonus = 1 + (energyTechLevel * 0.02);

  const currentEnergyProduction = data.production && (type === BuildingType.SOLAR_PLANT || type === BuildingType.FUSION_REACTOR) ? data.production(level) * energyTechBonus : 0;
  const nextEnergyProduction = data.production && (type === BuildingType.SOLAR_PLANT || type === BuildingType.FUSION_REACTOR) ? data.production(level + 1) * energyTechBonus : 0;
  const energyProductionIncrease = nextEnergyProduction - currentEnergyProduction;

  const isResourceMine = data.category === BuildingCategory.RESOURCE && data.production && type !== BuildingType.SOLAR_PLANT && type !== BuildingType.FUSION_REACTOR;
  const currentProduction = isResourceMine && data.production ? data.production(level) * energyEfficiency : 0;
  const nextLevelProduction = isResourceMine && data.production ? data.production(level + 1) * energyEfficiency : 0;
  const productionIncrease = nextLevelProduction - currentProduction;

  const currentDeuteriumConsumption = data.deuteriumConsumption ? data.deuteriumConsumption(level) : 0;
  const nextDeuteriumConsumption = data.deuteriumConsumption ? data.deuteriumConsumption(level + 1) : 0;
  const deuteriumConsumptionIncrease = nextDeuteriumConsumption - currentDeuteriumConsumption;

  const minLevelToDestroy = [
      BuildingType.METAL_MINE,
      BuildingType.CRYSTAL_MINE,
      BuildingType.SOLAR_PLANT,
  ].includes(type) ? 2 : 1;

  const canBeDestroyed = level >= minLevelToDestroy;

  return (
    <div className={`flex flex-col md:flex-row items-center justify-between bg-gray-900 bg-opacity-50 p-4 rounded-lg border border-gray-700 transition-all duration-300 ${!isDisabled && 'hover:border-cyan-600'}`}>
      <div className="flex-1 mb-4 md:mb-0 flex items-start w-full">
         {data.image && (
            <img src={data.image} alt={data.name} className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-lg shadow-md mr-4 flex-shrink-0" />
          )}
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white flex items-center">
              {!data.image && <span className="text-2xl mr-3">{data.icon}</span>}
              {data.name} <span className="ml-3 text-lg font-normal text-cyan-400">(Poziom {level})</span>
            </h3>
            <p className="text-gray-400 mt-1 text-sm">{data.description}</p>
             {isResourceMine && level > 0 && (
                <p className="text-sm text-gray-300 mt-1">
                    Produkcja: 
                    <span className="font-semibold text-green-400 ml-1">{formatNumber(currentProduction)}/h</span>
                    <span className="text-green-300 ml-1" title="Zwiększenie produkcji po rozbudowie">
                        (+{formatNumber(productionIncrease)} na nast. poz.)
                    </span>
                </p>
            )}
            {data.production && (type === BuildingType.SOLAR_PLANT || type === BuildingType.FUSION_REACTOR) && (
                <p className="text-sm text-gray-300 mt-1">
                    Produkcja energii: 
                    <span className="font-semibold text-yellow-400 ml-1">{formatNumber(currentEnergyProduction)}</span>
                    <span className="text-green-400 ml-1"> (+
                    {formatNumber(energyProductionIncrease)} na nast. poz.)</span>
                </p>
            )}
             {isBlackMarket && (
              <>
                {level > 0 && (
                  <p className="text-sm text-gray-300 mt-1">
                      Zakres dochodu (poz. {level}): 
                      <span className="font-semibold text-green-400 ml-1">
                          {formatNumber(50 * Math.pow(1.1, level - 1))} - {formatNumber(200 * Math.pow(1.1, level - 1))} 💰/h
                      </span>
                  </p>
                )}
                <p className="text-sm text-gray-300 mt-1">
                    Zakres dochodu (poz. {level + 1}): 
                    <span className="font-semibold text-green-400 ml-1">
                        {formatNumber(50 * Math.pow(1.1, level))} - {formatNumber(200 * Math.pow(1.1, level))} 💰/h
                    </span>
                </p>
              </>
            )}
            {data.capacity && type !== BuildingType.ENERGY_STORAGE && (
                <p className="text-sm text-gray-300 mt-1">
                    Pojemność: <span className="font-semibold text-cyan-400">{formatNumber(currentCapacity)}</span> 
                    <span className="text-green-400 ml-2">(+{formatNumber(nextCapacity - currentCapacity)} na nast. poz.)</span>
                </p>
            )}
            {data.capacity && type === BuildingType.ENERGY_STORAGE && (
                 <p className="text-sm text-gray-300 mt-1">
                    Pojemność energii: <span className="font-semibold text-yellow-400">{formatNumber(currentCapacity)}</span> 
                    <span className="text-green-400 ml-2">(+{formatNumber(nextCapacity - currentCapacity)} na nast. poz.)</span>
                </p>
            )}
            {data.category === 'STORAGE' && data.capacity && type !== BuildingType.ENERGY_STORAGE && (
                <p className="text-sm text-gray-300 mt-1">
                    Chronione surowce: <span className="font-semibold text-teal-400">{formatNumber(currentCapacity * PROTECTED_RESOURCES_FACTOR)}</span> 
                    <span className="text-green-400 ml-2">(+
                    {formatNumber((nextCapacity - currentCapacity) * PROTECTED_RESOURCES_FACTOR)} na nast. poz.)</span>
                </p>
            )}
            {data.energyConsumption && (
              <p className="text-sm text-gray-300 mt-1">
                Pobór energii: 
                {level > 0 && <span className="font-semibold text-yellow-400 ml-1">{formatNumber(currentEnergyConsumption)}</span>}
                <span className="text-red-400 ml-2">(+{formatNumber(energyConsumptionIncrease)} na nast. poz.)</span>
              </p>
            )}
            {data.deuteriumConsumption && (
              <p className="text-sm text-gray-300 mt-1">
                Zużycie deuteru: 
                {level > 0 && <span className="font-semibold text-purple-400 ml-1">{formatNumber(currentDeuteriumConsumption)}/h</span>}
                <span className="text-red-400 ml-2">(+{formatNumber(deuteriumConsumptionIncrease)} na nast. poz.)</span>
              </p>
            )}
            <RequirementsDisplay requirements={data.requirements} currentBuildings={allBuildings} currentResearch={allResearch} />
        </div>
      </div>
      <div className="flex flex-col items-start md:items-end w-full md:w-auto md:ml-4">
        <div className="mb-2 w-full text-left md:text-right">
            <p className="text-sm font-semibold text-gray-400">Wymagania do poz. {level + 1}:</p>
             <div className="space-y-1">
                <CostDisplay cost={cost} available={resources} />
                 <div className="flex items-center justify-start md:justify-end text-sm">
                    <span className="text-gray-400 mr-2">Czas budowy:</span>
                    <span className="font-mono text-white">{formatTime(buildTimeSeconds)}</span>
                </div>
            </div>
        </div>
        <div className="flex items-stretch gap-2 w-full md:w-auto">
            <button
                onClick={() => onUpgrade(type)}
                disabled={isDisabled}
                className={`flex-grow w-full md:w-auto px-6 py-2 text-base font-bold text-white rounded-md shadow-md transition-all duration-300 transform
                    ${!isDisabled
                    ? 'bg-cyan-600 hover:bg-cyan-500 focus:ring-4 focus:ring-cyan-400 focus:ring-opacity-50 hover:scale-105'
                    : 'bg-gray-600 cursor-not-allowed opacity-70'
                    }`}
                >
                {buttonText}
            </button>
            {canBeDestroyed && (
                <button
                    onClick={() => onDestroy(type)}
                    title={`Zniszcz poziom ${level} i odzyskaj 70% surowców`}
                    className="flex-shrink-0 px-4 py-2 text-xl font-bold text-white rounded-md shadow-md transition-all duration-300 transform bg-red-800 hover:bg-red-700 focus:ring-4 focus:ring-red-600 focus:ring-opacity-50 hover:scale-105"
                >
                    🗑️
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default BuildingRow;