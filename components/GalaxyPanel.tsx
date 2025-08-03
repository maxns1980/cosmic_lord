import React, { useState, useEffect, useCallback } from 'react';
import { MissionType, NPCStates, NPCPersonality, NPCState, NPCFleetMission, DebrisField, Colony, BuildingType, ResearchType, GameState, ShipType, DefenseType, SleeperNpcStates, SleeperNpcState } from '../types';
import { PLAYER_HOME_COORDS, BUILDING_DATA, RESEARCH_DATA, ALL_SHIP_DATA, DEFENSE_DATA } from '../constants';

interface GalaxyPanelProps {
    onAction: (targetCoords: string, missionType: MissionType) => void;
    onSpy: (targetCoords: string) => void;
    onExpedition: (targetCoords: string) => void;
    onExplore: (targetCoords: string) => void;
    onHarvest: (targetCoords: string, debris: DebrisField) => void;
    npcStates: NPCStates;
    sleeperNpcStates: SleeperNpcStates;
    debrisFields: Record<string, DebrisField>;
    colonies: Record<string, Colony>;
    playerState: GameState;
    favoritePlanets: string[];
    onToggleFavorite: (coords: string) => void;
}

const formatNumber = (num: number) => Math.floor(num).toLocaleString('pl-PL');

const FAKE_PLAYER_NAMES = ['Zenith', 'Nova', 'Orion', 'Cygnus', 'Draco', 'Lyra', 'Aquila', 'Centurion', 'Void', 'Stalker', 'Pulsar', 'Goliath'];

const calculatePoints = (target: { fleet: any, defenses: any, buildings: any, research: any, shipLevels?: any }): number => {
    let points = 0;
    const costToPoints = (cost: { metal: number, crystal: number, deuterium: number }) => (cost.metal + cost.crystal + cost.deuterium) / 1000;

    for (const id in target.buildings) {
        for (let i = 1; i <= target.buildings[id as BuildingType]; i++) points += costToPoints(BUILDING_DATA[id as BuildingType].cost(i));
    }
    for (const id in target.research) {
        for (let i = 1; i <= target.research[id as ResearchType]; i++) points += costToPoints(RESEARCH_DATA[id as ResearchType].cost(i));
    }
    for (const id in target.fleet) {
        points += costToPoints(ALL_SHIP_DATA[id as ShipType].cost(1)) * (target.fleet[id as ShipType] || 0);
    }
    for (const id in target.defenses) {
        points += costToPoints(DEFENSE_DATA[id as DefenseType].cost(1)) * (target.defenses[id as DefenseType] || 0);
    }
    return Math.floor(points);
}

const getActivityStatus = (lastUpdateTime: number): { text: string, color: string } => {
    const diffMinutes = (Date.now() - lastUpdateTime) / (1000 * 60);
    if (diffMinutes < 5) return { text: 'Aktywny', color: 'text-green-400' };
    if (diffMinutes < 60) return { text: `Aktywny (${Math.floor(diffMinutes)}m temu)`, color: 'text-yellow-400' };
    return { text: 'Nieaktywny', color: 'text-red-500' };
};

const getStrengthColor = (playerPoints: number, npcPoints: number | undefined, activity: { text: string, color: string }): string => {
    if (activity.text === 'Nieaktywny') return 'border-purple-600';
    if (npcPoints === undefined) return 'border-gray-700';
    if (npcPoints > playerPoints * 2) return 'border-red-600';
    if (npcPoints < playerPoints * 0.5) return 'border-green-600';
    return 'border-yellow-600';
};


