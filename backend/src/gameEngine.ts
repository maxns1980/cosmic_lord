import {
    GameState, QueueItem, BuildingType, ResearchType, ShipType, DefenseType, FleetMission, MissionType, Message, GameObject, QueueItemType, AncientArtifactStatus, AncientArtifactChoice, AncientArtifactMessage,
    Alliance, WorldState, PlayerState, Resources
} from './types.js';
import { ALL_GAME_OBJECTS, getInitialPlayerState } from './constants.js';
import { calculateProductions, calculateMaxResources } from './utils/gameLogic.js';
import { triggerAncientArtifact, triggerAsteroidImpact, triggerContraband, triggerGalacticGoldRush, triggerGhostShip, triggerPirateMercenary, triggerResourceVein, triggerSolarFlare, triggerSpacePlague, triggerStellarAurora } from './utils/eventLogic.js';
import { TestableEventType } from './types.js';

const addMessage = (gameState: GameState, message: Omit<Message, 'id' | 'timestamp' | 'isRead'>) => {
    gameState.messages.unshift({
        id: `msg-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        isRead: false,
        ...message
    } as Message);
    if (gameState.messages.length > 200) {
        gameState.messages.pop();
    }
};

const processQueues = (playerState: PlayerState, now: number) => {
    for (const location of [...Object.values(playerState.colonies), ...Object.values(playerState.moons)]) {
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
    playerState.fleetMissions = playerState.fleetMissions.filter(m => !missionsToRemove.includes(m.id));
};

export const updatePlayerStateForOfflineProgress = (playerState: PlayerState): PlayerState => {
    const now = Date.now();

    // Daily bonus check
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (!playerState.dailyBonus.isAvailable && (now - playerState.lastBonusClaimTime > twentyFourHours)) {
        playerState.dailyBonus.isAvailable = true;
        playerState.dailyBonus.rewards = {
            metal: Math.floor(Math.random() * 1001) + 1000, // 1000 - 2000
            crystal: Math.floor(Math.random() * 501) + 500,  // 500 - 1000
            credits: Math.floor(Math.random() * 401) + 100,  // 100 - 500
        };
    }

    const lastSave = playerState.lastSaveTime || now;
    const deltaSeconds = (now - lastSave) / 1000;

    if (deltaSeconds <= 1) {
        playerState.lastSaveTime = now;
        return playerState;
    }
    
    // We need world state context for productions (e.g. global events affecting production)
    // This is a simplification; for full accuracy, productions should be calculated with world state.
    // However, for offline progress, this approximation is acceptable.
    const tempGameState = { ...playerState, ...{ solarFlare: { status: 'INACTIVE' }, resourceVeinBonus: { active: false }, stellarAuroraState: { active: false } } } as any;

    const productions = calculateProductions(tempGameState);
    const maxResourcesByColony = calculateMaxResources(playerState.colonies);

    // Calculate total max resources
    const maxResources = {
        metal: Object.values(maxResourcesByColony).reduce((sum, r) => sum + r.metal, 0),
        crystal: Object.values(maxResourcesByColony).reduce((sum, r) => sum + r.crystal, 0),
        deuterium: Object.values(maxResourcesByColony).reduce((sum, r) => sum + r.deuterium, 0),
        energy: Object.values(maxResourcesByColony).reduce((sum, r) => sum + r.energy, 0),
    };


    playerState.resources.metal = Math.min(maxResources.metal, playerState.resources.metal + (productions.metal / 3600) * deltaSeconds);
    playerState.resources.crystal = Math.min(maxResources.crystal, playerState.resources.crystal + (productions.crystal / 3600) * deltaSeconds);
    const newDeuterium = playerState.resources.deuterium + (productions.deuterium / 3600) * deltaSeconds;
    playerState.resources.deuterium = Math.max(0, Math.min(maxResources.deuterium, newDeuterium));
    
    processQueues(playerState, now);
    processFleetMissions(playerState, now);
    
    playerState.lastSaveTime = now;
    return playerState;
};


export const updateWorldState = (worldState: WorldState): { updatedWorldState: WorldState, messagesForPlayers: any[] } => {
    // This function will handle global updates like NPC evolution, global events, etc.
    // For now, it's a placeholder.
    return { updatedWorldState: worldState, messagesForPlayers: [] };
};


export function handleAction(gameState: GameState, type: string, payload: any): { message?: string, error?: string } {
    switch(type) {
        case 'CREATE_ALLIANCE': {
            const { name, tag } = payload;
            if (gameState.alliance) return { error: 'Jesteś już w sojuszu.' };
            if (!name || name.length < 3 || name.length > 30) return { error: 'Nazwa sojuszu musi mieć od 3 do 30 znaków.' };
            if (!tag || tag.length < 2 || tag.length > 5) return { error: 'Tag sojuszu musi mieć od 2 do 5 znaków.' };
            const newAlliance: Alliance = { id: tag, name, tag, description: 'Witaj w naszym sojuszu!' };
            gameState.alliance = newAlliance;
            return { message: `Sojusz [${tag}] ${name} został założony!` };
        }
        case 'LEAVE_ALLIANCE': {
            if (!gameState.alliance) return { error: 'Nie jesteś w żadnym sojuszu.' };
            const allianceName = gameState.alliance.name;
            gameState.alliance = null;
            return { message: `Opuściłeś sojusz ${allianceName}.` };
        }
        case 'ADD_TO_QUEUE': {
            const { id, type, amount, activeLocationId } = payload;
            const data = ALL_GAME_OBJECTS[id as GameObject];
            if (!data) return { error: 'Invalid item ID' };
            
            const location = gameState.colonies[activeLocationId] || gameState.moons[activeLocationId];
            if(!location) return {error: "Nie znaleziono lokacji"};

            let levelOrAmount: number;
            let cost: Resources;
            let finalBuildTime: number;

            if (type === 'building' || type === 'research' || type === 'ship_upgrade') {
                levelOrAmount = (type === 'building' 
                    ? location.buildings[id as BuildingType] 
                    : type === 'research' 
                        ? gameState.research[id as ResearchType] 
                        : gameState.shipLevels[id as ShipType]) + 1;
                cost = data.cost(levelOrAmount);
                finalBuildTime = data.buildTime(levelOrAmount);
            } else { // ship or defense
                levelOrAmount = amount;
                if (!levelOrAmount || levelOrAmount <= 0) return { error: "Nieprawidłowa ilość." };
                const unitCost = data.cost(1);
                cost = {
                    metal: unitCost.metal * levelOrAmount,
                    crystal: unitCost.crystal * levelOrAmount,
                    deuterium: unitCost.deuterium * levelOrAmount,
                    energy: 0
                };
                finalBuildTime = data.buildTime(1) * levelOrAmount; // Time per unit * amount
            }

            // Check affordability
            if (gameState.resources.metal < cost.metal || gameState.resources.crystal < cost.crystal || gameState.resources.deuterium < cost.deuterium) {
                return { error: "Niewystarczające surowce!" };
            }

            // Apply time reductions
            if (type === 'research' || type === 'ship_upgrade') {
                const allColonies = Object.values(gameState.colonies);
                const homeworld = allColonies.length > 0 ? allColonies.reduce((oldest, current) => current.creationTime < oldest.creationTime ? current : oldest) : null;
                const labLevel = homeworld?.buildings[BuildingType.RESEARCH_LAB] || 0;
                if (labLevel > 0) {
                    finalBuildTime /= (1 + labLevel);
                }
            } else if (type === 'ship' || type === 'defense') {
                const shipyardLevel = location.buildings[BuildingType.SHIPYARD] || 0;
                if (shipyardLevel > 0) {
                    finalBuildTime /= (1 + shipyardLevel);
                }
            }

            // Subtract resources
            gameState.resources.metal -= cost.metal;
            gameState.resources.crystal -= cost.crystal;
            gameState.resources.deuterium -= cost.deuterium;
            
            const isShipyardQueue = type === 'ship' || type === 'defense';
            const queue = isShipyardQueue ? location.shipyardQueue : location.buildingQueue;
            
            const lastItemInQueue = queue.length > 0 ? queue[queue.length - 1] : null;
            const startTime = lastItemInQueue ? lastItemInQueue.endTime : Date.now();
            
            const newQueueItem: QueueItem = {
                id, type, levelOrAmount,
                startTime,
                buildTime: finalBuildTime,
                endTime: startTime + finalBuildTime * 1000,
            };

            queue.push(newQueueItem);

            return { message: `${data.name} dodano do kolejki.` };
        }
        case 'SEND_FLEET': {
            const { missionFleet, targetCoords, missionType, durationSeconds, fuelCost, activeLocationId } = payload;
            const location = gameState.colonies[activeLocationId] || gameState.moons[activeLocationId];
            if(!location) return {error: "Nie znaleziono lokacji"};

            for(const shipId in missionFleet) {
                location.fleet[shipId as ShipType] = (location.fleet[shipId as ShipType] || 0) - missionFleet[shipId as ShipType];
            }
            gameState.resources.deuterium -= fuelCost;

            const now = Date.now();
            const newMission: FleetMission = {
                id: `m-${now}-${Math.random()}`,
                sourceLocationId: activeLocationId,
                fleet: missionFleet, missionType, targetCoords,
                startTime: now,
                arrivalTime: now + durationSeconds * 1000,
                returnTime: now + (durationSeconds * 2 * 1000),
                processedArrival: false, loot: {},
            };
            gameState.fleetMissions.push(newMission);
            return { message: "Flota wysłana!" };
        }
        case 'RESET_GAME': {
            // This now needs to reset a player's state, not the whole game.
            // The logic to find a new home coordinate is in the signup, so we can reuse that idea.
            // For simplicity, we just reset the player's part of the state. The world state is unaffected.
            const homeCoords = Object.keys(gameState.colonies)[0]; // Keep their original home coords
            const username = gameState.occupiedCoordinates[homeCoords] || 'Gracz';
            Object.assign(gameState, getInitialPlayerState(username, homeCoords));
            return { message: 'Twoje postępy zostały zresetowane.' };
        }
        case 'ANCIENT_ARTIFACT_CHOICE': {
            if (gameState.ancientArtifactState.status !== AncientArtifactStatus.AWAITING_CHOICE) return { error: 'No artifact choice to be made.' };
            const { choice } = payload;
            const STUDY_COST = { credits: 5000, crystal: 2000 };
            const SELL_GAIN = 10000;
            let message: Omit<AncientArtifactMessage, 'id'|'timestamp'|'isRead'> = { type:'ancient_artifact', subject:'Decyzja ws. Artefaktu', choice, outcome:{} };
            switch (choice as AncientArtifactChoice) {
                case AncientArtifactChoice.STUDY:
                    if (gameState.credits < STUDY_COST.credits || gameState.resources.crystal < STUDY_COST.crystal) return { error:'Niewystarczające surowce.' };
                    gameState.credits -= STUDY_COST.credits;
                    gameState.resources.crystal -= STUDY_COST.crystal;
                    if (Math.random() < 0.4) {
                        const techs = (Object.keys(gameState.research) as ResearchType[]).filter(t => t !== 'GRAVITON_TECHNOLOGY');
                        const tech = techs[Math.floor(Math.random() * techs.length)];
                        gameState.research[tech]++;
                        message.subject = 'Sukces Badawczy!';
                        message.outcome = { success: true, technology: tech, newLevel: gameState.research[tech] };
                    } else {
                        message.subject = 'Porażka Badawcza';
                        message.outcome = { success: false };
                    }
                    break;
                case AncientArtifactChoice.SELL:
                    gameState.credits += SELL_GAIN;
                    message.subject = 'Sprzedano Artefakt';
                    message.outcome = { creditsGained: SELL_GAIN };
                    break;
                case AncientArtifactChoice.IGNORE:
                    message.subject = 'Zignorowano Artefakt';
                    break;
                default: return { error: 'Nieprawidłowy wybór.' };
            }
            gameState.ancientArtifactState.status = AncientArtifactStatus.INACTIVE;
            addMessage(gameState, message);
            return { message: 'Decyzja została podjęta.' };
        }
        case 'CLAIM_BONUS': {
            if (!gameState.dailyBonus.isAvailable) {
                return { error: 'Bonus jest niedostępny.' };
            }
            const rewards = gameState.dailyBonus.rewards;
            gameState.resources.metal += rewards.metal || 0;
            gameState.resources.crystal += rewards.crystal || 0;
            gameState.credits += rewards.credits || 0;

            gameState.dailyBonus.isAvailable = false;
            gameState.dailyBonus.rewards = {};
            gameState.lastBonusClaimTime = Date.now();

            return { message: 'Odebrano dzienną nagrodę!' };
        }
        case 'DISMISS_BONUS': {
            if (gameState.dailyBonus.isAvailable) {
                gameState.dailyBonus.isAvailable = false;
            }
            return {};
        }
        // ... stubs for other actions
        default:
            return { message: `Akcja '${type}' została przetworzona (logika do zaimplementowania).` };
    }
}