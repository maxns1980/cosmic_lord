import React, { useState, useEffect } from 'react';
import { GameState, Colony, Moon, QueueItem, FleetMission, NPCFleetMission, Resources, MissionType, ShipType } from '../types';
import { PLAYER_HOME_COORDS, ALL_GAME_OBJECTS, ALL_SHIP_DATA } from '../constants';

interface OverviewPanelProps {
    gameState: GameState;
    productions: {
        metal: number;
        crystal: number;
        deuterium: number;
        energy: {
            produced: number;
            consumed: number;
            efficiency: number;
        }
    };
    onRecallFleet: (missionId: string) => void;
}

const formatNumber = (num: number) => Math.floor(num).toLocaleString('pl-PL');
const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const QueueItemDisplay: React.FC<{item: QueueItem}> = ({ item }) => {
    const [remainingTime, setRemainingTime] = useState((item.endTime - Date.now()) / 1000);

    useEffect(() => {
        const timer = setInterval(() => {
            setRemainingTime((item.endTime - Date.now()) / 1000);
        }, 1000);
        return () => clearInterval(timer);
    }, [item.endTime]);

    const itemInfo = ALL_GAME_OBJECTS[item.id];
    if (!itemInfo) return null;

    const label = item.type === 'ship' || item.type === 'defense' ? `x${item.levelOrAmount}` : `(poz. ${item.levelOrAmount})`;

    return (
        <div className="flex justify-between items-center text-sm py-1">
            <span className="text-gray-300">{itemInfo.name} {label}</span>
            <span className="font-mono text-green-400">{formatTime(remainingTime)}</span>
        </div>
    )
}

