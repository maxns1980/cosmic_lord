import { GameState, QueueItem, BuildingType, ResearchType, ShipType, DefenseType, FleetMission, MissionType, DebrisField, InfoMessage, BattleReport, SpyReport, MerchantStatus, MerchantInfoMessage, NPCFleetMission, BattleMessage, SpyMessage, EspionageEventMessage, OfflineSummaryMessage, ExpeditionMessage, ColonizationMessage, MoonCreationMessage, ExplorationMessage, NPCState, Message, GameObject, QueueItemType, Loot, Resources, Fleet, ShipOffer, AncientArtifactStatus, PirateMercenaryStatus, SpacePlagueState, SolarFlareState, ContrabandState, GhostShipState, GalacticGoldRushState, StellarAuroraState, PlanetSpecialization, Boost, BoostType, TestableEventType, SolarFlareStatus, ContrabandStatus, GhostShipStatus } from './types.js';
import { TICK_INTERVAL, ALL_GAME_OBJECTS, PLAYER_HOME_COORDS, TERRAFORMER_FIELDS_BONUS, HOMEWORLD_MAX_FIELDS_BASE, MERCHANT_CHECK_INTERVAL, MERCHANT_SPAWN_CHANCE, RANDOM_EVENT_CHECK_INTERVAL, NPC_PURGE_INTERVAL, NPC_HIBERNATION_THRESHOLD, ACTIVE_NPC_LIMIT, SLEEPER_NPC_UPDATE_INTERVAL, getInitialState, BUILDING_DATA, RESEARCH_DATA, ALL_SHIP_DATA, DEFENSE_DATA, SHIP_UPGRADE_DATA, SOLAR_FLARE_CHANCE, PIRATE_MERCENARY_CHANCE, CONTRABAND_CHANCE, ANCIENT_ARTIFACT_CHANCE, ASTEROID_IMPACT_CHANCE, RESOURCE_VEIN_CHANCE, SPACE_PLAGUE_CHANCE, GHOST_SHIP_CHANCE, GALACTIC_GOLD_RUSH_CHANCE, STELLAR_AURORA_CHANCE } from './constants.js';
import { calculateCombat } from './utils/combatLogic.js';
import { calculateProductions, calculateMaxResources, calculateNextBlackMarketIncome } from './utils/gameLogic.js';
import { evolveNpc, regenerateNpcFromSleeper, calculatePointsForNpc } from './utils/npcLogic.js';

let gameLoop: any = null; // Use 'any' to avoid NodeJS.Timeout vs number type conflicts
let saveLoop: any = null;
let lastTickTime = Date.now();

// This is where the core logic of the game runs.
function gameTick(gameState: GameState) {
    const now = Date.now();
    const timeDiff = (now - lastTickTime) / 1000; // in seconds
    lastTickTime = now;

    // 1. Resource Production
    const productions = calculateProductions(gameState.buildings, gameState.resourceVeinBonus, gameState.colonies, gameState.activeBoosts, gameState.solarFlare, gameState.fleet, gameState.stellarAuroraState, gameState.research);
    const maxRes = calculateMaxResources(gameState.buildings);
    
    gameState.resources.metal = Math.min(maxRes.metal, gameState.resources.metal + (productions.metal / 3600) * timeDiff);
    gameState.resources.crystal = Math.min(maxRes.crystal, gameState.resources.crystal + (productions.crystal / 3600) * timeDiff);
    gameState.resources.deuterium = Math.min(maxRes.deuterium, gameState.resources.deuterium + (productions.deuterium / 3600) * timeDiff);

    // 2. Queue Processing (Building & Shipyard)
    const processQueue = (queue: QueueItem[], type: 'building' | 'shipyard') => {
        if (queue.length > 0) {
            const currentItem = queue[0];
            if (now >= currentItem.endTime) {
                switch (currentItem.type) {
                    case 'building': gameState.buildings[currentItem.id as BuildingType]++; break;
                    case 'research': gameState.research[currentItem.id as ResearchType]++; break;
                    case 'ship': gameState.fleet[currentItem.id as ShipType] = (gameState.fleet[currentItem.id as ShipType] || 0) + currentItem.levelOrAmount; break;
                    case 'defense': gameState.defenses[currentItem.id as DefenseType] = (gameState.defenses[currentItem.id as DefenseType] || 0) + currentItem.levelOrAmount; break;
                    case 'ship_upgrade': gameState.shipLevels[currentItem.id as ShipType]++; break;
                }
                queue.shift();
            }
        }
    }
    processQueue(gameState.buildingQueue, 'building');
    processQueue(gameState.shipyardQueue, 'shipyard');

    // 3. Fleet Mission Processing
    // ... [This is a very large section, will be implemented] ...
    
    // 4. Black Market Income
    if (now >= gameState.lastBlackMarketIncomeCheck + 3600 * 1000) {
        if (gameState.buildings[BuildingType.BLACK_MARKET] > 0) {
            gameState.credits += gameState.nextBlackMarketIncome;
            gameState.nextBlackMarketIncome = calculateNextBlackMarketIncome(gameState.buildings[BuildingType.BLACK_MARKET]);
        }
        gameState.lastBlackMarketIncomeCheck = now;
    }
    
    // 5. NPC Evolution
    // ... [This is also a large section] ...

    // 6. Random Events
    // ... [This is also a large section] ...
}