const PlanetRow: React.FC<{
    planet: any;
    onAction: (targetCoords: string, missionType: MissionType) => void;
    onSpy: (targetCoords: string) => void;
    onExplore: (targetCoords: string) => void;
    onHarvest: (targetCoords: string, debris: DebrisField) => void;
    onToggleFavorite: (coords: string) => void;
    isFavorite: boolean;
    hasSpyProbes: boolean;
    hasResearchVessel: boolean;
    hasRecyclers: boolean;
}> = ({ planet, onAction, onSpy, onExplore, onHarvest, onToggleFavorite, isFavorite, hasSpyProbes, hasResearchVessel, hasRecyclers }) => {
    const { coords, planetData, debris, points, activity, borderColorClass } = planet;

    return (
        <div className={`group relative p-3 rounded-lg flex flex-col md:flex-row items-center justify-between bg-gray-900 bg-opacity-60 border-l-4 ${borderColorClass}`}>
            {planetData && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-gray-900 border border-gray-600 rounded-lg shadow-xl text-sm text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                    <h4 className="font-bold text-lg text-cyan-300">{planetData.name} [{coords}]</h4>
                    <div className="mt-2 space-y-1">
                        <p><span className="text-gray-400">Gracz:</span> {planetData.player}
                            {planetData.developmentSpeed && planetData.developmentSpeed > 1.4 && (
                                <span className="ml-2 px-2 py-0.5 text-xs font-bold text-yellow-900 bg-yellow-400 rounded-full">Elita</span>
                            )}
                        </p>
                        <p><span className="text-gray-400">Status:</span> <span className={activity.color}>{activity.text}</span></p>
                        <p><span className="text-gray-400">Punkty:</span> {formatNumber(points)}</p>
                        <p><span className="text-gray-400">Sojusz:</span> [Brak Sojuszu]</p>
                        {debris && (debris.metal || 0) > 1 && (debris.crystal || 0) > 1 && (
                             <p><span className="text-gray-400">Pole zniszczeń:</span> ♻️{formatNumber(debris.metal || 0)} 🔩, {formatNumber(debris.crystal || 0)} 💎</p>
                        )}
                    </div>
                </div>
            )}
            <div className="flex items-center font-semibold w-full md:w-2/5">
                <span className="text-4xl mr-4 w-10 text-center">{planet.planetData?.image || '⚫'}</span>
                <div className="flex-1">
                    <p className="text-lg text-white">Pozycja {planet.position} [{planet.coords}]</p>
                    {planet.planetData ? (
                        <p className="text-sm text-gray-400">Gracz: {planet.planetData.player}</p>
                    ) : (
                        <p className="text-sm text-gray-500">[Pusta Przestrzeń]</p>
                    )}
                </div>
            </div>
            {debris && ((debris.metal || 0) > 1 || (debris.crystal || 0) > 1) && (
                <div className="flex items-center text-sm text-yellow-300 mx-4">
                   <span className="text-xl mr-2">♻️</span>
                   <div>
                     <p>Metal: {formatNumber(debris.metal || 0)}</p>
                     <p>Kryształ: {formatNumber(debris.crystal || 0)}</p>
                   </div>
                </div>
            )}
            <div className="flex items-center space-x-2 mt-3 md:mt-0">
                {planetData && !planetData.isPlayer && (
                     <button
                        onClick={() => onToggleFavorite(coords)}
                        className={`px-3 py-2 text-xl rounded-md transition-all duration-200 transform hover:scale-125 ${isFavorite ? 'text-red-500' : 'text-gray-500 hover:text-red-400'}`}
                        title={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
                    >
                        {isFavorite ? '♥' : '♡'}
                    </button>
                )}
                {debris && ((debris.metal || 0) > 1 || (debris.crystal || 0) > 1) && (
                    <button 
                        onClick={() => onHarvest(coords, debris)} 
                        className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded-md text-sm font-bold transition-transform transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        disabled={!hasRecyclers}
                        title={!hasRecyclers ? 'Brak recyklerów' : 'Wyślij recyklery'}
                    >
                        Zbieraj
                    </button>
                )}
                {planetData && !planetData.isPlayer && (
                    <>
                        <button 
                            onClick={() => onSpy(coords)} 
                            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-md text-sm font-bold transition-transform transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-not-allowed"
                            disabled={!hasSpyProbes}
                            title={!hasSpyProbes ? 'Brak sond szpiegowskich' : 'Wyślij sondy szpiegowskie'}
                        >
                            Szpieguj
                        </button>
                        <button onClick={() => onAction(coords, MissionType.ATTACK)} className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-md text-sm font-bold transition-transform transform hover:scale-105">Atakuj</button>
                    </>
                )}
                 {planetData && planetData.isPlayer && (
                    <span className="px-4 py-2 text-cyan-400 font-bold">{planetData.isHome ? 'Twoja Planeta' : 'Twoja Kolonia'}</span>
                )}
                 {!planetData && (
                    <>
                        <button 
                            onClick={() => onExplore(coords)} 
                            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-md text-sm font-bold transition-transform transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-not-allowed"
                            disabled={!hasResearchVessel}
                            title={!hasResearchVessel ? "Wymagany Okręt Badawczy" : "Rozpocznij eksplorację"}
                        >
                            Eksploruj
                        </button>
                        <button onClick={() => onAction(coords, MissionType.COLONIZE)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-sm font-bold transition-transform transform hover:scale-105">Kolonizuj</button>
                    </>
                )}
            </div>
        </div>
    )
}

const GalaxyPanel: React.FC<GalaxyPanelProps> = ({ onAction, onSpy, onExpedition, onExplore, onHarvest, npcStates, sleeperNpcStates, debrisFields, colonies, playerState, favoritePlanets, onToggleFavorite }) => {
    const [galaxy, setGalaxy] = useState(1);
    const [system, setSystem] = useState(42);

    const handleSystemChange = (delta: number) => {
        let newSystem = system + delta;
        let newGalaxy = galaxy;
        if (newSystem > 499) { newSystem = 1; newGalaxy++; }
        if (newSystem < 1) { newSystem = 499; newGalaxy = Math.max(1, newGalaxy - 1); }
        setSystem(newSystem);
        setGalaxy(newGalaxy);
    };

    const playerPoints = calculatePoints({ ...playerState.colonies[PLAYER_HOME_COORDS], research: playerState.research });
    const now = Date.now();
    const explorationTargets = playerState.fleetMissions
        .filter(m => m.missionType === MissionType.EXPLORE && now > m.arrivalTime && m.explorationEndTime && now < m.explorationEndTime)
        .map(m => m.targetCoords);

    const planets = Array.from({ length: 15 }, (_, i) => {
        const position = i + 1;
        const coords = `${galaxy}:${system}:${position}`;
        const playerColony = colonies[coords];
        const npc = npcStates[coords];
        const sleeperNpc = sleeperNpcStates[coords];
        const debris = debrisFields[coords];
        const isBeingExplored = explorationTargets.includes(coords);
        
        let planetData: any = null;
        let points = 0;
        let activity = { text: '-', color: 'text-gray-400' };
        let borderColorClass = 'border-gray-800';

        if (playerColony) {
            const isHome = playerColony.id === PLAYER_HOME_COORDS;
            planetData = { name: playerColony.name, player: isHome ? 'Ty' : 'Ty (Kolonia)', image: isHome ? '🌍' : '🪐', isPlayer: true, isHome };
            borderColorClass = 'border-cyan-400';
        } else if (npc) {
            planetData = { name: `Planeta ${npc.name}`, player: `${npc.name} (NPC)`, image: npc.image, isPlayer: false, developmentSpeed: npc.developmentSpeed };
            points = calculatePoints(npc);
            activity = getActivityStatus(npc.lastUpdateTime);
            borderColorClass = getStrengthColor(playerPoints, points, activity);
        } else if (sleeperNpc) {
            planetData = { name: `Planeta ${sleeperNpc.name}`, player: `${sleeperNpc.name} (NPC)`, image: sleeperNpc.image, isPlayer: false, developmentSpeed: sleeperNpc.developmentSpeed };
            points = sleeperNpc.points;
            activity = { text: 'Uśpiony', color: 'text-gray-500' };
            borderColorClass = getStrengthColor(playerPoints, points, activity);
        }

        if (isBeingExplored) borderColorClass = 'border-teal-400 animate-pulse';

        return { coords, planetData, position, debris, points, activity, borderColorClass };
    });

    const expeditionCoords = `${galaxy}:${system}:16`;
    const anyFleet = Object.values(playerState.colonies).reduce((acc, c) => ({...acc, ...c.fleet}), {});
    const hasSpyProbes = Object.values(playerState.colonies).some(c => (c.fleet[ShipType.SPY_PROBE] || 0) > 0);
    const hasAstrophysics = (playerState.research[ResearchType.ASTROPHYSICS] || 0) > 0;
    const hasResearchVessel = Object.values(playerState.colonies).some(c => (c.fleet[ShipType.RESEARCH_VESSEL] || 0) > 0);
    const hasRecyclers = Object.values(playerState.colonies).some(c => (c.fleet[ShipType.RECYCLER] || 0) > 0);
    const canDoExpedition = hasAstrophysics && hasResearchVessel;
    const expeditionDisabledReason = !hasAstrophysics ? 'Wymagana Astrofizyka' : !hasResearchVessel ? 'Wymagany Okręt Badawczy' : 'Wyślij flotę na wyprawę';
    const isTargetOccupied = (targetCoords: string) => !!(npcStates[targetCoords] || colonies[targetCoords]);

    return (
        <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-4 md:p-6">
            <h2 className="text-2xl font-bold text-cyan-300 mb-4 border-b-2 border-cyan-800 pb-3">Galaktyka</h2>
            <div className="flex flex-col md:flex-row justify-between items-center bg-gray-900 p-3 rounded-lg mb-6 gap-4">
                 <div className="flex items-center space-x-2">
                    <button onClick={() => handleSystemChange(-1)} className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-md font-bold">Poprzedni</button>
                    <input type="number" value={galaxy} onChange={e => setGalaxy(Math.max(1, parseInt(e.target.value) || 1))} className="w-20 bg-gray-800 border border-gray-600 text-white rounded-md px-2 py-1 text-center"/>
                    <span className="font-bold">:</span>
                    <input type="number" value={system} onChange={e => setSystem(Math.max(1, parseInt(e.target.value) || 1))} className="w-20 bg-gray-800 border border-gray-600 text-white rounded-md px-2 py-1 text-center"/>
                    <button onClick={() => handleSystemChange(1)} className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-md font-bold">Następny</button>
                </div>
                <h3 className="text-xl font-bold text-white">Układ: [{galaxy}:{system}]</h3>
            </div>
            <div className="space-y-3">
                {planets.map((planet) => (
                    <PlanetRow 
                        key={planet.coords} 
                        planet={planet} 
                        onAction={(coords, mission) => {
                            if (mission === MissionType.COLONIZE && isTargetOccupied(coords)) {
                                alert("Ta pozycja jest już zajęta!");
                                return;
                            }
                            onAction(coords, mission)
                        }}
                        onSpy={onSpy}
                        onExplore={onExplore}
                        onHarvest={onHarvest}
                        onToggleFavorite={onToggleFavorite}
                        isFavorite={favoritePlanets.includes(planet.coords)}
                        hasSpyProbes={hasSpyProbes}
                        hasResearchVessel={hasResearchVessel}
                        hasRecyclers={hasRecyclers}
                    />
                ))}
                 <div key={expeditionCoords} className="p-3 rounded-lg flex flex-col md:flex-row items-center justify-between bg-purple-900 bg-opacity-40 border-l-4 border-purple-500">
                    <div className="flex items-center font-semibold w-full md:w-2/5">
                        <span className="text-4xl mr-4 w-10 text-center">🌌</span>
                        <div className="flex-1">
                            <p className="text-lg text-white">Pozycja 16 [{expeditionCoords}]</p>
                            <p className="text-sm text-purple-300">[Nieznana Przestrzeń]</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 mt-3 md:mt-0">
                        <button 
                            onClick={() => onExpedition(expeditionCoords)} 
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-md text-sm font-bold transition-transform transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-not-allowed"
                            disabled={!canDoExpedition}
                            title={expeditionDisabledReason}
                        >
                            Wyprawa
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GalaxyPanel;
