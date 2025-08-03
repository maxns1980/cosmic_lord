import React, { useState, useMemo } from 'react';
import { GameState, BuildingType, Moon } from '../types';
import { PHALANX_SCAN_COST } from '../constants';

interface PhalanxPanelProps {
    gameState: GameState;
    onScan: (sourceMoonId: string, targetCoords: string) => void;
}

const formatNumber = (num: number) => Math.floor(num).toLocaleString('pl-PL');

const PhalanxPanel: React.FC<PhalanxPanelProps> = ({ gameState, onScan }) => {
    const { moons, resources } = gameState;
    
    const phalanxMoons = useMemo(() => 
        Object.values(moons).filter(moon => moon.buildings[BuildingType.PHALANX_SENSOR] > 0), 
        [moons]
    );

    const [selectedMoonId, setSelectedMoonId] = useState<string>(phalanxMoons[0]?.id || '');
    const [targetCoords, setTargetCoords] = useState<string>('');

    if (phalanxMoons.length === 0) {
        return (
            <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-6 text-center">
                <h2 className="text-2xl font-bold text-cyan-300 mb-4">Falanga Czujników</h2>
                <p className="text-gray-400">Musisz najpierw zbudować Falangę Czujników na jednym z Twoich księżyców, aby móc skanować planety.</p>
            </div>
        );
    }
    
    const selectedMoon = phalanxMoons.find(m => m.id === selectedMoonId);
    const phalanxLevel = selectedMoon?.buildings[BuildingType.PHALANX_SENSOR] || 0;
    const range = phalanxLevel > 0 ? Math.pow(phalanxLevel, 2) - 1 : 0;
    const canAfford = resources.deuterium >= PHALANX_SCAN_COST;

    const handleScan = () => {
        if (!selectedMoonId || !targetCoords) {
            alert("Wybierz księżyc i podaj koordynaty celu.");
            return;
        }
        if (!/^\d+:\d+:\d+$/.test(targetCoords)) {
             alert("Nieprawidłowy format koordynatów (np. 1:42:8).");
            return;
        }
        onScan(selectedMoonId, targetCoords);
    };

    return (
        <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-4 md:p-6">
            <h2 className="text-2xl font-bold text-cyan-300 mb-6 border-b-2 border-cyan-800 pb-3">Falanga Czujników</h2>
            
            <div className="max-w-2xl mx-auto bg-gray-900 p-6 rounded-lg space-y-6">
                <div>
                    <label htmlFor="moon-selector" className="block text-sm font-medium text-gray-300 mb-2">
                        Skanuj z księżyca:
                    </label>
                    <select
                        id="moon-selector"
                        value={selectedMoonId}
                        onChange={e => setSelectedMoonId(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 focus:ring-cyan-500 focus:border-cyan-500"
                    >
                        {phalanxMoons.map(moon => (
                            <option key={moon.id} value={moon.id}>
                                {moon.name} [{moon.id}] (Poziom {moon.buildings[BuildingType.PHALANX_SENSOR]})
                            </option>
                        ))}
                    </select>
                </div>
                
                {selectedMoon && (
                    <div className="text-center bg-gray-800/50 p-3 rounded-md">
                        <p className="text-gray-400">Zasięg skanera: <span className="font-bold text-cyan-300 font-mono">{range}</span> systemów</p>
                    </div>
                )}
                
                <div>
                    <label htmlFor="target-coords" className="block text-sm font-medium text-gray-300 mb-2">
                        Koordynaty planety do przeskanowania:
                    </label>
                    <input
                        type="text"
                        id="target-coords"
                        value={targetCoords}
                        onChange={e => setTargetCoords(e.target.value)}
                        placeholder="np. 1:42:8"
                        className="w-full bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 text-center font-mono focus:ring-cyan-500 focus:border-cyan-500"
                    />
                </div>
                
                <div className="text-center text-lg">
                    <p className="text-gray-400">Koszt skanowania:</p>
                    <p className={`font-bold font-mono ${canAfford ? 'text-purple-300' : 'text-red-500'}`}>
                        💧 {formatNumber(PHALANX_SCAN_COST)} deuteru
                    </p>
                </div>

                <button
                    onClick={handleScan}
                    disabled={!canAfford || !targetCoords}
                    className="w-full px-8 py-3 text-base font-bold text-white rounded-md shadow-md bg-cyan-600 hover:bg-cyan-500 transition-transform transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    Skanuj
                </button>
            </div>
        </div>
    );
};

export default PhalanxPanel;