export function startGameEngine(gameState: GameState, saveCallback: () => void) {
    if (gameLoop) clearInterval(gameLoop);
    if (saveLoop) clearInterval(saveLoop);
    
    lastTickTime = gameState.lastSaveTime || Date.now();
    
    // Calculate offline progress
    const offlineSeconds = (Date.now() - lastTickTime) / 1000;
    if (offlineSeconds > 60) { // Only calculate for significant offline time
        console.log(`Player was offline for ${offlineSeconds.toFixed(0)} seconds. Calculating progress...`);
        // Simple catch-up tick
        gameTick(gameState);
    }

    lastTickTime = Date.now(); // Reset tick time after catch-up

    gameLoop = setInterval(() => gameTick(gameState), TICK_INTERVAL);
    saveLoop = setInterval(() => {
        gameState.lastSaveTime = Date.now();
        saveCallback();
    }, 5 * 60 * 1000); // Save every 5 minutes
    
    console.log("Game engine started.");
}

export function handleAction(gameState: GameState, type: string, payload: any): { message?: string, error?: string } {
    // This will contain the large switch statement with all game actions.
    switch (type) {
        case 'ADD_TO_QUEUE': {
            const { id, type: itemType, amount } = payload;
            const data = ALL_GAME_OBJECTS[id as GameObject];
            const levelOrAmount = (itemType === 'ship' || itemType === 'defense') ? amount : (itemType === 'building' ? gameState.buildings[id as BuildingType] + 1 : (itemType === 'research' ? gameState.research[id as ResearchType] + 1 : gameState.shipLevels[id as ShipType] + 1));
            const cost = data.cost(levelOrAmount);
            
            if (gameState.resources.metal < cost.metal || gameState.resources.crystal < cost.crystal || gameState.resources.deuterium < cost.deuterium) {
                return { error: 'Niewystarczające surowce!' };
            }

            let buildTime = data.buildTime(levelOrAmount);
            // Apply time reductions
            
            const queue = (itemType === 'ship' || itemType === 'defense') ? gameState.shipyardQueue : gameState.buildingQueue;
            const lastItemEndTime = queue.length > 0 ? queue[queue.length - 1].endTime : Date.now();

            gameState.resources.metal -= cost.metal;
            gameState.resources.crystal -= cost.crystal;
            gameState.resources.deuterium -= cost.deuterium;
            
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
            // Simplified for brevity
            const { missionFleet, targetCoords, missionType, durationSeconds, fuelCost } = payload;
            if (gameState.resources.deuterium < fuelCost) return { error: "Brak paliwa!" };
            
            gameState.resources.deuterium -= fuelCost;
            for(const ship in missionFleet) {
                gameState.fleet[ship as ShipType] = (gameState.fleet[ship as ShipType] || 0) - missionFleet[ship];
            }
            
            const now = Date.now();
            gameState.fleetMissions.push({
                id: `m-${now}`,
                sourceLocationId: payload.activeLocationId,
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
            Object.assign(gameState, getInitialState());
            return { message: "Gra została zresetowana." };
        }
        // ... Add all other actions here
        default:
            return { error: `Unknown action type: ${type}` };
    }
}