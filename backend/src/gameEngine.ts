import {
    GameState, QueueItem, BuildingType, ResearchType, ShipType, DefenseType, FleetMission, MissionType, Message, GameObject, QueueItemType, AncientArtifactStatus, AncientArtifactChoice, AncientArtifactMessage,
    Alliance, WorldState, PlayerState, Resources, Boost, BoostType, InfoMessage, DebrisField, BattleReport, BattleMessage, Colony, PlanetSpecialization, Moon, MoonCreationMessage, FleetTemplate, EspionageEventMessage, PhalanxReportMessage, DetectedFleetMission, PirateMercenaryState, PirateMercenaryStatus, NPCFleetMission, GhostShipChoice, GhostShipStatus, GhostShipOutcomeMessage, SolarFlareStatus, SolarFlareMessage, ContrabandStatus, ContrabandState, ResourceVeinMessage, SpacePlagueMessage, GhostShipDiscoveryMessage, GalacticGoldRushMessage, StellarAuroraMessage, GalacticGoldRushState, StellarAuroraState, SolarFlareState, ResourceVeinBonus, SpacePlagueState, PirateMessage, ContrabandMessage, ContrabandOfferType
} from './types.js';
import { 
    ALL_GAME_OBJECTS, getInitialPlayerState, BUILDING_DATA, RESEARCH_DATA, ALL_SHIP_DATA, DEFENSE_DATA, SHIP_UPGRADE_DATA, HOMEWORLD_MAX_FIELDS_BASE, TERRAFORMER_FIELDS_BONUS, PHALANX_SCAN_COST,
    RANDOM_EVENT_CHECK_INTERVAL, SOLAR_FLARE_CHANCE, PIRATE_MERCENARY_CHANCE, CONTRABAND_CHANCE, ANCIENT_ARTIFACT_CHANCE, ASTEROID_IMPACT_CHANCE, RESOURCE_VEIN_CHANCE, SPACE_PLAGUE_CHANCE, GHOST_SHIP_CHANCE, GALACTIC_GOLD_RUSH_CHANCE, STELLAR_AURORA_CHANCE
} from './constants.js';
import { calculateProductions } from './utils/gameLogic.js';
import { triggerAncientArtifact, triggerAsteroidImpact, triggerContraband, triggerGalacticGoldRush, triggerGhostShip, triggerPirateMercenary, triggerResourceVein, triggerSolarFlare, triggerSpacePlague, triggerStellarAurora } from './utils/eventLogic.js';
import { TestableEventType } from './types.js';
import { calculateCombat } from './utils/combatLogic.js';
import { evolveNpc, regenerateNpcFromSleeper, calculatePointsForNpc } from './utils/npcLogic.js';
import { calculateMaxResources } from './utils/gameLogic.js';

