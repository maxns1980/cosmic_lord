import {
    GameState, QueueItem, BuildingType, ResearchType, ShipType, DefenseType, FleetMission, MissionType, DebrisField, InfoMessage, BattleReport, SpyReport, MerchantStatus, MerchantInfoMessage, NPCFleetMission, BattleMessage, SpyMessage, EspionageEventMessage, OfflineSummaryMessage, ExpeditionMessage, ColonizationMessage, MoonCreationMessage, ExplorationMessage, NPCState, Message, GameObject, QueueItemType, Loot, Resources, Fleet, ShipOffer, AncientArtifactStatus, PirateMercenaryStatus, SpacePlagueState, ContrabandStatus, ContrabandOfferType, ActiveBoosts, BoostType, TestableEventType, GhostShipStatus, AncientArtifactChoice, GhostShipChoice, PlanetSpecialization, AncientArtifactMessage,
    Alliance
} from './types.js';
import { ALL_GAME_OBJECTS, TICK_INTERVAL, getInitialState, PLAYER_HOME_COORDS, ALL_SHIP_DATA, PHALANX_SCAN_COST } from './constants.js';
import { calculateProductions } from './utils/gameLogic.js';
import { calculateCombat } from './utils/combatLogic.js';
import { triggerAncientArtifact, triggerAsteroidImpact, triggerContraband, triggerGalacticGoldRush, triggerGhostShip, triggerPirateMercenary, triggerResourceVein, triggerSolarFlare, triggerSpacePlague, triggerStellarAurora } from './utils/eventLogic.js';

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

const processQueues = (gameState: GameState) => {
    const now = Date.now();
    for (const colony of Object.values(gameState.colonies)) {
        // Process Building Queue
        if (colony.buildingQueue.length > 0 && now >= colony.buildingQueue[0].endTime) {
            const finished = colony.buildingQueue.shift()!;
            if (finished.type === 'building') {
                colony.buildings[finished.id as BuildingType] = finished.levelOrAmount;
            } else if (finished.type === 'research') {
                gameState.research[finished.id as ResearchType] = finished.levelOrAmount;
            } else if (finished.type === 'ship_upgrade') {
                gameState.shipLevels[finished.id as ShipType] = finished.levelOrAmount;
            }
        }
        // Process Shipyard Queue
        if (colony.shipyardQueue.length > 0 && now >= colony.shipyardQueue[0].endTime) {
            const finished = colony.shipyardQueue.shift()!;
            if (finished.type === 'ship') {
                colony.fleet[finished.id as ShipType] = (colony.fleet[finished.id as ShipType] || 0) + finished.levelOrAmount;
            } else if (finished.type === 'defense') {
                colony.defenses[finished.id as DefenseType] = (colony.defenses[finished.id as DefenseType] || 0) + finished.levelOrAmount;
            }
        }
    }
};

const processFleetMissions = (gameState: GameState) => {
    const now = Date.now();
    const missionsToRemove: string[] = [];

    for (const mission of gameState.fleetMissions) {
        // Process arrival at target
        if (!mission.processedArrival && now >= mission.arrivalTime) {
            mission.processedArrival = true;
            // TODO: Implement arrival logic for different mission types (attack, spy, etc.)
            switch(mission.missionType){
                case MissionType.ATTACK:
                    // Here we would find the target (NPC or other player) and calculate combat
                    addMessage(gameState, {
                        type: 'info',
                        subject: 'Flota dotarła do celu',
                        text: `Twoja flota dotarła do ${mission.targetCoords} i rozpoczyna atak.`
                    } as InfoMessage);
                    break;
                // Other cases...
            }
        }

        // Process return to home
        if (mission.processedArrival && now >= mission.returnTime) {
            const sourceColony = gameState.colonies[mission.sourceLocationId] || gameState.moons[mission.sourceLocationId];
            if (sourceColony) {
                for (const shipType in mission.fleet) {
                    sourceColony.fleet[shipType as ShipType] = (sourceColony.fleet[shipType as ShipType] || 0) + (mission.fleet[shipType as ShipType] || 0);
                }
            }
            // Add loot to resources
            gameState.resources.metal += mission.loot.metal || 0;
            gameState.resources.crystal += mission.loot.crystal || 0;
            gameState.resources.deuterium += mission.loot.deuterium || 0;

            missionsToRemove.push(mission.id);
        }
    }

    gameState.fleetMissions = gameState.fleetMissions.filter(m => !missionsToRemove.includes(m.id));
};


