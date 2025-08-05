import React, { useState, useEffect } from 'react';
import { Fleet, FleetMission, ShipType, MissionType, ResearchType, ResearchLevels, SpacePlagueState, Colony, NPCStates, SolarFlareState, SolarFlareStatus, FleetTemplate, ActiveBoosts, BoostType, Resources, ShipLevels } from '../types';
import { ALL_SHIP_DATA, RESEARCH_DATA, PLAYER_HOME_COORDS } from '../constants';

interface FleetPanelProps {
    fleet: Fleet;
    resources: Resources;
    fleetMissions: FleetMission[];
    research: ResearchLevels;
    shipLevels: ShipLevels;
    onSendFleet: (missionFleet: Fleet, targetCoords: string, missionType: MissionType, durationSeconds: number, fuelCost: number) => void;
    onRecallFleet: (missionId: string) => void;
    initialTarget: {coords: string, mission: MissionType} | null;
    onClearInitialTarget: () => void;
    spacePlague: SpacePlagueState;
    solarFlare: SolarFlareState;
    colonies: Record<string, Colony>;
    npcStates: NPCStates;
    fleetTemplates: FleetTemplate[];
    onSaveTemplate: (name: string, fleet: Fleet) => void;
    onDeleteTemplate: (name: string) => void;
    activeLocationId: string;
    activeBoosts: ActiveBoosts;
    maxFleetSlots: number;
}

const formatNumber = (num: number) => Math.floor(num).toLocaleString('pl-PL');
const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

const calculateDistance = (fromCoords: string, toCoords: string): number => {
    const parse = (c: string) => {
        const parts = c.split(':').map(p => parseInt(p, 10));
        if (parts.length !== 3 || parts.some(isNaN)) return null;
        return { galaxy: parts[0], system: parts[1], position: parts[2] };
    };

    const from = parse(fromCoords);
    const to = parse(toCoords);

    if (!from || !to) return 20000;

    if (from.galaxy !== to.galaxy) {
        return 20000 * Math.abs(from.galaxy - to.galaxy);
    }
    if (from.system !== to.system) {
        return 2700 + 95 * Math.abs(from.system - to.system);
    }
    if (from.position !== to.position) {
        return 1000 + 5 * Math.abs(from.position - to.position);
    }
    return 5;
};


const MissionRow: React.FC<{mission: FleetMission, onRecall: (missionId: string) => void}> = ({ mission, onRecall }) => {
    const [currentTime, setCurrentTime] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (mission.missionType === MissionType.EXPEDITION && mission.processedArrival && mission.explorationEndTime && currentTime < mission.explorationEndTime) {
        return null; // Hide expedition during exploration phase
    }
    
    const isReturning = mission.processedArrival;
    const canBeRecalled = !isReturning;

    let timeToDisplay = isReturning
        ? (mission.returnTime - currentTime) / 1000
        : (mission.arrivalTime - currentTime) / 1000;


    let statusText = isReturning ? (mission.recalled ? '(Zawrócono)' : '(Powrót)') : '(W drodze)';
    let missionColor = 'border-yellow-500';

    if (isReturning) {
        if (mission.recalled) {
            missionColor = 'border-yellow-500';
        } else {
             missionColor = 'border-green-500';
        }
    }

    let missionName = '';
    switch(mission.missionType) {
        case MissionType.ATTACK: missionName = 'Atak'; break;
        case MissionType.SPY: missionName = 'Szpiegostwo'; break;
        case MissionType.HARVEST: missionName = 'Zbieraj'; break;
        case MissionType.COLONIZE: 
            missionName = 'Kolonizacja';
            missionColor = 'border-blue-500';
            break;
        case MissionType.EXPEDITION:
            missionName = 'Wyprawa';
            missionColor = 'border-purple-500';
            if (isReturning) {
                 statusText = '(Powrót)';
            } else if (mission.processedArrival) {
                 statusText = '(Badanie)';
                 timeToDisplay = (mission.explorationEndTime! - currentTime) / 1000;
                 missionColor = 'border-cyan-400';
            }
            break;
        case MissionType.EXPLORE:
            missionName = 'Eksploracja';
            missionColor = 'border-teal-500';
            if (isReturning) missionColor = 'border-green-500';

            if (mission.explorationEndTime && currentTime > mission.arrivalTime && currentTime < mission.explorationEndTime) {
                statusText = '(Badanie)';
                timeToDisplay = (mission.explorationEndTime - currentTime) / 1000;
                missionColor = 'border-cyan-400';
            }
            break;
    }


    return (
        <div className={`bg-gray-900 bg-opacity-60 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-2 border-l-4 ${missionColor}`}>
            <div className="flex-1">
                <p className="font-semibold text-cyan-400">
                    Misja: {missionName} na [{mission.targetCoords}] {statusText}
                </p>
                <p className="text-sm text-gray-300">
                    Flota: {Object.entries(mission.fleet).map(([type, count]) => `${ALL_SHIP_DATA[type as ShipType].name}: ${count}`).join(', ')}
                </p>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-lg font-mono text-green-400">{formatTime(timeToDisplay)}</div>
                {canBeRecalled && (
                     <button
                        onClick={() => onRecall(mission.id)}
                        className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 rounded-md text-xs font-bold text-white transition-transform transform hover:scale-105"
                        title="Zawróć flotę"
                    >
                        Zawróć
                    </button>
                )}
            </div>
        </div>
    )
}

