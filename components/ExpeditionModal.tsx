import React, { useState, useEffect } from 'react';
import { ShipType, Resources, ResearchLevels, ResearchType, Fleet, ShipLevels, ActiveBoosts, BoostType } from '../types';
import { ALL_SHIP_DATA } from '../constants';

interface ExpeditionModalProps {
    targetCoords: string;
    fleet: Fleet;
    resources: Resources;
    research: ResearchLevels;
    shipLevels: ShipLevels;
    activeLocationId: string;
    activeBoosts: ActiveBoosts;
    onSend: (missionFleet: Fleet, targetCoords: string, durationSeconds: number, explorationDurationSeconds: number, fuelCost: number) => void;
    onClose: () => void;
}

const formatNumber = (num: number) => Math.floor(num).toLocaleString('pl-PL');
const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const calculateDistance = (fromCoords: string, toCoords: string): number => {
    const parse = (c: string) => {
        const parts = c.split(':').map(p => parseInt(p, 10));
        if (parts.length !== 3 || parts.some(isNaN)) return null;
        return { galaxy: parts[0], system: parts[1], position: parts[2] };
    };

    const from = parse(fromCoords);
    const to = parse(toCoords);

    if (!from || !to) return 20000;
    if (from.galaxy !== to.galaxy) return 20000 * Math.abs(from.galaxy - to.galaxy);
    if (from.system !== to.system) return 2700 + 95 * Math.abs(from.system - to.system);
    if (from.position !== to.position) return 1000 + 5 * Math.abs(from.position - to.position);
    return 5;
};

