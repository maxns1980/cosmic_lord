import { GameState, QueueItem, BuildingType, ResearchType, ShipType, DefenseType, FleetMission, MissionType, DebrisField, InfoMessage, BattleReport, SpyReport, MerchantStatus, MerchantInfoMessage, NPCFleetMission, BattleMessage, SpyMessage, EspionageEventMessage, OfflineSummaryMessage, ExpeditionMessage, ColonizationMessage, MoonCreationMessage, ExplorationMessage, NPCState, Message, GameObject, QueueItemType, Loot, Resources, Fleet, ShipOffer, AncientArtifactStatus, PirateMercenaryStatus, SpacePlagueState, SolarFlareState, ContrabandState, GhostShipState, GalacticGoldRushState, StellarAuroraState, PlanetSpecialization, Boost, BoostType, TestableEventType, SolarFlareStatus, ContrabandStatus, GhostShipStatus, AncientArtifactChoice, PirateMercenaryStatus as PirateStatus, ContrabandStatus as ContraStatus, MerchantStatus as MerchStatus, GhostShipStatus as GhostStatus, AncientArtifactStatus as ArtifactStatus, Moon, Colony } from './types.js';
import { TICK_INTERVAL, ALL_GAME_OBJECTS, PLAYER_HOME_COORDS, TERRAFORMER_FIELDS_BONUS, HOMEWORLD_MAX_FIELDS_BASE, MERCHANT_CHECK_INTERVAL, MERCHANT_SPAWN_CHANCE, RANDOM_EVENT_CHECK_INTERVAL, NPC_PURGE_INTERVAL, NPC_HIBERNATION_THRESHOLD, ACTIVE_NPC_LIMIT, SLEEPER_NPC_UPDATE_INTERVAL, getInitialState, BUILDING_DATA, RESEARCH_DATA, ALL_SHIP_DATA, DEFENSE_DATA, SHIP_UPGRADE_DATA, SOLAR_FLARE_CHANCE, PIRATE_MERCENARY_CHANCE, CONTRABAND_CHANCE, ANCIENT_ARTIFACT_CHANCE, ASTEROID_IMPACT_CHANCE, RESOURCE_VEIN_CHANCE, SPACE_PLAGUE_CHANCE, GHOST_SHIP_CHANCE, GALACTIC_GOLD_RUSH_CHANCE, STELLAR_AURORA_CHANCE } from './constants.js';
import { calculateCombat } from './utils/combatLogic.js';
import { calculateProductions, calculateMaxResources, calculateNextBlackMarketIncome } from './utils/gameLogic.js';
import { evolveNpc, regenerateNpcFromSleeper, calculatePointsForNpc } from './utils/npcLogic.js';

let gameLoop: NodeJS.Timeout | null = null;
let saveLoop: NodeJS.Timeout | null = null;
let lastTickTime = Date.now();

function gameTick(gameState: GameState) {
    const now = Date.now();
    const timeDiff = (now - lastTickTime) / 1000;
    lastTickTime = now;

    // Resource Production
    const productions = calculateProductions(gameState);
    const maxRes = calculateMaxResources(gameState.colonies);
    gameState.resources.metal = Math.min(maxRes.metal, gameState.resources.metal + (productions.metal / 3600) * timeDiff);
    gameState.resources.crystal = Math.min(maxRes.crystal, gameState.resources.crystal + (productions.crystal / 3600) * timeDiff);
    gameState.resources.deuterium = Math.min(maxRes.deuterium, gameState.resources.deuterium + (productions.deuterium / 3600) * timeDiff);

    // Queue Processing
    const processQueue = (queue: QueueItem[], owner: Colony | Moon) => {
        if (queue.length > 0 && now >= queue[0].endTime) {
            const item = queue.shift()!;
            switch (item.type) {
                case 'building': owner.buildings[item.id as BuildingType]++; break;
                case 'research': gameState.research[item.id as ResearchType]++; break;
                case 'ship': owner.fleet[item.id as ShipType] = (owner.fleet[item.id as ShipType] || 0) + item.levelOrAmount; break;
                case 'defense': owner.defenses[item.id as DefenseType] = (owner.defenses[item.id as DefenseType] || 0) + item.levelOrAmount; break;
                case 'ship_upgrade': gameState.shipLevels[item.id as ShipType]++; break;
            }
        }
    };
    
    for (const colony of Object.values(gameState.colonies)) {
        processQueue(colony.buildingQueue, colony);
        processQueue(colony.shipyardQueue, colony);
    }
     for (const moon of Object.values(gameState.moons)) {
        processQueue(moon.buildingQueue, moon);
        processQueue(moon.shipyardQueue, moon);
    }


    // Fleet Mission Processing (Simplified)
    gameState.fleetMissions = gameState.fleetMissions.filter(mission => {
        if (!mission.processedArrival && now >= mission.arrivalTime) {
            mission.processedArrival = true;
            // Handle arrival logic here (battle, spy, etc.)
        }
        return now < mission.returnTime;
    });

    // NPC Evolution (Simplified)
    if (now - gameState.lastGlobalNpcCheck > 5000) {
        Object.keys(gameState.npcStates).forEach(coords => {
            const isThreatened = gameState.npcFleetMissions.some(m => m.id.startsWith('player-') && m.arrivalTime > now);
            const { updatedNpc } = evolveNpc(gameState.npcStates[coords], 5, coords, isThreatened);
            gameState.npcStates[coords] = updatedNpc;
        });
        gameState.lastGlobalNpcCheck = now;
    }
}

