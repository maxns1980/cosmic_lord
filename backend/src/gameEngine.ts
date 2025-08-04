import {
    GameState, QueueItem, BuildingType, ResearchType, ShipType, DefenseType, FleetMission, MissionType, Message, GameObject, QueueItemType, AncientArtifactStatus, AncientArtifactChoice, AncientArtifactMessage,
    Alliance, WorldState, PlayerState, Resources, Boost, BoostType, InfoMessage, DebrisField, BattleReport, BattleMessage, Colony, PlanetSpecialization, Moon, MoonCreationMessage, FleetTemplate, EspionageEventMessage, PhalanxReportMessage, DetectedFleetMission, PirateMercenaryState, PirateMercenaryStatus, NPCFleetMission
} from './types.js';
import { 
    ALL_GAME_OBJECTS, getInitialPlayerState, BUILDING_DATA, RESEARCH_DATA, ALL_SHIP_DATA, DEFENSE_DATA, SHIP_UPGRADE_DATA, HOMEWORLD_MAX_FIELDS_BASE, TERRAFORMER_FIELDS_BONUS, PHALANX_SCAN_COST,
    RANDOM_EVENT_CHECK_INTERVAL, SOLAR_FLARE_CHANCE, PIRATE_MERCENARY_CHANCE, CONTRABAND_CHANCE, ANCIENT_ARTIFACT_CHANCE, ASTEROID_IMPACT_CHANCE, RESOURCE_VEIN_CHANCE, SPACE_PLAGUE_CHANCE, GHOST_SHIP_CHANCE, GALACTIC_GOLD_RUSH_CHANCE, STELLAR_AURORA_CHANCE
} from './constants.js';
import { calculateProductions, calculateMaxResources, calculateNextBlackMarketIncome } from './utils/gameLogic.js';
import { triggerAncientArtifact, triggerAsteroidImpact, triggerContraband, triggerGalacticGoldRush, triggerGhostShip, triggerPirateMercenary, triggerResourceVein, triggerSolarFlare, triggerSpacePlague, triggerStellarAurora } from './utils/eventLogic.js';
import { TestableEventType } from './types.js';
import { calculateCombat } from './utils/combatLogic.js';
import { evolveNpc, regenerateNpcFromSleeper } from './utils/npcLogic.js';