const PlanetCard: React.FC<{ planet: { id: string, name: string }, moon?: Moon, queue: QueueItem[], isHome?: boolean }> = ({ planet, moon, queue, isHome }) => {
    return (
        <div className="bg-gray-900 bg-opacity-70 rounded-lg p-4">
            <h4 className="font-bold text-lg text-cyan-300 border-b border-gray-700 pb-2 mb-2 flex items-center">
                <span className="text-2xl mr-2">{isHome ? '🌍' : '🪐'}</span>
                {planet.name} <span className="text-sm text-gray-500 ml-2">[{planet.id}]</span>
            </h4>
            <div className="space-y-1">
                {queue.length > 0 ? (
                    queue.map((item, index) => <QueueItemDisplay key={`${item.id}-${index}`} item={item} />)
                ) : (
                    <p className="text-sm text-gray-500 italic">Brak aktywności w kolejce.</p>
                )}
            </div>
            {moon && (
                <div className="mt-4 pt-3 border-t border-dashed border-gray-600">
                     <h5 className="font-bold text-base text-cyan-400 flex items-center">
                        <span className="text-xl mr-2">🌕</span>
                        {moon.name}
                     </h5>
                     <div className="space-y-1 mt-1">
                        {moon.buildingQueue.length > 0 ? (
                            moon.buildingQueue.map((item, index) => <QueueItemDisplay key={`${item.id}-${index}`} item={item} />)
                        ) : (
                            <p className="text-sm text-gray-500 italic">Brak aktywności w kolejce.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

const MissionRow: React.FC<{mission: FleetMission | NPCFleetMission, onRecall?: (missionId: string) => void}> = ({ mission, onRecall }) => {
    const [currentTime, setCurrentTime] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const isPlayerMission = 'returnTime' in mission;
    
    if (isPlayerMission) {
        if (mission.missionType === MissionType.EXPEDITION && mission.processedArrival && mission.explorationEndTime && currentTime < mission.explorationEndTime) {
            return null; // Hide expedition during exploration phase
        }

        const isReturning = mission.processedArrival;
        let timeToDisplay = isReturning
            ? (mission.returnTime - currentTime) / 1000
            : (mission.arrivalTime - currentTime) / 1000;
        
        let statusText = isReturning ? (mission.recalled ? '(Zawrócono)' : '(Powrót)') : '(W drodze)';
        let missionColor = 'border-yellow-500';

        if (isReturning) {
            missionColor = mission.recalled ? 'border-yellow-500' : 'border-green-500';
        }

        let missionName = '';
        switch(mission.missionType) {
            case MissionType.ATTACK: missionName = 'Atak'; break;
            case MissionType.SPY: missionName = 'Szpiegostwo'; break;
            case MissionType.HARVEST: missionName = 'Zbieraj'; break;
            case MissionType.COLONIZE: missionName = 'Kolonizacja'; missionColor = 'border-blue-500'; break;
            case MissionType.EXPEDITION: 
                missionName = 'Wyprawa'; 
                missionColor = 'border-purple-500';
                if(isReturning) statusText = '(Powrót)';
                break;
            case MissionType.EXPLORE:
                missionName = 'Eksploracja';
                missionColor = 'border-teal-500';
                if (isReturning) missionColor = 'border-green-500'; // It's returning after exploration

                if (mission.explorationEndTime && currentTime > mission.arrivalTime && currentTime < mission.explorationEndTime) {
                    statusText = '(Badanie)';
                    missionColor = 'border-cyan-400';
                    timeToDisplay = (mission.explorationEndTime - currentTime) / 1000;
                }
                break;
        }

        return (
            <div className={`bg-gray-900 bg-opacity-60 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-2 border-l-4 ${missionColor}`}>
                <div className="flex-1">
                    <p className="font-semibold text-cyan-400">
                        {missionName} na [{mission.targetCoords}] {statusText}
                    </p>
                    <p className="text-sm text-gray-300">
                        Flota: {Object.entries(mission.fleet).map(([type, count]) => `${ALL_SHIP_DATA[type as ShipType].name}: ${count}`).join(', ')}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-lg font-mono text-green-400">{formatTime(timeToDisplay)}</div>
                    {onRecall && !isReturning && (
                         <button
                            onClick={() => onRecall(mission.id)}
                            className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 rounded-md text-xs font-bold text-white"
                            title="Zawróć flotę"
                        >
                            Zawróć
                        </button>
                    )}
                </div>
            </div>
        );
    } else { // NPC Mission
        const npcMission = mission as NPCFleetMission;
        const remainingTime = (mission.arrivalTime - currentTime) / 1000;
        return (
             <div className="bg-red-900 bg-opacity-30 p-3 rounded-lg flex justify-between items-center gap-2 border-l-4 border-red-500 animate-pulse">
                <div>
                    <p className="font-semibold text-red-300">
                        Wroga flota z [{npcMission.sourceCoords}] w drodze na Twoją planetę!
                    </p>
                    <p className="text-sm text-gray-400">Typ misji: {npcMission.missionType}</p>
                </div>
                <div className="text-lg font-mono text-yellow-300">{formatTime(remainingTime)}</div>
            </div>
        );
    }
}


const OverviewPanel: React.FC<OverviewPanelProps> = ({ gameState, productions, onRecallFleet }) => {
    const { colonies, moons, fleetMissions, npcFleetMissions, buildingQueue } = gameState;

    const allPlanets = [
        { id: PLAYER_HOME_COORDS, name: 'Planeta Matka' },
        ...colonies
    ];

    const allMissions = [...fleetMissions, ...npcFleetMissions].sort((a, b) => a.arrivalTime - b.arrivalTime);
    
    return (
        <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-4 md:p-6 space-y-6">
            <h2 className="text-2xl font-bold text-cyan-300 border-b-2 border-cyan-800 pb-3">Podgląd Imperium</h2>

            {/* Planets & Moons */}
            <section>
                 <h3 className="text-xl font-bold text-white mb-3">Planety i Księżyce</h3>
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {allPlanets.map(planet => (
                        <PlanetCard 
                            key={planet.id}
                            planet={planet}
                            moon={moons[planet.id]}
                            queue={planet.id === PLAYER_HOME_COORDS ? buildingQueue : []} // Note: simplified queue view
                            isHome={planet.id === PLAYER_HOME_COORDS}
                        />
                    ))}
                 </div>
            </section>
            
            {/* Fleet Movements */}
            <section>
                <h3 className="text-xl font-bold text-white mb-3">Ruch Flot ({allMissions.length})</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {allMissions.length > 0 ? (
                        allMissions.map(mission => <MissionRow key={mission.id} mission={mission} onRecall={'returnTime' in mission ? onRecallFleet : undefined} />)
                    ) : (
                         <p className="text-gray-500 italic">Brak aktywnych misji.</p>
                    )}
                </div>
            </section>

            {/* Production Summary */}
            <section>
                <h3 className="text-xl font-bold text-white mb-3">Produkcja Globalna</h3>
                <div className="bg-gray-900 bg-opacity-70 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <p className="text-gray-400">🔩 Metal</p>
                        <p className="text-lg font-bold text-green-400">+{formatNumber(productions.metal)}/h</p>
                    </div>
                    <div>
                        <p className="text-gray-400">💎 Kryształ</p>
                        <p className="text-lg font-bold text-green-400">+{formatNumber(productions.crystal)}/h</p>
                    </div>
                    <div>
                        <p className="text-gray-400">💧 Deuter</p>
                        <p className={`text-lg font-bold ${productions.deuterium >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {productions.deuterium >= 0 ? '+' : ''}{formatNumber(productions.deuterium)}/h
                        </p>
                    </div>
                    <div>
                        <p className="text-gray-400">⚡ Energia</p>
                        <p className="text-sm">{formatNumber(productions.energy.produced)} / {formatNumber(productions.energy.consumed)}</p>
                        <p className={`text-sm font-bold ${productions.energy.efficiency === 1 ? 'text-green-400' : 'text-yellow-400'}`}>
                            ({(productions.energy.efficiency * 100).toFixed(0)}%)
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default OverviewPanel;