export function startGameEngine(gameState: GameState, saveCallback: () => void) {
    if (gameLoop) clearInterval(gameLoop);
    if (saveLoop) clearInterval(saveLoop);
    
    lastTickTime = gameState.lastSaveTime || Date.now();
    
    const offlineSeconds = (Date.now() - lastTickTime) / 1000;
    if (offlineSeconds > 1) {
        console.log(`Player was offline for ${offlineSeconds.toFixed(0)} seconds. Calculating progress...`);
        // We call gameTick with the full offline duration to catch up
        gameTick(gameState);
    }

    lastTickTime = Date.now();

    gameLoop = setInterval(() => gameTick(gameState), TICK_INTERVAL);
    saveLoop = setInterval(() => {
        gameState.lastSaveTime = Date.now();
        saveCallback();
    }, 5 * 60 * 1000); // Save every 5 minutes
    
    console.log("Game engine started.");
}

export function handleAction(gameState: GameState, type: string, payload: any): { message?: string, error?: string } {
    switch (type) {
        case 'ADD_TO_QUEUE': {
            const { id, type: itemType, amount, activeLocationId } = payload;
            if (!activeLocationId) return { error: 'Lokalizacja nie została podana.' };

            const isMoon = activeLocationId.endsWith('_moon');
            const planetId = isMoon ? activeLocationId.replace('_moon', '') : activeLocationId;

            const owner = isMoon ? gameState.moons[planetId] : gameState.colonies[planetId];
            if (!owner) return { error: 'Nieprawidłowa lokalizacja.' };

            const data = ALL_GAME_OBJECTS[id as GameObject];
            const isShipOrDefense = itemType === 'ship' || itemType === 'defense';

            let levelOrAmount: number;
            if (itemType === 'ship' || itemType === 'defense') {
                levelOrAmount = amount;
            } else if (itemType === 'building') {
                levelOrAmount = owner.buildings[id as BuildingType] + 1;
            } else if (itemType === 'research') {
                levelOrAmount = gameState.research[id as ResearchType] + 1;
            } else if (itemType === 'ship_upgrade') {
                levelOrAmount = gameState.shipLevels[id as ShipType] + 1;
            } else {
                return { error: "Nieznany typ obiektu do kolejki." };
            }

            const cost = data.cost(levelOrAmount);
            const totalCost = isShipOrDefense ? { metal: cost.metal * amount, crystal: cost.crystal * amount, deuterium: cost.deuterium * amount, energy: 0 } : cost;

            if (gameState.resources.metal < totalCost.metal || gameState.resources.crystal < totalCost.crystal || gameState.resources.deuterium < totalCost.deuterium) {
                return { error: 'Niewystarczające surowce!' };
            }

            const isGlobalQueueItem = itemType === 'research' || itemType === 'ship_upgrade';
            const queueOwner = isGlobalQueueItem ? gameState.colonies[PLAYER_HOME_COORDS] : owner;
            if (!queueOwner) return { error: "Brak planety matki do badań." };

            const queue = isShipOrDefense ? queueOwner.shipyardQueue : queueOwner.buildingQueue;

            const lastItemEndTime = queue.length > 0 ? queue[queue.length - 1].endTime : Date.now();
            let buildTime = data.buildTime(levelOrAmount);
            if (isShipOrDefense) buildTime *= amount;

            gameState.resources.metal -= totalCost.metal;
            gameState.resources.crystal -= totalCost.crystal;
            gameState.resources.deuterium -= totalCost.deuterium;

            queue.push({
                id: id as GameObject,
                type: itemType as QueueItemType,
                levelOrAmount: levelOrAmount,
                startTime: lastItemEndTime,
                endTime: lastItemEndTime + buildTime * 1000,
                buildTime: buildTime
            });

            return { message: `${data.name} dodano do kolejki.` };
        }
        case 'SEND_FLEET': {
            const { missionFleet, targetCoords, missionType, durationSeconds, fuelCost, activeLocationId } = payload;
            if (gameState.resources.deuterium < fuelCost) return { error: "Brak paliwa!" };
            if (!activeLocationId) return { error: 'Lokalizacja nie została podana.' };

            const isMoon = activeLocationId.endsWith('_moon');
            const planetId = isMoon ? activeLocationId.replace('_moon', '') : activeLocationId;
            const owner = isMoon ? gameState.moons[planetId] : gameState.colonies[planetId];
            if (!owner) return { error: 'Nieprawidłowa lokalizacja.' };

            gameState.resources.deuterium -= fuelCost;
            for(const ship in missionFleet) {
                const shipType = ship as ShipType;
                owner.fleet[shipType] = (owner.fleet[shipType] || 0) - missionFleet[shipType];
            }
            
            const now = Date.now();
            gameState.fleetMissions.push({
                id: `m-${now}`,
                sourceLocationId: activeLocationId,
                fleet: missionFleet,
                missionType,
                targetCoords,
                startTime: now,
                arrivalTime: now + durationSeconds * 1000,
                returnTime: now + durationSeconds * 2 * 1000,
                processedArrival: false,
                loot: {}
            });
            return { message: "Flota wysłana!" };
        }
         case 'RESET_GAME': {
            const initial = getInitialState();
            Object.assign(gameState, initial);
            return { message: "Gra została zresetowana." };
        }
        default:
            return { error: `Unknown action type: ${type}` };
    }
}