const addMessage = <T extends Message>(playerState: PlayerState, message: Omit<T, 'id' | 'timestamp' | 'isRead'>) => {
    playerState.messages.unshift({
        id: `msg-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        isRead: false,
        ...message
    } as T);
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

    // --- PLAYER-SCOPED EVENT STATE PROGRESSION AND EXPIRATION ---
    const processPirates = (p?: PirateMercenaryState): PirateMercenaryState | undefined => {
        if (!p) return undefined;
        if (p.status === PirateMercenaryStatus.INCOMING && now >= p.arrivalTime) {
            p.status = PirateMercenaryStatus.AVAILABLE;
            p.departureTime = now + 10 * 60 * 1000;
            p.fleet = { [ShipType.LIGHT_FIGHTER]: 50, [ShipType.CRUISER]: 5 };
            p.hireCost = 25000;
            addMessage<PirateMessage>(gameState, { type: 'pirate', subject: `Piraci-Najemnicy przybyli!`, pirateState: p });
        }
        if (p.status === PirateMercenaryStatus.AVAILABLE && now >= p.departureTime) {
            addMessage<PirateMessage>(gameState, { type: 'pirate', subject: `Najemnicy odlecieli`, pirateState: p });
            return undefined; // Clears the state
        }
        return p;
    }
    gameState.scopedPirateMercenaryState = processPirates(gameState.scopedPirateMercenaryState);

    const processContraband = (c?: ContrabandState): ContrabandState | undefined => {
        if (!c) return undefined;
        if (c.status === ContrabandStatus.INCOMING && now >= c.arrivalTime) {
            c.status = ContrabandStatus.ACTIVE;
            c.departureTime = now + 5 * 60 * 1000;
            c.offer = { type: ContrabandOfferType.PROTOTYPE_SHIP, shipType: ShipType.SHADOW_CORSAIR, cost: { credits: 50000, deuterium: 10000 }};
            addMessage<ContrabandMessage>(gameState, { type: 'contraband', subject: `Oferta Kontrabandy!`, accepted: false, offer: c.offer, outcomeText: '', isArrivalAnnouncement: true });
        }
        if (c.status === ContrabandStatus.ACTIVE && now >= c.departureTime) {
            return undefined; // Clears the state
        }
        return c;
    };
    gameState.scopedContrabandState = processContraband(gameState.scopedContrabandState);

    if (gameState.scopedSolarFlareState && gameState.scopedSolarFlareState.status !== SolarFlareStatus.INACTIVE && now >= gameState.scopedSolarFlareState.endTime) {
        addMessage<SolarFlareMessage>(gameState, { type: 'solar_flare', subject: `Zjawisko słoneczne zakończone`, status: gameState.scopedSolarFlareState.status, isEndMessage: true });
        gameState.scopedSolarFlareState = undefined;
    }

    if (gameState.scopedResourceVeinBonus && gameState.scopedResourceVeinBonus.active && now >= gameState.scopedResourceVeinBonus.endTime) {
        addMessage<ResourceVeinMessage>(gameState, { type: 'resource_vein', subject: `Premia do wydobycia wygasła`, resourceType: gameState.scopedResourceVeinBonus.resourceType!, status: 'expired', bonusEndTime: gameState.scopedResourceVeinBonus.endTime });
        gameState.scopedResourceVeinBonus = undefined;
    }

    if (gameState.scopedSpacePlagueState && gameState.scopedSpacePlagueState.active && now >= gameState.scopedSpacePlagueState.endTime) {
        addMessage<SpacePlagueMessage>(gameState, { type: 'space_plague', subject: `Zaraza zwalczona`, infectedShip: gameState.scopedSpacePlagueState.infectedShip!, status: 'expired' });
        gameState.scopedSpacePlagueState = undefined;
    }

    if (gameState.scopedGalacticGoldRushState && gameState.scopedGalacticGoldRushState.active && now >= gameState.scopedGalacticGoldRushState.endTime) {
        addMessage<GalacticGoldRushMessage>(gameState, { type: 'galactic_gold_rush', subject: `Galaktyczna Gorączka Złota zakończona`, status: 'expired' });
        gameState.scopedGalacticGoldRushState = undefined;
    }
    
    if (gameState.scopedStellarAuroraState && gameState.scopedStellarAuroraState.active && now >= gameState.scopedStellarAuroraState.endTime) {
        addMessage<StellarAuroraMessage>(gameState, { type: 'stellar_aurora', subject: `Zorza Gwiezdna wygasła`, status: 'expired', durationHours: 0 });
        gameState.scopedStellarAuroraState = undefined;
    }

    for (const boostType in gameState.activeBoosts) {
        const boost = (gameState.activeBoosts as any)[boostType];
        if (boost && boost.endTime && now >= boost.endTime) {
            delete (gameState.activeBoosts as any)[boostType];
             addMessage<InfoMessage>(gameState, { type: 'info', subject: `Bonus wygasł`, text: `Twój aktywny bonus dobiegł końca.` });
        }
    }

    // --- TRIGGER NEW PLAYER-SCOPED EVENTS ---
    if (now - (gameState.lastPlayerEventCheckTime || 0) >= RANDOM_EVENT_CHECK_INTERVAL) {
        gameState.lastPlayerEventCheckTime = now;

        if (Math.random() < SOLAR_FLARE_CHANCE) triggerSolarFlare(gameState);
        if (Math.random() < PIRATE_MERCENARY_CHANCE) triggerPirateMercenary(gameState);
        if (Math.random() < CONTRABAND_CHANCE) triggerContraband(gameState);
        if (Math.random() < ANCIENT_ARTIFACT_CHANCE) triggerAncientArtifact(gameState);
        if (Math.random() < ASTEROID_IMPACT_CHANCE) triggerAsteroidImpact(gameState);
        if (Math.random() < RESOURCE_VEIN_CHANCE) triggerResourceVein(gameState);
        if (Math.random() < SPACE_PLAGUE_CHANCE) triggerSpacePlague(gameState);
        if (Math.random() < GHOST_SHIP_CHANCE) triggerGhostShip(gameState);
        if (Math.random() < GALACTIC_GOLD_RUSH_CHANCE) triggerGalacticGoldRush(gameState);
        if (Math.random() < STELLAR_AURORA_CHANCE) triggerStellarAurora(gameState);
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
        
        addMessage<InfoMessage>(playerState, {
            type: 'info',
            subject: 'Otrzymano Dzienną Skrzynię!',
            text: 'Twoja codzienna nagroda za lojalność została dodana do Twojego inwentarza. Aktywuj ją, kiedy zechcesz!'
        });
    }

    const lastSave = playerState.lastSaveTime || now;
    const deltaSeconds = (now - lastSave) / 1000;

    if (deltaSeconds <= 1) {
        playerState.lastSaveTime = now;
        return playerState;
    }
    
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
    const lastCheck = worldState.lastGlobalNpcCheck || (now - 60 * 1000);
    const deltaSeconds = (now - lastCheck) / 1000;

    if (deltaSeconds < 60) {
        return { updatedWorldState: worldState, newPlayerMessages: {} };
    }
    
    const updatedNpcStates = { ...worldState.npcStates };
    const newNpcMissions = [...worldState.npcFleetMissions];
    const updatedPublicPlayerData = { ...worldState.publicPlayerData };

    for (const coords in updatedNpcStates) {
        const npc = updatedNpcStates[coords];
        const isThreatened = false;
        
        const { updatedNpc, mission } = evolveNpc(npc, deltaSeconds, coords, isThreatened);
        updatedNpcStates[coords] = updatedNpc;

        const npcPoints = calculatePointsForNpc(updatedNpc);
        updatedPublicPlayerData[updatedNpc.name] = {
            points: npcPoints,
            lastActivity: updatedNpc.lastUpdateTime
        };
        
        if (mission) {
            newNpcMissions.push(mission);
        }
    }
    
    const activeNpcMissions = newNpcMissions.filter(mission => now < mission.arrivalTime);

    const updatedWorldState: WorldState = {
        ...worldState,
        npcStates: updatedNpcStates,
        npcFleetMissions: activeNpcMissions,
        publicPlayerData: updatedPublicPlayerData,
        lastGlobalNpcCheck: now,
    };

    return { updatedWorldState, newPlayerMessages: {} };
}


export const handleAction = (gameState: GameState, type: string, payload: any, userId?: string): { message?: string, error?: string } => {
    switch (type) {
        case 'DELETE_ACCOUNT': {
            if (!userId) return { error: 'Brak autoryzacji.' };
            
            for (const colonyId in gameState.colonies) {
                delete gameState.occupiedCoordinates[colonyId];
            }
            for (const moonId in gameState.moons) {
                delete gameState.occupiedCoordinates[moonId];
            }
            
            delete gameState.publicPlayerData[userId];
            
            return { message: 'Konto zostało pomyślnie usunięte.' };
        }
        case 'TRIGGER_EVENT': {
            const { eventType } = payload;
            let message = 'Lokalne wydarzenie testowe uruchomione!';

            switch (eventType as TestableEventType) {
                case TestableEventType.SOLAR_FLARE: {
                    triggerSolarFlare(gameState);
                    break;
                }
                case TestableEventType.PIRATE_MERCENARY: {
                    triggerPirateMercenary(gameState);
                    break;
                }
                case TestableEventType.CONTRABAND: {
                    triggerContraband(gameState);
                    break;
                }
                case TestableEventType.ANCIENT_ARTIFACT: {
                    triggerAncientArtifact(gameState);
                    break;
                }
                case TestableEventType.ASTEROID_IMPACT: {
                    triggerAsteroidImpact(gameState);
                    message = "Lokalne wydarzenie testowe 'Uderzenie Asteroidy' uruchomione!";
                    break;
                }
                case TestableEventType.RESOURCE_VEIN: {
                    triggerResourceVein(gameState);
                    break;
                }
                case TestableEventType.SPACE_PLAGUE: {
                    triggerSpacePlague(gameState);
                    break;
                }
                case TestableEventType.GHOST_SHIP: {
                    triggerGhostShip(gameState);
                    break;
                }
                case TestableEventType.GALACTIC_GOLD_RUSH: {
                    triggerGalacticGoldRush(gameState);
                    break;
                }
                case TestableEventType.STELLAR_AURORA: {
                    triggerStellarAurora(gameState);
                    break;
                }
                default:
                    return { error: 'Nieznany typ wydarzenia testowego.' };
            }
            
            return { message };
        }
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
        
        case 'ANCIENT_ARTIFACT_CHOICE': {
            const { choice } = payload;
            if (!gameState.scopedAncientArtifactState || gameState.scopedAncientArtifactState.status !== AncientArtifactStatus.AWAITING_CHOICE) {
                return { error: 'Nie ma aktywnego artefaktu do podjęcia decyzji.' };
            }
        
            gameState.scopedAncientArtifactState = undefined;

            switch (choice) {
                case AncientArtifactChoice.STUDY: {
                    const STUDY_COST = { credits: 5000, crystal: 2000 };
                    if (gameState.credits < STUDY_COST.credits || gameState.resources.crystal < STUDY_COST.crystal) {
                        gameState.scopedAncientArtifactState = { status: AncientArtifactStatus.AWAITING_CHOICE };
                        return { error: 'Niewystarczające środki na zbadanie artefaktu.' };
                    }
                    gameState.credits -= STUDY_COST.credits;
                    gameState.resources.crystal -= STUDY_COST.crystal;
                    
                    const success = Math.random() < 0.5;
                    const outcome: AncientArtifactMessage['outcome'] = { success };
                    let subject: string;
                    let message: string;

                    if (success) {
                        const potentialTechs = (Object.keys(gameState.research) as ResearchType[])
                            .filter(tech => (gameState.research[tech] > 0 && gameState.research[tech] < 20));
                        
                        if (potentialTechs.length > 0) {
                            const techToUpgrade = potentialTechs[Math.floor(Math.random() * potentialTechs.length)];
                            const newLevel = gameState.research[techToUpgrade] + 1;
                            gameState.research[techToUpgrade] = newLevel;
                            outcome.technology = techToUpgrade;
                            outcome.newLevel = newLevel;
                            subject = 'Przełom technologiczny!';
                            message = 'Badanie artefaktu zakończyło się sukcesem!';
                        } else {
                            gameState.credits += STUDY_COST.credits / 2;
                            gameState.resources.crystal += STUDY_COST.crystal / 2;
                            subject = 'Dziwny artefakt';
                            message = 'Badanie artefaktu nie przyniosło przełomu, ale odzyskano część kosztów.';
                        }
                    } else {
                        subject = 'Porażka badawcza';
                        message = 'Badanie artefaktu nie powiodło się, zasoby zostały stracone.';
                    }
                    addMessage<AncientArtifactMessage>(gameState, { type: 'ancient_artifact', subject, choice, outcome });
                    return { message };
                }
                case AncientArtifactChoice.SELL: {
                    const SELL_GAIN = 10000;
                    gameState.credits += SELL_GAIN;
                    const outcome: AncientArtifactMessage['outcome'] = { creditsGained: SELL_GAIN };
                    const subject = 'Sprzedano artefakt';
                    const message = `Sprzedano artefakt za ${SELL_GAIN} kredytów.`;
                    addMessage<AncientArtifactMessage>(gameState, { type: 'ancient_artifact', subject, choice, outcome });
                    return { message };
                }
                case AncientArtifactChoice.IGNORE: {
                    const subject = 'Zignorowano artefakt';
                    const message = 'Zdecydowano zostawić artefakt w spokoju.';
                    addMessage<AncientArtifactMessage>(gameState, { type: 'ancient_artifact', subject, choice, outcome: {} });
                    return { message };
                }
                default:
                    gameState.scopedAncientArtifactState = { status: AncientArtifactStatus.AWAITING_CHOICE };
                    return { error: 'Nieznany wybór dotyczący artefaktu.' };
            }
        }
        case 'GHOST_SHIP_CHOICE': {
            const { choice } = payload;
             if (!gameState.scopedGhostShipState || gameState.scopedGhostShipState.status !== GhostShipStatus.AWAITING_CHOICE) {
                return { error: 'Nie ma aktywnego Statku Widmo.' };
            }

            gameState.scopedGhostShipState = undefined;
            const outcome: GhostShipOutcomeMessage['outcome'] = { text: '' };
            let subject: string = 'Statek Widmo';

            if (choice === GhostShipChoice.IGNORE) {
                outcome.text = 'Postanowiono zignorować sygnał. Tajemnica wraku pozostanie nieodkryta.';
                subject = 'Zignorowano Statek Widmo';
            } else if (choice === GhostShipChoice.INVESTIGATE) {
                const rand = Math.random();
                if (rand < 0.4) { // 40% chance for resources
                    const resourcesGained = {
                        metal: Math.floor(Math.random() * 10000) + 5000,
                        crystal: Math.floor(Math.random() * 5000) + 2500,
                    };
                    gameState.resources.metal += resourcesGained.metal;
                    gameState.resources.crystal += resourcesGained.crystal;
                    outcome.resourcesGained = resourcesGained;
                    outcome.text = 'Ekipa badawcza z sukcesem odzyskała cenne surowce z wraku!';
                    subject = 'Odzyskano surowce z wraku';
                } else if (rand < 0.7) { // 30% chance for an ambush
                    outcome.text = 'To była pułapka! Wrak był przynętą dla starożytnych dronów obronnych. Twoja ekipa musi walczyć o przetrwanie!';
                    subject = 'Zasadzka przy Wraku!';
                    // Here you would trigger a simple battle against a predefined drone fleet
                } else { // 30% chance for nothing
                    outcome.text = 'Wysłana ekipa nie znalazła niczego wartościowego. Wrak był pusty.';
                    subject = 'Pusty Wrak';
                }
            }
             addMessage<GhostShipOutcomeMessage>(gameState, { type: 'ghost_ship_outcome', subject, choice, outcome });
             return { message: outcome.text };
        }
        case 'CONTRABAND_DEAL': {
            const { accepted } = payload;
            if (!gameState.scopedContrabandState || gameState.scopedContrabandState.status !== ContrabandStatus.ACTIVE) {
                return { error: 'Nie ma aktywnej oferty kontrabandy.' };
            }
        
            const { offer } = gameState.scopedContrabandState;
        
            if (!offer) {
                gameState.scopedContrabandState = undefined;
                return { error: 'Błąd oferty kontrabandy.' };
            }
        
            gameState.scopedContrabandState = undefined;
        
            if (accepted) {
                if (gameState.credits < offer.cost.credits || gameState.resources.deuterium < offer.cost.deuterium) {
                    return { error: 'Nie masz wystarczających środków. Oferta przepadła.' };
                }
        
                gameState.credits -= offer.cost.credits;
                gameState.resources.deuterium -= offer.cost.deuterium;
        
                let outcomeText = '';
                let subject = 'Transakcja z Przemytnikami';
                
                switch (offer.type) {
                    case ContrabandOfferType.PROTOTYPE_SHIP:
                        if (offer.shipType) {
                            const homeworld = Object.values(gameState.colonies).sort((a, b) => a.creationTime - b.creationTime)[0];
                            if (homeworld) {
                                homeworld.fleet[offer.shipType] = (homeworld.fleet[offer.shipType] || 0) + 1;
                                const shipName = ALL_SHIP_DATA[offer.shipType].name;
                                outcomeText = `Transakcja zakończona pomyślnie. Nowy ${shipName} został dostarczony do hangaru na Twojej planecie matce.`;
                            } else {
                                outcomeText = 'Transakcja nieudana - nie znaleziono planety matki.';
                            }
                        }
                        break;
                }
                
                addMessage<ContrabandMessage>(gameState, { type: 'contraband', subject, accepted: true, offer, outcomeText });
                return { message: 'Oferta przyjęta!' };
        
            } else { // Rejected
                const outcomeText = 'Odrzuciłeś ofertę przemytników. Kontakt został zerwany... na razie.';
                addMessage<ContrabandMessage>(gameState, { type: 'contraband', subject: 'Odrzucono Ofertę', accepted: false, offer, outcomeText });
                return { message: 'Oferta odrzucona.' };
            }
        }

        case 'READ_MESSAGE': {
            const { messageId } = payload;
            if (!messageId) {
                return { error: 'Brak ID wiadomości.' };
            }
            const message = gameState.messages.find((m: Message) => m.id === messageId);
            if (message) {
                message.isRead = true;
            }
            return {};
        }

        case 'DELETE_MESSAGE': {
            const { messageId } = payload;
            if (!messageId) {
                return { error: 'Brak ID wiadomości.' };
            }
            gameState.messages = gameState.messages.filter((m: Message) => m.id !== messageId);
            return { message: 'Wiadomość usunięta.' };
        }

        case 'DELETE_ALL_MESSAGES': {
            gameState.messages = [];
            return { message: 'Wszystkie wiadomości zostały usunięte.' };
        }

        default:
            return { error: 'Unknown action type.' };
    }
};
