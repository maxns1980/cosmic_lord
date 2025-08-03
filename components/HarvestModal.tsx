import React, { useState, useEffect } from 'react';
import { ShipType, Resources, ResearchLevels, DebrisField } from '../types';
import { ALL_SHIP_DATA } from '../constants';

interface HarvestModalProps {
    targetCoords: string;
    debrisField: DebrisField;
    availableRecyclers: number;
    research: ResearchLevels;
    activeLocationId: string;
    resources: Resources;
    onSend: (recyclerCount: number, targetCoords: string, durationSeconds: number, fuelCost: number) => void;
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

const HarvestModal: React.FC<HarvestModalProps> = ({ targetCoords, debrisField, availableRecyclers, research, activeLocationId, resources, onSend, onClose }) => {
    const [recyclerCount, setRecyclerCount] = useState(1);
    const [travelTime, setTravelTime] = useState(0);
    const [fuelCost, setFuelCost] = useState(0);
    const [collectedMetal, setCollectedMetal] = useState(0);
    const [collectedCrystal, setCollectedCrystal] = useState(0);
    
    const recyclerData = ALL_SHIP_DATA[ShipType.RECYCLER];

    useEffect(() => {
        const count = Math.min(recyclerCount, availableRecyclers);

        if (count > 0) {
            const driveTechLevel = research[recyclerData.drive] || 0;
            const speedBoost = 0.2; // Impulse Drive
            const shipSpeed = recyclerData.speed * (1 + driveTechLevel * speedBoost);
            const distance = calculateDistance(activeLocationId.replace('_moon', ''), targetCoords);
            const durationSeconds = (10 + (35000 / 100 * Math.sqrt(distance * 10 / shipSpeed)));
            setTravelTime(durationSeconds);
            
            const consumption = recyclerData.deuteriumConsumption * count;
            const fuel = distance > 5 ? 1 + Math.round(consumption * distance / 35000) : 0;
            setFuelCost(fuel);

            let cargoCapacity = count * recyclerData.cargoCapacity;
            const metalToCollect = Math.min(debrisField.metal || 0, cargoCapacity);
            setCollectedMetal(metalToCollect);
            cargoCapacity -= metalToCollect;
            const crystalToCollect = Math.min(debrisField.crystal || 0, cargoCapacity);
            setCollectedCrystal(crystalToCollect);

        } else {
            setTravelTime(0);
            setFuelCost(0);
            setCollectedMetal(0);
            setCollectedCrystal(0);
        }
    }, [recyclerCount, targetCoords, research, activeLocationId, debrisField, availableRecyclers, recyclerData]);

    const handleSendClick = () => {
        const count = Math.min(recyclerCount, availableRecyclers);
        if (count > 0 && resources.deuterium >= fuelCost) {
            onSend(count, targetCoords, travelTime, fuelCost);
        }
    };

    const hasEnoughFuel = resources.deuterium >= fuelCost;
    const isDisabled = recyclerCount === 0 || !hasEnoughFuel;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
            aria-modal="true" 
            role="dialog"
            onClick={onClose}
        >
            <div 
                className="bg-gray-800 border-2 border-green-500 rounded-2xl shadow-2xl max-w-lg w-full text-left transform transition-all relative"
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
                    <h2 className="text-3xl font-bold text-green-300 mb-6 border-b border-green-700 pb-3 flex items-center gap-3">
                        <span className="text-4xl">♻️</span>
                        Misja: Zbieraj
                    </h2>
                    
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-gray-900 p-3 rounded-lg">
                            <span className="text-gray-300 font-semibold">Cel (Pole zniszczeń):</span>
                            <span className="text-xl font-bold text-cyan-400 font-mono">[{targetCoords}]</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-center bg-gray-900 p-3 rounded-lg">
                            <div>
                                <p className="text-sm text-gray-400">Dostępny Metal</p>
                                <p className="text-lg font-bold text-orange-400 font-mono">{formatNumber(debrisField.metal || 0)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">Dostępny Kryształ</p>
                                <p className="text-lg font-bold text-blue-400 font-mono">{formatNumber(debrisField.crystal || 0)}</p>
                            </div>
                        </div>
                        
                        <div>
                            <label htmlFor="recycler-count" className="block text-sm font-medium text-gray-300 mb-1">
                                Liczba recyklerów (dostępne: {availableRecyclers})
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    id="recycler-count"
                                    min="1"
                                    max={availableRecyclers}
                                    value={recyclerCount}
                                    onChange={e => setRecyclerCount(parseInt(e.target.value, 10))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                                <input
                                    type="number"
                                    value={recyclerCount}
                                    onChange={e => setRecyclerCount(Math.min(availableRecyclers, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                                    className="w-20 bg-gray-900 border border-gray-600 text-white rounded-md px-2 py-1 text-center"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-center bg-gray-900 p-3 rounded-lg">
                             <div>
                                <p className="text-sm text-gray-400">Zbierzesz Metalu</p>
                                <p className="text-lg font-bold text-green-400 font-mono">{formatNumber(collectedMetal)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">Zbierzesz Kryształu</p>
                                <p className="text-lg font-bold text-green-400 font-mono">{formatNumber(collectedCrystal)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">Czas lotu (w jedną stronę)</p>
                                <p className="text-lg font-bold text-cyan-300 font-mono">{formatTime(travelTime)}</p>
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
                            disabled={isDisabled}
                            title={!hasEnoughFuel ? 'Brak paliwa!' : undefined}
                            className="flex-1 px-6 py-2 text-base font-bold text-white rounded-md shadow-md transition-colors duration-300 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 disabled:cursor-not-allowed"
                        >
                            Wyślij
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default HarvestModal;