const addMessage = (playerState: PlayerState, message: Omit<Message, 'id' | 'timestamp' | 'isRead'>) => {
    playerState.messages.unshift({
        id: `msg-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        isRead: false,
        ...message
    } as Message);
    if (playerState.messages.length > 200) {
        playerState.messages.pop();
    }
};

const processQueues = (playerState: PlayerState, now: number) => {
    const locations: (Colony | Moon)[] = [...Object.values(playerState.colonies), ...Object.values(playerState.moons)];
    for (const location of locations) {
        let hasChanged = true;
        while(hasChanged) {
            hasChanged = false;

            // Process Building/Research Queue
            if (location.buildingQueue.length > 0 && now >= location.buildingQueue[0].endTime) {
                const finished = location.buildingQueue.shift()!;
                if (finished.type === 'building') {
                    location.buildings[finished.id as BuildingType] = finished.levelOrAmount;
                } else if (finished.type === 'research') {
                    playerState.research[finished.id as ResearchType] = finished.levelOrAmount;
                } else if (finished.type === 'ship_upgrade') {
                    playerState.shipLevels[finished.id as ShipType] = finished.levelOrAmount;
                }
                hasChanged = true;
            }

            // Process Shipyard Queue
            if (location.shipyardQueue.length > 0 && now >= location.shipyardQueue[0].endTime) {
                const finished = location.shipyardQueue.shift()!;
                if (finished.type === 'ship') {
                    location.fleet[finished.id as ShipType] = (location.fleet[finished.id as ShipType] || 0) + finished.levelOrAmount;
                } else if (finished.type === 'defense') {
                    location.defenses[finished.id as DefenseType] = (location.defenses[finished.id as DefenseType] || 0) + finished.levelOrAmount;
                }
                hasChanged = true;
            }
        }
    }
};

const processFleetMissions = (playerState: PlayerState, now: number) => {
    const missionsToRemove: string[] = [];
    for (const mission of playerState.fleetMissions) {
        if (!mission.processedArrival && now >= mission.arrivalTime) {
            mission.processedArrival = true;
            // Handle different mission arrivals
        }
        if (mission.processedArrival && now >= mission.returnTime) {
            const sourceLocation = playerState.colonies[mission.sourceLocationId] || playerState.moons[mission.sourceLocationId];
            if (sourceLocation) {
                for (const shipType in mission.fleet) {
                    sourceLocation.fleet[shipType as ShipType] = (sourceLocation.fleet[shipType as ShipType] || 0) + (mission.fleet[shipType as ShipType] || 0);
                }
            }
            playerState.resources.metal += mission.loot.metal || 0;
            playerState.resources.crystal += mission.loot.crystal || 0;
            playerState.resources.deuterium += mission.loot.deuterium || 0;
            missionsToRemove.push(mission.id);
        }
    }
    playerState.fleetMissions = playerState.fleetMissions.filter((m: FleetMission) => !missionsToRemove.includes(m.id));
};

export const processRandomEvents = (gameState: GameState): GameState => {
    const now = Date.now();
    // Use last check time from world state
    if (now - gameState.lastEventCheckTime < RANDOM_EVENT_CHECK_INTERVAL) {
        return gameState;
    }

    // Update check time immediately to prevent re-triggering on rapid reloads
    gameState.lastEventCheckTime = now;

    // Check for each event
    if (Math.random() < SOLAR_FLARE_CHANCE) {
        triggerSolarFlare(gameState);
    }
    if (Math.random() < PIRATE_MERCENARY_CHANCE) {
        triggerPirateMercenary(gameState);
    }
    if (Math.random() < CONTRABAND_CHANCE) {
        triggerContraband(gameState);
    }
    if (Math.random() < ANCIENT_ARTIFACT_CHANCE) {
        triggerAncientArtifact(gameState);
    }
    if (Math.random() < ASTEROID_IMPACT_CHANCE) {
        triggerAsteroidImpact(gameState);
    }
    if (Math.random() < RESOURCE_VEIN_CHANCE) {
        triggerResourceVein(gameState);
    }
    if (Math.random() < SPACE_PLAGUE_CHANCE) {
        triggerSpacePlague(gameState);
    }
    if (Math.random() < GHOST_SHIP_CHANCE) {
        triggerGhostShip(gameState);
    }
    if (Math.random() < GALACTIC_GOLD_RUSH_CHANCE) {
        triggerGalacticGoldRush(gameState);
    }
    if (Math.random() < STELLAR_AURORA_CHANCE) {
        triggerStellarAurora(gameState);
    }

    return gameState;
};


export const updatePlayerStateForOfflineProgress = (playerState: PlayerState, worldState: WorldState): PlayerState => {
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const hasUnclaimedBonus = playerState.inventory.boosts.some(b => b.type === BoostType.DAILY_BONUS_CRATE);

    if (now - playerState.lastBonusClaimTime > twentyFourHours && !hasUnclaimedBonus) {
        const rewards = {
            metal: Math.floor(Math.random() * 1001) + 1000,
            crystal: Math.floor(Math.random() * 501) + 500,
            credits: Math.floor(Math.random() * 401) + 100,
        };

        const bonusCrate: Boost = {
            id: `daily-bonus-${now}`,
            type: BoostType.DAILY_BONUS_CRATE,
            level: 1,
            duration: 0,
            rewards,
        };

        playerState.inventory.boosts.push(bonusCrate);
        
        addMessage(playerState, {
            type: 'info',
            subject: 'Otrzymano Dzienną Skrzynię!',
            text: 'Twoja codzienna nagroda za lojalność została dodana do Twojego inwentarza. Aktywuj ją, kiedy zechcesz!'
        } as InfoMessage);
    }

    const lastSave = playerState.lastSaveTime || now;
    const deltaSeconds = (now - lastSave) / 1000;

    if (deltaSeconds <= 1) {
        playerState.lastSaveTime = now;
        return playerState;
    }
    
    // We need a temporary GameState object for production calculations
    const tempGameState = { ...playerState, ...worldState } as GameState;
    const productions = calculateProductions(tempGameState);
    
    const perColonyMaxRes = calculateMaxResources(playerState.colonies);
    const totalMaxResources: Resources = Object.values(perColonyMaxRes).reduce((acc: Resources, res: Resources) => {
        acc.metal += res.metal;
        acc.crystal += res.crystal;
        acc.deuterium += res.deuterium;
        acc.energy += res.energy;
        return acc;
    }, { metal: 0, crystal: 0, deuterium: 0, energy: 0 });

    playerState.resources.metal = Math.min(totalMaxResources.metal, playerState.resources.metal + (productions.metal / 3600) * deltaSeconds);
    playerState.resources.crystal = Math.min(totalMaxResources.crystal, playerState.resources.crystal + (productions.crystal / 3600) * deltaSeconds);
    playerState.resources.deuterium = Math.min(totalMaxResources.deuterium, playerState.resources.deuterium + (productions.deuterium / 3600) * deltaSeconds);

    processQueues(playerState, now);
    processFleetMissions(playerState, now);

    playerState.lastSaveTime = now;
    return playerState;
};

export const updateWorldState = (worldState: WorldState): { updatedWorldState: WorldState, newPlayerMessages: Record<string, Message[]> } => {
    const now = Date.now();
    // Use last check time from world state, default to 1 min ago if it's missing for some reason
    const lastCheck = worldState.lastGlobalNpcCheck || (now - 60 * 1000);
    const deltaSeconds = (now - lastCheck) / 1000;

    // To prevent excessive processing on rapid requests, only update if at least a minute has passed.
    if (deltaSeconds < 60) {
        return { updatedWorldState: worldState, newPlayerMessages: {} };
    }
    
    const updatedNpcStates = { ...worldState.npcStates };
    const newNpcMissions = [...worldState.npcFleetMissions];

    // Evolve all NPCs based on the time that has passed
    for (const coords in updatedNpcStates) {
        const npc = updatedNpcStates[coords];
        // For now, threat detection is simplified: an NPC is threatened if a player fleet is heading towards it.
        // This would require player state access, so we'll pass false.
        const isThreatened = false; 
        
        const { updatedNpc, mission } = evolveNpc(npc, deltaSeconds, coords, isThreatened);
        updatedNpcStates[coords] = updatedNpc;
        
        if (mission) {
            newNpcMissions.push(mission);
            // In a full implementation, we would alert the target player.
        }
    }
    
    // Process NPC missions to remove completed ones. A full combat implementation is complex and deferred.
    const activeNpcMissions = newNpcMissions.filter(mission => now < mission.arrivalTime);

    const updatedWorldState: WorldState = {
        ...worldState,
        npcStates: updatedNpcStates,
        npcFleetMissions: activeNpcMissions,
        lastGlobalNpcCheck: now,
    };

    return { updatedWorldState, newPlayerMessages: {} };
}


export const handleAction = (gameState: GameState, type: string, payload: any): { message?: string, error?: string } => {
    switch (type) {
        case 'ACTIVATE_BOOST': {
            const { boostId } = payload;
            const boostIndex = gameState.inventory.boosts.findIndex((b: Boost) => b.id === boostId);
            if (boostIndex === -1) {
                return { error: "Bonus nie został znaleziony." };
            }
            const boost = gameState.inventory.boosts[boostIndex];

            if (boost.type === BoostType.DAILY_BONUS_CRATE && boost.rewards) {
                gameState.resources.metal += boost.rewards.metal || 0;
                gameState.resources.crystal += boost.rewards.crystal || 0;
                gameState.resources.deuterium += boost.rewards.deuterium || 0;
                gameState.credits += boost.rewards.credits || 0;
                
                gameState.inventory.boosts.splice(boostIndex, 1);
                gameState.lastBonusClaimTime = Date.now();
                return { message: "Odebrano nagrody ze skrzyni!" };
            }

            return { error: "Tego bonusa nie można aktywować w ten sposób." };
        }

        // Other actions will go here...
        case 'ADD_TO_QUEUE': {
            const { id, type: queueType, amount, activeLocationId } = payload;
            const location = gameState.colonies[activeLocationId] || gameState.moons[activeLocationId];
            if (!location) return { error: 'Nieprawidłowa lokalizacja.' };
            
            const data = ALL_GAME_OBJECTS[id as GameObject];
            const isShipyard = queueType === 'ship' || queueType === 'defense';
            const levelOrAmount = isShipyard ? amount : (queueType === 'building' ? location.buildings[id as BuildingType] + 1 : (queueType === 'research' ? gameState.research[id as ResearchType] + 1 : gameState.shipLevels[id as ShipType] + 1));
            
            const cost = data.cost(levelOrAmount);
            const totalCost = isShipyard ? { metal: cost.metal * amount, crystal: cost.crystal * amount, deuterium: cost.deuterium * amount, energy: 0 } : cost;
            
            if (gameState.resources.metal < totalCost.metal || gameState.resources.crystal < totalCost.crystal || gameState.resources.deuterium < totalCost.deuterium) {
                return { error: 'Niewystarczające surowce.' };
            }

            gameState.resources.metal -= totalCost.metal;
            gameState.resources.crystal -= totalCost.crystal;
            gameState.resources.deuterium -= totalCost.deuterium;

            const now = Date.now();
            const lastItemEndTime = isShipyard 
                ? location.shipyardQueue[location.shipyardQueue.length - 1]?.endTime || now
                : location.buildingQueue[location.buildingQueue.length - 1]?.endTime || now;

            let buildTime: number;
            if (queueType === 'research') {
                const labLevel = gameState.colonies[Object.keys(gameState.colonies)[0]].buildings[BuildingType.RESEARCH_LAB] || 1;
                buildTime = data.buildTime(levelOrAmount) / (1 + labLevel);
            } else if (isShipyard) {
                const shipyardLevel = location.buildings[BuildingType.SHIPYARD] || 1;
                buildTime = data.buildTime(1) * amount / (1 + shipyardLevel);
            } else {
                buildTime = data.buildTime(levelOrAmount);
            }

            const newItem: QueueItem = {
                id: id as GameObject,
                type: queueType,
                levelOrAmount,
                startTime: lastItemEndTime,
                endTime: lastItemEndTime + buildTime * 1000,
                buildTime,
            };

            if (isShipyard) {
                location.shipyardQueue.push(newItem);
            } else {
                location.buildingQueue.push(newItem);
            }

            return { message: `${data.name} dodano do kolejki.` };
        }
        
        default:
            return { error: 'Unknown action type.' };
    }
};