const FleetPanel: React.FC<FleetPanelProps> = ({ fleet, resources, fleetMissions, research, shipLevels, onSendFleet, onRecallFleet, initialTarget, onClearInitialTarget, spacePlague, solarFlare, colonies, npcStates, fleetTemplates, onSaveTemplate, onDeleteTemplate, activeLocationId, activeBoosts, maxFleetSlots }) => {
    const [missionFleet, setMissionFleet] = useState<Fleet>({});
    const [targetCoords, setTargetCoords] = useState("1:42:8");
    const [missionType, setMissionType] = useState<MissionType>(MissionType.ATTACK);
    const [templateName, setTemplateName] = useState('');
    const [travelTime, setTravelTime] = useState<number | null>(null);
    const [fuelCost, setFuelCost] = useState<number | null>(null);
    const [totalAttack, setTotalAttack] = useState<{ base: number, bonus: number }>({ base: 0, bonus: 0 });
    const [totalShield, setTotalShield] = useState<{ base: number, bonus: number }>({ base: 0, bonus: 0 });
    const [totalStructuralIntegrity, setTotalStructuralIntegrity] = useState<{ base: number, bonus: number }>({ base: 0, bonus: 0 });

    const isExploreMissionWithoutVessel = missionType === MissionType.EXPLORE && (missionFleet[ShipType.RESEARCH_VESSEL] || 0) === 0;

    useEffect(() => {
        if (initialTarget) {
            setTargetCoords(initialTarget.coords);
            setMissionType(initialTarget.mission);
            onClearInitialTarget();
        }
    }, [initialTarget, onClearInitialTarget]);

    useEffect(() => {
        const totalShips = Object.values(missionFleet).reduce((sum, count) => sum + (count || 0), 0);
        if (totalShips === 0) {
            setTravelTime(null);
            setFuelCost(null);
            setTotalAttack({ base: 0, bonus: 0 });
            setTotalShield({ base: 0, bonus: 0 });
            setTotalStructuralIntegrity({ base: 0, bonus: 0 });
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
        
        if (minSpeed === Infinity) {
            setTravelTime(null);
            setFuelCost(null);
            return;
        }

        const distance = calculateDistance(activeLocationId.replace('_moon', ''), targetCoords);
        const durationSeconds = (10 + (35000 / 100 * Math.sqrt(distance * 10 / minSpeed)));
        
        setTravelTime(durationSeconds);

        const consumptionSum = Object.entries(missionFleet).reduce((sum, [shipId, count]) => {
            if (!count || count <= 0) return sum;
            const shipData = ALL_SHIP_DATA[shipId as ShipType];
            return sum + (shipData.deuteriumConsumption * count);
        }, 0);

        if (consumptionSum > 0 && distance > 5) {
            const fuel = 1 + Math.round(consumptionSum * distance / 35000);
            setFuelCost(fuel);
        } else {
            setFuelCost(0);
        }

        const weaponTech = research[ResearchType.WEAPON_TECHNOLOGY] || 0;
        const shieldTech = research[ResearchType.SHIELDING_TECHNOLOGY] || 0;
        const armorTech = research[ResearchType.ARMOR_TECHNOLOGY] || 0;

        let baseAttack = 0, bonusAttack = 0, baseShield = 0, bonusShield = 0, baseIntegrity = 0, bonusIntegrity = 0;

        for (const shipId in missionFleet) {
            const count = missionFleet[shipId as ShipType];
            if (!count || count <= 0) continue;

            const shipData = ALL_SHIP_DATA[shipId as ShipType];
            const upgradeLevel = shipLevels[shipId as ShipType] || 0;

            const techAttackBonus = shipData.attack * weaponTech * 0.1;
            const upgradeAttackBonus = shipData.attack * upgradeLevel * 0.1;
            baseAttack += shipData.attack * count;
            bonusAttack += (techAttackBonus + upgradeAttackBonus) * count;
            
            const techShieldBonus = shipData.shield * shieldTech * 0.1;
            const upgradeShieldBonus = shipData.shield * upgradeLevel * 0.1;
            baseShield += shipData.shield * count;
            bonusShield += (techShieldBonus + upgradeShieldBonus) * count;
            
            const techIntegrityBonus = shipData.structuralIntegrity * armorTech * 0.1;
            const upgradeIntegrityBonus = shipData.structuralIntegrity * upgradeLevel * 0.1;
            baseIntegrity += shipData.structuralIntegrity * count;
            bonusIntegrity += (techIntegrityBonus + upgradeIntegrityBonus) * count;
        }
        
        setTotalAttack({ base: baseAttack, bonus: bonusAttack });
        setTotalShield({ base: baseShield, bonus: bonusShield });
        setTotalStructuralIntegrity({ base: baseIntegrity, bonus: bonusIntegrity });

    }, [missionFleet, targetCoords, research, activeLocationId, activeBoosts, shipLevels]);


    const handleShipAmountChange = (type: ShipType, value: string) => {
        const amount = parseInt(value, 10);
        const owned = fleet[type] || 0;
        const finalAmount = isNaN(amount) || amount < 0 ? 0 : Math.min(amount, owned);
        setMissionFleet(prev => ({...prev, [type]: finalAmount}));
    }

    const handleMaxClick = (type: ShipType) => {
        setMissionFleet(prev => ({...prev, [type]: fleet[type] || 0 }));
    }

    const handleSendFleet = () => {
        const totalShips = Object.values(missionFleet).reduce((sum, count) => sum + (count || 0), 0);
        if (totalShips > 0 && travelTime !== null && fuelCost !== null) {
            if (resources.deuterium < fuelCost) {
                alert("Niewystarczająca ilość deuteru!");
                return;
            }
            onSendFleet(missionFleet, targetCoords, missionType, travelTime, fuelCost);
            setMissionFleet({});
        } else {
            alert("Wybierz przynajmniej jeden statek!");
        }
    }
    
    const handleSaveTemplateClick = () => {
        const totalShips = Object.values(missionFleet).reduce((sum, count) => sum + (count || 0), 0);
        if (totalShips > 0 && templateName.trim()) {
            onSaveTemplate(templateName.trim(), missionFleet);
            setTemplateName('');
        }
    };
    
    const handleLoadTemplate = (template: FleetTemplate) => {
        const newMissionFleet: Fleet = {};
        for (const shipId in template.fleet) {
            const requestedCount = template.fleet[shipId as ShipType] || 0;
            const availableCount = fleet[shipId as ShipType] || 0;
            if (availableCount > 0) {
                 newMissionFleet[shipId as ShipType] = Math.min(requestedCount, availableCount);
            }
        }
        setMissionFleet(newMissionFleet);
    };

    const availableShips = (Object.keys(fleet).filter(s => (fleet[s as ShipType] ?? 0) > 0) as ShipType[])
        .filter(s => s !== ShipType.SOLAR_SATELLITE);
    const spyTechLevel = research[ResearchType.SPY_TECHNOLOGY] || 0;
    const hasAstrophysics = (research[ResearchType.ASTROPHYSICS] || 0) > 0;
    const hasRecyclers = (fleet[ShipType.RECYCLER] || 0) > 0;
    const hasColonyShip = (fleet[ShipType.COLONY_SHIP] || 0) > 0;
    const hasResearchVessel = (fleet[ShipType.RESEARCH_VESSEL] || 0) > 0;
    const isTargetOccupied = !!(npcStates[targetCoords] || colonies[targetCoords]);
    const isDisruptionActive = solarFlare.status === SolarFlareStatus.DISRUPTION;
    const hasEnoughFuel = fuelCost === null || fuelCost === 0 || resources.deuterium >= fuelCost;
    
    const totalShipsInMission = Object.values(missionFleet).reduce((sum, count) => sum + (count || 0), 0);
    const isExpeditionAndMissingVessel = missionType === MissionType.EXPEDITION && (missionFleet[ShipType.RESEARCH_VESSEL] || 0) < 1;
    const isExploreAndMissingVessel = missionType === MissionType.EXPLORE && (missionFleet[ShipType.RESEARCH_VESSEL] || 0) < 1;
    const areSlotsFull = fleetMissions.length >= maxFleetSlots;

    let sendButtonDisabledReason = '';
    if (areSlotsFull) {
        sendButtonDisabledReason = 'Wszystkie sloty flot są zajęte!';
    } else if (missionType === MissionType.EXPEDITION && !hasAstrophysics) {
        sendButtonDisabledReason = "Musisz najpierw zbadać Astrofizykę, aby wysyłać wyprawy!";
    } else if (!hasEnoughFuel) {
        sendButtonDisabledReason = 'Niewystarczająca ilość deuteru!';
    } else if (isExpeditionAndMissingVessel) {
        sendButtonDisabledReason = 'Do misji "Wyprawa" wymagany jest co najmniej jeden Okręt Badawczy.';
    } else if (isExploreAndMissingVessel) {
        sendButtonDisabledReason = 'Do misji "Eksploruj" wymagany jest co najmniej jeden Okręt Badawczy.';
    } else if (totalShipsInMission === 0) {
        sendButtonDisabledReason = 'Musisz wybrać co najmniej jeden statek.';
    }

    const isSendButtonDisabled = !!sendButtonDisabledReason;

    return (
        <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-4 md:p-6 space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-cyan-300 mb-4 border-b-2 border-cyan-800 pb-3 flex justify-between items-center">
                    <span>Zarządzanie Flotą</span>
                    <span className={`text-lg font-bold ${areSlotsFull ? 'text-red-400' : 'text-cyan-300'}`}>
                        Sloty Flot: {fleetMissions.length} / {maxFleetSlots}
                    </span>
                </h2>
                {availableShips.length === 0 ? (
                    <p className="text-gray-400">Nie posiadasz żadnych statków mobilnych.</p>
                ) : (
                    <>
                        <div className="space-y-4">
                            {availableShips.map(type => {
                                const isPlagued = spacePlague.active && spacePlague.infectedShip === type;
                                const shipData = ALL_SHIP_DATA[type];
                                const shipInputDisabled = isExploreMissionWithoutVessel && type !== ShipType.RESEARCH_VESSEL;
                                const level = shipLevels[type] || 0;
                                return (
                                    <div key={type} className={`flex items-center justify-between p-2 bg-gray-900 rounded-md transition-opacity ${shipInputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <span className="font-semibold flex items-center flex-wrap">
                                            {isPlagued && <span className="text-xl mr-2" title="Zainfekowany wirusem! Atak -20%">🦠</span>}
                                            {shipData.icon} {shipData.name}
                                            {level > 0 && (
                                                <span className="ml-2 text-cyan-400 flex items-center gap-1 text-sm">
                                                    {Array.from({ length: level }).map((_, i) => <span key={i}>★</span>)}
                                                </span>
                                            )}
                                            : {formatNumber(fleet[type] || 0)}
                                        </span>
                                        <div className="flex items-center space-x-2">
                                            <input 
                                                type="number"
                                                value={missionFleet[type] || ''}
                                                onChange={(e) => handleShipAmountChange(type, e.target.value)}
                                                placeholder="0"
                                                className="w-24 bg-gray-800 border border-gray-600 text-white rounded-md px-2 py-1 text-center focus:ring-cyan-500 focus:border-cyan-500 disabled:cursor-not-allowed"
                                                disabled={shipInputDisabled}
                                            />
                                            <button 
                                                onClick={() => handleMaxClick(type)} 
                                                className="px-3 py-1 bg-cyan-800 text-xs font-bold rounded hover:bg-cyan-700 disabled:bg-gray-700 disabled:cursor-not-allowed"
                                                disabled={shipInputDisabled}
                                            >
                                                MAX
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {isExploreMissionWithoutVessel && (
                            <p className="text-center text-amber-400 text-sm mt-4 p-2 bg-amber-900 bg-opacity-50 rounded-md">
                                Misja "Eksploruj" wymaga wybrania co najmniej jednego Okrętu Badawczego. Inne statki można dodać jako eskortę.
                            </p>
                        )}

                        {/* Fleet Templates */}
                        <div className="pt-4 border-t border-gray-700 mt-6">
                            <h3 className="text-xl font-semibold text-cyan-300 mb-3">Szablony Flot</h3>
                            <div className="space-y-2 mb-4">
                                {fleetTemplates.length > 0 ? (
                                    fleetTemplates.map(template => (
                                        <div key={template.name} className="flex items-center justify-between p-2 bg-gray-900 rounded-md">
                                            <span className="font-semibold">{template.name}</span>
                                            <div className="flex items-center space-x-2">
                                                <button onClick={() => handleLoadTemplate(template)} className="px-3 py-1 bg-cyan-700 text-xs font-bold rounded hover:bg-cyan-600">Wczytaj</button>
                                                <button onClick={() => onDeleteTemplate(template.name)} className="px-3 py-1 bg-red-800 text-xs font-bold rounded hover:bg-red-700">Usuń</button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-500">Brak zapisanych szablonów.</p>
                                )}
                            </div>
                            <div className="flex items-center space-x-2">
                                <input 
                                    type="text"
                                    value={templateName}
                                    onChange={e => setTemplateName(e.target.value)}
                                    placeholder="Nazwa nowego szablonu"
                                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-md px-2 py-1 focus:ring-cyan-500 focus:border-cyan-500"
                                />
                                <button onClick={handleSaveTemplateClick} className="px-4 py-1 bg-green-700 text-sm font-bold rounded hover:bg-green-600 whitespace-nowrap">Zapisz</button>
                            </div>
                        </div>

                        {/* Mission Controls */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-gray-700 mt-6">
                            <div className="flex items-center space-x-4">
                                <label htmlFor="coords" className="font-semibold text-gray-300">Cel:</label>
                                <input 
                                    type="text"
                                    id="coords"
                                    value={targetCoords}
                                    onChange={e => setTargetCoords(e.target.value)}
                                    className="w-32 bg-gray-800 border border-gray-600 text-white rounded-md px-2 py-1 text-center focus:ring-cyan-500 focus:border-cyan-500"
                                />
                            </div>
                             <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <span className="font-semibold text-gray-300">Misja:</span>
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input type="radio" name="mission" value={MissionType.ATTACK} checked={missionType === MissionType.ATTACK} onChange={() => setMissionType(MissionType.ATTACK)} className="form-radio bg-gray-700 text-cyan-500"/>
                                    <span>Atak</span>
                                </label>
                                {spyTechLevel > 0 && (
                                    <label className={`flex items-center space-x-2 ${isDisruptionActive ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`} title={isDisruptionActive ? "Rozbłysk słoneczny zakłóca systemy szpiegowskie." : ""}>
                                        <input type="radio" name="mission" value={MissionType.SPY} checked={missionType === MissionType.SPY} onChange={() => setMissionType(MissionType.SPY)} className="form-radio bg-gray-700 text-cyan-500" disabled={isDisruptionActive} />
                                        <span>Szpieguj</span>
                                    </label>
                                )}
                                {hasRecyclers && (
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="radio" name="mission" value={MissionType.HARVEST} checked={missionType === MissionType.HARVEST} onChange={() => setMissionType(MissionType.HARVEST)} className="form-radio bg-gray-700 text-cyan-500" />
                                        <span>Zbieraj</span>
                                    </label>
                                )}
                                {hasColonyShip && !isTargetOccupied && (
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="radio" name="mission" value={MissionType.COLONIZE} checked={missionType === MissionType.COLONIZE} onChange={() => setMissionType(MissionType.COLONIZE)} className="form-radio bg-gray-700 text-blue-500" />
                                        <span>Kolonizuj</span>
                                    </label>
                                )}
                                {hasAstrophysics && (
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="radio" name="mission" value={MissionType.EXPEDITION} checked={missionType === MissionType.EXPEDITION} onChange={() => setMissionType(MissionType.EXPEDITION)} className="form-radio bg-gray-700 text-purple-500"/>
                                        <span>Wyprawa</span>
                                    </label>
                                )}
                                {hasResearchVessel && !isTargetOccupied && (
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="radio" name="mission" value={MissionType.EXPLORE} checked={missionType === MissionType.EXPLORE} onChange={() => setMissionType(MissionType.EXPLORE)} className="form-radio bg-gray-700 text-teal-500" />
                                        <span>Eksploruj</span>
                                    </label>
                                )}
                            </div>
                        </div>

                        {totalShipsInMission > 0 && (
                            <div className="pt-6 border-t border-gray-700 mt-6 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-6 text-center">
                                    {totalAttack.base > 0 && (
                                        <div>
                                            <p className="text-sm text-gray-400">Siła ataku</p>
                                            <p className="text-lg font-bold text-red-400 font-mono">
                                                {formatNumber(totalAttack.base)}{' '}
                                                <span className={`text-base font-normal ${totalAttack.bonus > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                                                    (+{formatNumber(totalAttack.bonus)})
                                                </span>
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">(Tech. Bojowa: poz. {research[ResearchType.WEAPON_TECHNOLOGY] || 0})</p>
                                        </div>
                                    )}
                                    {totalShield.base > 0 && (
                                        <div>
                                            <p className="text-sm text-gray-400">Siła osłon</p>
                                            <p className="text-lg font-bold text-blue-400 font-mono">
                                                {formatNumber(totalShield.base)}{' '}
                                                <span className={`text-base font-normal ${totalShield.bonus > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                                                    (+{formatNumber(totalShield.bonus)})
                                                </span>
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">(Tech. Osłon: poz. {research[ResearchType.SHIELDING_TECHNOLOGY] || 0})</p>
                                        </div>
                                    )}
                                     {totalStructuralIntegrity.base > 0 && (
                                        <div>
                                            <p className="text-sm text-gray-400">Struktura</p>
                                            <p className="text-lg font-bold text-gray-300 font-mono">
                                                {formatNumber(totalStructuralIntegrity.base)}{' '}
                                                <span className={`text-base font-normal ${totalStructuralIntegrity.bonus > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                                                    (+
                                                    {formatNumber(totalStructuralIntegrity.bonus)})
                                                </span>
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">(Tech. Pancerza: poz. {research[ResearchType.ARMOR_TECHNOLOGY] || 0})</p>
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-around items-center pt-4 border-t border-gray-800">
                                    {fuelCost !== null && fuelCost > 0 && (
                                        <div className="text-center">
                                            <p className="text-sm text-gray-400">Pobór deuteru</p>
                                            <p className={`text-lg font-bold font-mono ${hasEnoughFuel ? 'text-purple-300' : 'text-red-500'}`}>
                                                💧 {formatNumber(fuelCost)}
                                            </p>
                                        </div>
                                    )}
                                    {travelTime !== null && (
                                        <div className="text-center">
                                            <p className="text-sm text-gray-400">Przewidywany czas podróży</p>
                                            <p className="text-lg font-bold text-cyan-300 font-mono">{formatTime(travelTime)}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        <div className="flex justify-end pt-4">
                            <button
                                onClick={handleSendFleet}
                                disabled={isSendButtonDisabled}
                                title={sendButtonDisabledReason}
                                className="w-full sm:w-auto px-8 py-3 text-base font-bold text-white rounded-md shadow-md bg-green-600 hover:bg-green-500 transition-transform transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-not-allowed"
                            >
                                Wyślij Flotę
                            </button>
                        </div>
                    </>
                )}
            </div>
            
            <div>
                <h2 className="text-2xl font-bold text-cyan-300 mb-4 border-b-2 border-cyan-800 pb-3">Ruch Flot ({fleetMissions.length})</h2>
                {fleetMissions.length === 0 ? (
                    <p className="text-gray-400">Brak aktywnych misji.</p>
                ) : (
                    <div className="space-y-2">
                        {fleetMissions.map(mission => <MissionRow key={mission.id} mission={mission} onRecall={onRecallFleet} />)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FleetPanel;