export function startGameEngine(gameState: GameState, saveGameState: () => Promise<void>) {
    if (gameLoop) {
        clearInterval(gameLoop);
    }

    let lastTick = Date.now();

    gameLoop = setInterval(() => {
        const now = Date.now();
        const delta = (now - lastTick) / 1000; // time in seconds since last tick
        lastTick = now;

        // 1. Resource production
        const productions = calculateProductions(gameState);
        gameState.resources.metal = Math.min(calculateProductions(gameState).energy.efficiency, gameState.resources.metal + (productions.metal / 3600) * delta);
        gameState.resources.crystal = Math.min(calculateProductions(gameState).energy.efficiency, gameState.resources.crystal + (productions.crystal / 3600) * delta);
        gameState.resources.deuterium += (productions.deuterium / 3600) * delta; // can be negative

        // 2. Process queues
        processQueues(gameState);

        // 3. Process fleet movements
        processFleetMissions(gameState);

        // 4. Check events, NPCs, etc. periodically
        
        // 5. Save state periodically
        if (now - gameState.lastSaveTime > 5000) { // Save every 5 seconds
            gameState.lastSaveTime = now;
            saveGameState();
        }

    }, TICK_INTERVAL);
}

export function handleAction(gameState: GameState, type: string, payload: any): { message?: string, error?: string } {
    switch(type) {
        case 'CREATE_ALLIANCE': {
            const { name, tag } = payload;
            if (gameState.alliance) {
                return { error: 'Jesteś już w sojuszu.' };
            }
            if (!name || name.length < 3 || name.length > 30) {
                return { error: 'Nazwa sojuszu musi mieć od 3 do 30 znaków.' };
            }
            if (!tag || tag.length < 2 || tag.length > 5) {
                return { error: 'Tag sojuszu musi mieć od 2 do 5 znaków.' };
            }

            const newAlliance: Alliance = {
                id: tag, // Use tag as ID for now
                name: name,
                tag: tag,
                description: 'Witaj w naszym sojuszu!',
            };
            gameState.alliance = newAlliance;
            return { message: `Sojusz [${tag}] ${name} został założony!` };
        }
        case 'LEAVE_ALLIANCE': {
            if (!gameState.alliance) {
                return { error: 'Nie jesteś w żadnym sojuszu.' };
            }
            const allianceName = gameState.alliance.name;
            gameState.alliance = null;
            return { message: `Opuściłeś sojusz ${allianceName}.` };
        }
        case 'ADD_TO_QUEUE': {
            const { id, type, amount, activeLocationId } = payload;
            // Simplified: Add logic for checking resources, requirements, queue capacity
            const data = ALL_GAME_OBJECTS[id as GameObject];
            if (!data) return { error: 'Invalid item ID' };
            const cost = data.cost(1); // Simplified
            
            const colony = gameState.colonies[activeLocationId];
            if(!colony) return {error: "Colony not found"};
            
            const newQueueItem: QueueItem = {
                id: id,
                type: type,
                levelOrAmount: (type === 'building' || type === 'research' || type === 'ship_upgrade' ? (type === 'building' ? colony.buildings[id as BuildingType] : type === 'research' ? gameState.research[id as ResearchType] : gameState.shipLevels[id as ShipType]) + 1 : amount),
                startTime: Date.now(),
                buildTime: data.buildTime(1), // Simplified
                endTime: Date.now() + data.buildTime(1) * 1000, // Simplified
            };

            if (type === 'ship' || type === 'defense') {
                colony.shipyardQueue.push(newQueueItem);
            } else {
                colony.buildingQueue.push(newQueueItem);
            }
            return { message: `${data.name} dodano do kolejki.` };
        }
        case 'SEND_FLEET': {
            const { missionFleet, targetCoords, missionType, durationSeconds, fuelCost, activeLocationId } = payload;
            
            const colony = gameState.colonies[activeLocationId];
            if(!colony) return {error: "Colony not found"};

            // Deduct fleet and fuel
            for(const shipId in missionFleet) {
                colony.fleet[shipId as ShipType] = (colony.fleet[shipId as ShipType] || 0) - missionFleet[shipId as ShipType];
            }
            gameState.resources.deuterium -= fuelCost;

            const now = Date.now();
            const newMission: FleetMission = {
                id: `m-${now}-${Math.random()}`,
                sourceLocationId: activeLocationId,
                fleet: missionFleet,
                missionType,
                targetCoords,
                startTime: now,
                arrivalTime: now + durationSeconds * 1000,
                returnTime: now + (durationSeconds * 2 * 1000),
                processedArrival: false,
                loot: {},
            };
            gameState.fleetMissions.push(newMission);
            return { message: "Flota wysłana!" };
        }
        case 'RESET_GAME': {
            const freshState = getInitialState();
            Object.assign(gameState, freshState);
            return { message: 'Gra została zresetowana.' };
        }
        // Add stubs for other actions
        case 'MERCHANT_TRADE':
        case 'MERCHANT_BUY_SHIP':
        case 'READ_MESSAGE':
        case 'DELETE_MESSAGE':
        case 'DELETE_ALL_MESSAGES':
        case 'SEND_SPY':
        case 'SEND_EXPEDITION':
        case 'SEND_EXPLORE':
        case 'SEND_HARVEST':
        case 'PHALANX_SCAN':
        case 'RECALL_FLEET':
        case 'SAVE_TEMPLATE':
        case 'DELETE_TEMPLATE':
        case 'TOGGLE_FAVORITE':
        case 'CLAIM_BONUS':
        case 'DISMISS_BONUS':
        case 'GHOST_SHIP_CHOICE':
        case 'ANCIENT_ARTIFACT_CHOICE': {
            if (gameState.ancientArtifactState.status !== AncientArtifactStatus.AWAITING_CHOICE) {
                return { error: 'No artifact choice to be made.' };
            }
            const { choice } = payload;
            const STUDY_COST = { credits: 5000, crystal: 2000 };
            const SELL_GAIN = 10000;

            let message: Omit<AncientArtifactMessage, 'id' | 'timestamp' | 'isRead'> = {
                type: 'ancient_artifact',
                subject: 'Decyzja ws. Artefaktu',
                choice: choice,
                outcome: {}
            };

            switch (choice as AncientArtifactChoice) {
                case AncientArtifactChoice.STUDY:
                    if (gameState.credits < STUDY_COST.credits || gameState.resources.crystal < STUDY_COST.crystal) {
                        return { error: 'Niewystarczające surowce do zbadania artefaktu.' };
                    }
                    gameState.credits -= STUDY_COST.credits;
                    gameState.resources.crystal -= STUDY_COST.crystal;

                    const successChance = 0.4; // 40% chance of success
                    if (Math.random() < successChance) {
                        // Find a random technology to level up
                        const availableTechs = (Object.keys(gameState.research) as ResearchType[]).filter(
                            t => t !== ResearchType.GRAVITON_TECHNOLOGY // Exclude special techs
                        );
                        const randomTech = availableTechs[Math.floor(Math.random() * availableTechs.length)];
                        
                        gameState.research[randomTech]++;
                        const newLevel = gameState.research[randomTech];

                        message.subject = 'Sukces Badawczy!';
                        message.outcome = {
                            success: true,
                            technology: randomTech,
                            newLevel: newLevel
                        };
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

                default:
                    return { error: 'Nieprawidłowy wybór.' };
            }
            
            gameState.ancientArtifactState.status = AncientArtifactStatus.INACTIVE;
            addMessage(gameState, message);
            
            return { message: 'Decyzja została podjęta.' };
        }
        case 'CONTRABAND_DEAL':
        case 'ACTIVATE_BOOST':
            // Placeholder logic
            return { message: `Akcja '${type}' została przetworzona.` };

        case 'TRIGGER_EVENT': {
            const { eventType } = payload;
            switch(eventType as TestableEventType) {
                case TestableEventType.SOLAR_FLARE: triggerSolarFlare(gameState); break;
                case TestableEventType.PIRATE_MERCENARY: triggerPirateMercenary(gameState); break;
                case TestableEventType.CONTRABAND: triggerContraband(gameState); break;
                case TestableEventType.ANCIENT_ARTIFACT: triggerAncientArtifact(gameState); break;
                case TestableEventType.ASTEROID_IMPACT: triggerAsteroidImpact(gameState); break;
                case TestableEventType.RESOURCE_VEIN: triggerResourceVein(gameState); break;
                case TestableEventType.SPACE_PLAGUE: triggerSpacePlague(gameState); break;
                case TestableEventType.GHOST_SHIP: triggerGhostShip(gameState); break;
                case TestableEventType.GALACTIC_GOLD_RUSH: triggerGalacticGoldRush(gameState); break;
                case TestableEventType.STELLAR_AURORA: triggerStellarAurora(gameState); break;
            }
            return { message: `Wydarzenie ${eventType} zostało wywołane.` };
        }

        default:
            return { error: `Nieznana akcja: ${type}` };
    }
}
