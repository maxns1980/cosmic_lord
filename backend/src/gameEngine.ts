import {
    GameState, QueueItem, BuildingType, ResearchType, ShipType, DefenseType, FleetMission, MissionType, Message, GameObject, QueueItemType, AncientArtifactStatus, AncientArtifactChoice, AncientArtifactMessage,
    Alliance
} from './types.js';
import { ALL_GAME_OBJECTS, getInitialState } from './constants.js';
import { calculateProductions, calculateMaxResources } from './utils/gameLogic.js';
import { triggerAncientArtifact, triggerAsteroidImpact, triggerContraband, triggerGalacticGoldRush, triggerGhostShip, triggerPirateMercenary, triggerResourceVein, triggerSolarFlare, triggerSpacePlague, triggerStellarAurora } from './utils/eventLogic.js';
import { TestableEventType } from './types.js';

let gameLoop: NodeJS.Timeout | null = null;

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

const processQueues = (gameState: GameState, now: number) => {
    for (const location of [...Object.values(gameState.colonies), ...Object.values(gameState.moons)]) {
        let hasChanged = true;
        while(hasChanged) {
            hasChanged = false;

            // Process Building/Research Queue
            if (location.buildingQueue.length > 0 && now >= location.buildingQueue[0].endTime) {
                const finished = location.buildingQueue.shift()!;
                if (finished.type === 'building') {
                    location.buildings[finished.id as BuildingType] = finished.levelOrAmount;
                } else if (finished.type === 'research') {
                    gameState.research[finished.id as ResearchType] = finished.levelOrAmount;
                } else if (finished.type === 'ship_upgrade') {
                    gameState.shipLevels[finished.id as ShipType] = finished.levelOrAmount;
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

const processFleetMissions = (gameState: GameState, now: number) => {
    const missionsToRemove: string[] = [];
    for (const mission of gameState.fleetMissions) {
        if (!mission.processedArrival && now >= mission.arrivalTime) {
            mission.processedArrival = true;
            // Handle different mission arrivals
        }
        if (mission.processedArrival && now >= mission.returnTime) {
            const sourceLocation = gameState.colonies[mission.sourceLocationId] || gameState.moons[mission.sourceLocationId];
            if (sourceLocation) {
                for (const shipType in mission.fleet) {
                    sourceLocation.fleet[shipType as ShipType] = (sourceLocation.fleet[shipType as ShipType] || 0) + (mission.fleet[shipType as ShipType] || 0);
                }
            }
            gameState.resources.metal += mission.loot.metal || 0;
            gameState.resources.crystal += mission.loot.crystal || 0;
            gameState.resources.deuterium += mission.loot.deuterium || 0;
            missionsToRemove.push(mission.id);
        }
    }
    gameState.fleetMissions = gameState.fleetMissions.filter(m => !missionsToRemove.includes(m.id));
};

export const updateStateForOfflineProgress = (gameState: GameState): GameState => {
    const now = Date.now();
    const lastSave = gameState.lastSaveTime || now;
    const deltaSeconds = (now - lastSave) / 1000;

    if (deltaSeconds <= 1) {
        return gameState;
    }

    const productions = calculateProductions(gameState);
    const maxResources = calculateMaxResources(gameState.colonies);

    gameState.resources.metal = Math.min(maxResources.metal, gameState.resources.metal + (productions.metal / 3600) * deltaSeconds);
    gameState.resources.crystal = Math.min(maxResources.crystal, gameState.resources.crystal + (productions.crystal / 3600) * deltaSeconds);
    const newDeuterium = gameState.resources.deuterium + (productions.deuterium / 3600) * deltaSeconds;
    gameState.resources.deuterium = Math.max(0, Math.min(maxResources.deuterium, newDeuterium));
    
    processQueues(gameState, now);
    processFleetMissions(gameState, now);
    
    // Placeholder for event processing during offline time
    
    gameState.lastSaveTime = now;
    return gameState;
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
            
            const cost = data.cost(1); // Simplified for now
            
            const newQueueItem: QueueItem = {
                id, type,
                levelOrAmount: (type === 'building' || type === 'research' || type === 'ship_upgrade' ? (type === 'building' ? location.buildings[id as BuildingType] : type === 'research' ? gameState.research[id as ResearchType] : gameState.shipLevels[id as ShipType]) + 1 : amount),
                startTime: Date.now(),
                buildTime: data.buildTime(1),
                endTime: Date.now() + data.buildTime(1) * 1000,
            };

            if (type === 'ship' || type === 'defense') {
                location.shipyardQueue.push(newQueueItem);
            } else {
                location.buildingQueue.push(newQueueItem);
            }
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
            Object.assign(gameState, getInitialState());
            return { message: 'Gra została zresetowana.' };
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
        // ... stubs for other actions
        default:
            return { message: `Akcja '${type}' została przetworzona (logika do zaimplementowania).` };
    }
}