const ExpeditionModal: React.FC<ExpeditionModalProps> = ({ targetCoords, fleet, resources, research, shipLevels, activeLocationId, activeBoosts, onSend, onClose }) => {
    const [missionFleet, setMissionFleet] = useState<Fleet>({});
    const [travelTime, setTravelTime] = useState(0);
    const [explorationTime, setExplorationTime] = useState(0);
    const [fuelCost, setFuelCost] = useState(0);

    const expeditionShips = (Object.keys(fleet).filter(s => (fleet[s as ShipType] ?? 0) > 0) as ShipType[])
        .filter(s => ![ShipType.SPY_PROBE, ShipType.COLONY_SHIP, ShipType.DEATHSTAR, ShipType.RECYCLER, ShipType.SOLAR_SATELLITE].includes(s));

    useEffect(() => {
        const totalShips = Object.values(missionFleet).reduce((sum, count) => sum + (count || 0), 0);
        if (totalShips === 0) {
            setTravelTime(0);
            setFuelCost(0);
            return;
        }

        let minSpeed = Infinity;
        for (const shipId in missionFleet) {
            if (!missionFleet[shipId as ShipType] || missionFleet[shipId as ShipType] === 0) continue;
            
            const shipData = ALL_SHIP_DATA[shipId as ShipType];
            const driveTechLevel = research[shipData.drive] || 0;
            const speedBoost = shipData.drive === ResearchType.COMBUSTION_DRIVE ? 0.1 : (shipData.drive === ResearchType.IMPULSE_DRIVE ? 0.2 : 0.3);
            let shipSpeed = shipData.speed * (1 + driveTechLevel * speedBoost);
            
            if (activeBoosts[BoostType.DRIVE_TECH_BOOST]) {
                 shipSpeed *= (1 + activeBoosts[BoostType.DRIVE_TECH_BOOST]!.level / 100);
            }

            if (shipSpeed < minSpeed) {
                minSpeed = shipSpeed;
            }
        }

        const distance = calculateDistance(activeLocationId.replace('_moon', ''), targetCoords);
        const durationSeconds = (10 + (35000 / 100 * Math.sqrt(distance * 10 / minSpeed)));
        setTravelTime(durationSeconds);

        const consumptionSum = Object.entries(missionFleet).reduce((sum, [shipId, count]) => {
            if (!count || count <= 0) return sum;
            const shipData = ALL_SHIP_DATA[shipId as ShipType];
            return sum + (shipData.deuteriumConsumption * count);
        }, 0);

        const fuel = distance > 5 ? 1 + Math.round(consumptionSum * distance / 35000) : 0;
        setFuelCost(fuel);

        const minDurationSeconds = 30 * 60;
        const maxDurationSeconds = 2 * 60 * 60;
        setExplorationTime(Math.floor(Math.random() * (maxDurationSeconds - minDurationSeconds + 1)) + minDurationSeconds);

    }, [missionFleet, targetCoords, research, activeLocationId, activeBoosts]);

    const handleShipAmountChange = (type: ShipType, value: string) => {
        const amount = parseInt(value, 10);
        const owned = fleet[type] || 0;
        const finalAmount = isNaN(amount) || amount < 0 ? 0 : Math.min(amount, owned);
        setMissionFleet(prev => ({ ...prev, [type]: finalAmount }));
    };

    const handleMaxClick = (type: ShipType) => {
        setMissionFleet(prev => ({ ...prev, [type]: fleet[type] || 0 }));
    };

    const handleSendClick = () => {
        onSend(missionFleet, targetCoords, travelTime, explorationTime, fuelCost);
    };

    const hasResearchVessel = (missionFleet[ShipType.RESEARCH_VESSEL] || 0) > 0;
    const hasEnoughFuel = resources.deuterium >= fuelCost;
    const hasShipsSelected = Object.values(missionFleet).some(count => count && count > 0);

    let sendButtonDisabledReason = '';
    if (!hasShipsSelected) sendButtonDisabledReason = 'Wybierz statki.';
    else if (!hasResearchVessel) sendButtonDisabledReason = 'Wymagany Okręt Badawczy!';
    else if (!hasEnoughFuel) sendButtonDisabledReason = 'Brak paliwa!';
    
    const isSendDisabled = !!sendButtonDisabledReason;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
            aria-modal="true" 
            role="dialog"
            onClick={onClose}
        >
            <div 
                className="bg-gray-800 border-2 border-purple-500 rounded-2xl shadow-2xl max-w-2xl w-full text-left transform transition-all relative"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-8">
                    <button 
                        onClick={onClose} 
                        className="absolute top-4 right-4 text-gray-400 hover:text-white text-3xl font-bold"
                        aria-label="Zamknij"
                    >
                        &times;
                    </button>
                    <h2 className="text-3xl font-bold text-purple-300 mb-6 border-b border-purple-700 pb-3 flex items-center gap-3">
                        <span className="text-4xl">🌌</span>
                        Misja: Wyprawa
                    </h2>
                    
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-gray-900 p-3 rounded-lg">
                            <span className="text-gray-300 font-semibold">Cel:</span>
                            <span className="text-xl font-bold text-cyan-400 font-mono">[{targetCoords}]</span>
                        </div>

                        <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
                            {expeditionShips.map(type => (
                                <div key={type} className="flex items-center justify-between p-2 bg-gray-900 rounded-md">
                                    <span className="font-semibold flex items-center">{ALL_SHIP_DATA[type].icon} {ALL_SHIP_DATA[type].name}: {formatNumber(fleet[type] || 0)}</span>
                                    <div className="flex items-center space-x-2">
                                        <input 
                                            type="number"
                                            value={missionFleet[type] || ''}
                                            onChange={(e) => handleShipAmountChange(type, e.target.value)}
                                            placeholder="0"
                                            className="w-24 bg-gray-800 border border-gray-600 text-white rounded-md px-2 py-1 text-center"
                                        />
                                        <button 
                                            onClick={() => handleMaxClick(type)} 
                                            className="px-3 py-1 bg-cyan-800 text-xs font-bold rounded hover:bg-cyan-700"
                                        >
                                            MAX
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {!hasResearchVessel && hasShipsSelected && (
                            <p className="text-center text-amber-400 text-sm p-2 bg-amber-900 bg-opacity-50 rounded-md">
                                Do misji "Wyprawa" wymagany jest co najmniej jeden Okręt Badawczy.
                            </p>
                        )}

                        <div className="grid grid-cols-3 gap-4 text-center bg-gray-900 p-3 rounded-lg">
                            <div>
                                <p className="text-sm text-gray-400">Czas lotu</p>
                                <p className="text-lg font-bold text-cyan-300 font-mono">{formatTime(travelTime)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">Czas ekspedycji</p>
                                <p className="text-lg font-bold text-cyan-300 font-mono">{formatTime(explorationTime)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">Koszt deuteru</p>
                                <p className={`text-lg font-bold font-mono ${hasEnoughFuel ? 'text-purple-300' : 'text-red-500'}`}>
                                    {formatNumber(fuelCost)}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex gap-4">
                        <button
                            onClick={onClose}
                            className="flex-1 px-6 py-2 text-base font-bold text-white rounded-md shadow-md transition-colors duration-300 bg-gray-600 hover:bg-gray-500"
                        >
                            Anuluj
                        </button>
                        <button
                            onClick={handleSendClick}
                            disabled={isSendDisabled}
                            title={sendButtonDisabledReason}
                            className="flex-1 px-6 py-2 text-base font-bold text-white rounded-md shadow-md transition-colors duration-300 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-500 disabled:cursor-not-allowed"
                        >
                            Wyślij Wyprawę
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExpeditionModal;
