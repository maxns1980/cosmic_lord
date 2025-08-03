import React, { useState } from 'react';
import { ShipType, Resources, BuildingLevels, ResearchLevels, BuildingType, ResearchType, ShipLevels } from '../types';
import { ALL_SHIP_DATA, ALL_GAME_OBJECTS } from '../constants';

interface ShipRowProps {
  type: ShipType;
  onBuild: (type: ShipType, amount: number) => void;
  resources: Resources;
  isQueued: boolean;
  requirementsMet: boolean;
  amountOwned: number;
  buildings: BuildingLevels;
  research: ResearchLevels;
  shipLevels: ShipLevels;
}

const formatNumber = (num: number): string => {
    return Math.floor(num).toLocaleString('pl-PL');
};

const CostDisplay: React.FC<{ cost: Resources; available?: Resources }> = ({ cost, available }) => {
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

    if (costs.length === 0) return null;

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

const ShipRow: React.FC<ShipRowProps> = ({ type, onBuild, resources, isQueued, requirementsMet, amountOwned, buildings, research, shipLevels }) => {
  const [amount, setAmount] = useState(1);
  const data = ALL_SHIP_DATA[type];
  const cost = data.cost(1);
  
  const totalCost: Resources = {
      metal: cost.metal * amount,
      crystal: cost.crystal * amount,
      deuterium: cost.deuterium * amount,
      energy: 0,
  };

  const canAfford = resources.metal >= totalCost.metal && resources.crystal >= totalCost.crystal && resources.deuterium >= totalCost.deuterium;
  const isDisabled = isQueued || !canAfford || !requirementsMet || amount <= 0;
  
  let buttonText = 'Buduj';
  if (isQueued) buttonText = 'W kolejce...';
  else if (!requirementsMet) buttonText = 'Brak wymagań';

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      setAmount(isNaN(value) || value < 1 ? 1 : value);
  }

  const handleMaxClick = () => {
    const { metal, crystal, deuterium } = resources;
    const { metal: costMetal, crystal: costCrystal, deuterium: costDeuterium } = cost;
    
    let maxAmount = Infinity;
    if (costMetal > 0) maxAmount = Math.min(maxAmount, Math.floor(metal / costMetal));
    if (costCrystal > 0) maxAmount = Math.min(maxAmount, Math.floor(crystal / costCrystal));
    if (costDeuterium > 0) maxAmount = Math.min(maxAmount, Math.floor(deuterium / costDeuterium));
    
    if (maxAmount === Infinity) maxAmount = 0;
    
    setAmount(maxAmount > 0 ? maxAmount : 1);
  };
  
  const weaponTech = research[ResearchType.WEAPON_TECHNOLOGY] || 0;
  const shieldTech = research[ResearchType.SHIELDING_TECHNOLOGY] || 0;
  const armorTech = research[ResearchType.ARMOR_TECHNOLOGY] || 0;
  
  const level = shipLevels[type] || 0;

  const attackBonus = (data.attack * weaponTech * 0.1) + (data.attack * level * 0.1);
  const shieldBonus = (data.shield * shieldTech * 0.1) + (data.shield * level * 0.1);
  const integrityBonus = (data.structuralIntegrity * armorTech * 0.1) + (data.structuralIntegrity * level * 0.1);

  const isTransport = [
      ShipType.CARGO_SHIP,
      ShipType.MEDIUM_CARGO_SHIP,
      ShipType.HEAVY_CARGO_SHIP,
      ShipType.RECYCLER,
      ShipType.COLONY_SHIP,
      ShipType.RESEARCH_VESSEL
  ].includes(type);
  const cargoBonus = isTransport ? (data.cargoCapacity * level * 0.1) : 0;


  return (
    <div className={`flex flex-col md:flex-row items-stretch justify-between bg-gray-900 bg-opacity-50 p-4 rounded-lg border border-gray-700 transition-all duration-300 ${!isDisabled && 'hover:border-cyan-600'}`}>
      <div className="flex-1 mb-4 md:mb-0">
        <h3 className="text-xl font-bold text-white flex items-center">
          <span className="text-2xl mr-3">{data.icon}</span>
          {data.name}
          {level > 0 && (
            <span className="ml-3 text-cyan-400 flex items-center gap-1 text-base">
                {Array.from({ length: level }).map((_, i) => <span key={i}>★</span>)}
            </span>
          )}
          <span className="ml-3 text-lg font-normal text-gray-400">(Posiadane: {amountOwned})</span>
        </h3>
        <p className="text-gray-400 mt-1 text-sm">{data.description}</p>
        
        <RequirementsDisplay requirements={data.requirements} currentBuildings={buildings} currentResearch={research} />

        <div className="text-sm text-gray-300 mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
             <p>Atak: <span className="font-semibold text-red-400">{formatNumber(data.attack)} {attackBonus > 0 && <span className="text-green-400">(+{formatNumber(attackBonus)})</span>}</span></p>
             <p>Tarcza: <span className="font-semibold text-blue-400">{formatNumber(data.shield)} {shieldBonus > 0 && <span className="text-green-400">(+{formatNumber(shieldBonus)})</span>}</span></p>
             <p>Struktura: <span className="font-semibold text-gray-400">{formatNumber(data.structuralIntegrity)} {integrityBonus > 0 && <span className="text-green-400">(+{formatNumber(integrityBonus)})</span>}</span></p>
             {data.cargoCapacity > 0 && (
                <p>Ładowność: <span className="font-semibold text-yellow-400">{formatNumber(data.cargoCapacity)} {cargoBonus > 0 && <span className="text-green-400">(+{formatNumber(cargoBonus)})</span>}</span></p>
             )}
             {data.energyProduction && data.energyProduction > 0 && (
                <p>Produkcja energii: <span className="font-semibold text-yellow-400">{formatNumber(data.energyProduction)}</span></p>
             )}
        </div>
         <div className="mt-2">
            <p className="text-sm font-semibold text-gray-400">Koszt 1 sztuki:</p>
            <CostDisplay cost={cost} available={resources} />
        </div>
      </div>
      <div className="flex flex-col items-start justify-between md:items-end w-full md:w-auto mt-4 md:mt-0" style={{minWidth: '250px'}}>
        <div className="w-full">
            <div className="flex items-center space-x-2 mb-2">
                <label htmlFor={`amount-${type}`} className="text-sm font-semibold text-gray-300">Ilość:</label>
                <input 
                    type="number"
                    id={`amount-${type}`}
                    value={amount}
                    onChange={handleAmountChange}
                    min="1"
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-md px-2 py-1 text-center focus:ring-cyan-500 focus:border-cyan-500"
                    disabled={isQueued || !requirementsMet}
                />
                <button 
                    onClick={handleMaxClick} 
                    className="px-3 py-1 bg-cyan-800 text-xs font-bold rounded hover:bg-cyan-700 disabled:bg-gray-700 disabled:cursor-not-allowed"
                    disabled={isQueued || !requirementsMet}
                >
                    MAX
                </button>
            </div>
            {amount > 0 && (
                <div className="mb-2 p-2 rounded-md bg-gray-800/50 w-full">
                    <p className="text-xs font-semibold text-gray-400">Całkowity koszt:</p>
                    <CostDisplay cost={totalCost} available={resources} />
                </div>
            )}
        </div>
        <button
          onClick={() => onBuild(type, amount)}
          disabled={isDisabled}
          className={`w-full mt-auto px-6 py-2 text-base font-bold text-white rounded-md shadow-md transition-all duration-300 transform
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

export default ShipRow;