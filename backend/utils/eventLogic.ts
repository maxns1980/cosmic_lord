import { GameState, SolarFlareStatus, PirateMercenaryStatus, ContrabandStatus, AncientArtifactStatus, AsteroidImpactType, BuildingType, Resources, ShipType, SpacePlagueState, ContrabandOfferType, ResearchType, GhostShipStatus, GalacticGoldRushState, StellarAuroraState, InfoMessage, SolarFlareMessage, AsteroidImpactMessage, ResourceVeinMessage, SpacePlagueMessage, GhostShipDiscoveryMessage, GalacticGoldRushMessage, StellarAuroraMessage, Colony } from '../types.js';
import { ALL_SHIP_DATA, BUILDING_DATA, RESEARCH_DATA } from '../constants.js';

const addMessage = (gameState: GameState, message: any) => {
    gameState.messages.unshift({
        id: `msg-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        isRead: false,
        ...message
    });
};

// --- Event Trigger Functions ---

export const triggerSolarFlare = (gameState: GameState, isTest: boolean) => {
    const stateTarget = isTest ? 'scopedSolarFlareState' : 'solarFlare';
    if (isTest && !gameState.scopedSolarFlareState) {
        gameState.scopedSolarFlareState = { status: SolarFlareStatus.INACTIVE, endTime: 0 };
    }
    const currentState = gameState[stateTarget]!;
    if (currentState.status !== SolarFlareStatus.INACTIVE) return;

    const isDisruption = Math.random() < 0.3; // 30% chance for a negative event

    if (isDisruption) {
        currentState.status = SolarFlareStatus.DISRUPTION;
        currentState.endTime = Date.now() + 1 * 60 * 60 * 1000; // 1 hour
        addMessage(gameState, { type: 'solar_flare', subject: `Rozbłysk: Zakłócenia Systemów!${isTest ? ' (Test)' : ''}`, status: SolarFlareStatus.DISRUPTION } as SolarFlareMessage);
    } else {
        currentState.status = SolarFlareStatus.POWER_BOOST;
        currentState.endTime = Date.now() + 12 * 60 * 60 * 1000; // 12 hours
        addMessage(gameState, { type: 'solar_flare', subject: `Rozbłysk: Bonus Energii!${isTest ? ' (Test)' : ''}`, status: SolarFlareStatus.POWER_BOOST } as SolarFlareMessage);
    }
};

export const triggerPirateMercenary = (gameState: GameState, isTest: boolean) => {
    const stateTarget = isTest ? 'scopedPirateMercenaryState' : 'pirateMercenaryState';
     if (isTest && !gameState.scopedPirateMercenaryState) {
        gameState.scopedPirateMercenaryState = { status: PirateMercenaryStatus.INACTIVE, arrivalTime: 0, departureTime: 0, fleet: {}, hireCost: 0 };
    }
    const currentState = gameState[stateTarget]!;
    if (currentState.status !== PirateMercenaryStatus.INACTIVE) return;
    
    currentState.status = PirateMercenaryStatus.INCOMING;
    currentState.arrivalTime = Date.now() + 5 * 60 * 1000; // Arrives in 5 minutes
};

export const triggerContraband = (gameState: GameState, isTest: boolean) => {
    const stateTarget = isTest ? 'scopedContrabandState' : 'contrabandState';
    if (isTest && !gameState.scopedContrabandState) {
        gameState.scopedContrabandState = { status: ContrabandStatus.INACTIVE, arrivalTime: 0, departureTime: 0, offer: null };
    }
    const currentState = gameState[stateTarget]!;
    if (currentState.status !== ContrabandStatus.INACTIVE) return;

    currentState.status = ContrabandStatus.INCOMING;
    currentState.arrivalTime = Date.now() + 7 * 60 * 1000; // Arrives in 7 minutes
};

export const triggerAncientArtifact = (gameState: GameState, isTest: boolean) => {
    const stateTarget = isTest ? 'scopedAncientArtifactState' : 'ancientArtifactState';
    if (isTest && !gameState.scopedAncientArtifactState) {
        gameState.scopedAncientArtifactState = { status: AncientArtifactStatus.INACTIVE };
    }
    const currentState = gameState[stateTarget]!;
    if (currentState.status !== AncientArtifactStatus.INACTIVE) return;
    
    currentState.status = AncientArtifactStatus.AWAITING_CHOICE;
    addMessage(gameState, { type: 'info', subject: `Odkryto Starożytny Artefakt!${isTest ? ' (Test)' : ''}`, text: 'Na jednej z twoich planet odkryto tajemniczy obiekt. Sprawdź wiadomości, aby podjąć decyzję.' } as InfoMessage);
};

export const triggerAsteroidImpact = (gameState: GameState) => {
    const isBonus = Math.random() < 0.5; // 50% chance for a bonus event
    
    if (isBonus) {
        const resourceType = Math.random() < 0.6 ? 'metal' : 'crystal';
        const amount = Math.floor(Math.random() * 5000) + 2500;
        gameState.resources[resourceType as 'metal' | 'crystal'] += amount;
        addMessage(gameState, {
            type: 'asteroid_impact',
            subject: 'Deszcz Meteorytów!',
            impactType: AsteroidImpactType.BONUS,
            details: { resourceType, amount }
        } as AsteroidImpactMessage);
    } else {
        const colonyIds = Object.keys(gameState.colonies);
        if (colonyIds.length === 0) return;
        const targetColonyId = colonyIds[Math.floor(Math.random() * colonyIds.length)];
        const targetColony = gameState.colonies[targetColonyId];

        const builtBuildings = (Object.keys(targetColony.buildings) as BuildingType[])
            .filter(id => targetColony.buildings[id] > 0);
        
        if (builtBuildings.length > 0) {
            const buildingToDamage = builtBuildings[Math.floor(Math.random() * builtBuildings.length)];
            const currentLevel = targetColony.buildings[buildingToDamage];
            if (currentLevel > 1) {
                const newLevel = Math.max(1, currentLevel - 1);
                targetColony.buildings[buildingToDamage] = newLevel;
                addMessage(gameState, {
                    type: 'asteroid_impact',
                    subject: 'Uderzenie Asteroidy!',
                    impactType: AsteroidImpactType.DAMAGE,
                    details: { buildingId: buildingToDamage, newLevel }
                } as AsteroidImpactMessage);
            }
        }
    }
};

export const triggerResourceVein = (gameState: GameState, isTest: boolean) => {
    const stateTarget = isTest ? 'scopedResourceVeinBonus' : 'resourceVeinBonus';
    if (isTest && !gameState.scopedResourceVeinBonus) {
        gameState.scopedResourceVeinBonus = { active: false, resourceType: null, endTime: 0, bonusMultiplier: 1.25 };
    }
    const currentState = gameState[stateTarget]!;
    if (currentState.active) return;

    const resourceType = ['metal', 'crystal', 'deuterium'][Math.floor(Math.random() * 3)] as keyof Omit<Resources, 'energy'>;
    currentState.active = true;
    currentState.resourceType = resourceType;
    currentState.endTime = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    addMessage(gameState, {
        type: 'resource_vein',
        subject: `Odkryto Bogatą Żyłę!${isTest ? ' (Test)' : ''}`,
        resourceType,
        status: 'activated',
        bonusEndTime: currentState.endTime
    } as ResourceVeinMessage);
};

export const triggerSpacePlague = (gameState: GameState, isTest: boolean) => {
    const stateTarget = isTest ? 'scopedSpacePlagueState' : 'spacePlague';
    if (isTest && !gameState.scopedSpacePlagueState) {
        gameState.scopedSpacePlagueState = { active: false, infectedShip: null, endTime: 0 };
    }
    const currentState = gameState[stateTarget]!;
    if (currentState.active) return;

    const playerFleet = Object.values(gameState.colonies)
        .flatMap((colony: Colony): [string, number | undefined][] => Object.entries(colony.fleet))
        .filter((entry): entry is [ShipType, number] => {
            const [, count] = entry;
            return (count || 0) > 0;
        });
        
    if (playerFleet.length > 0) {
        const [infectedShip] = playerFleet[Math.floor(Math.random() * playerFleet.length)];
        currentState.active = true;
        currentState.infectedShip = infectedShip as ShipType;
        currentState.endTime = Date.now() + 6 * 60 * 60 * 1000; // 6 hours
        addMessage(gameState, {
            type: 'space_plague',
            subject: `Wykryto Kosmiczną Zarazę!${isTest ? ' (Test)' : ''}`,
            infectedShip: infectedShip as ShipType,
            status: 'activated'
        } as SpacePlagueMessage);
    }
};

export const triggerGhostShip = (gameState: GameState, isTest: boolean) => {
    const stateTarget = isTest ? 'scopedGhostShipState' : 'ghostShipState';
     if (isTest && !gameState.scopedGhostShipState) {
        gameState.scopedGhostShipState = { status: GhostShipStatus.INACTIVE, locationCoords: '', shipType: ShipType.DESTROYER };
    }
    const currentState = gameState[stateTarget]!;
    if (currentState.status !== GhostShipStatus.INACTIVE) return;
    
    // Find an empty location
    const galaxy = Math.floor(Math.random() * 3) + 1;
    const system = Math.floor(Math.random() * 499) + 1;
    const position = Math.floor(Math.random() * 15) + 1;
    const coords = `${galaxy}:${system}:${position}`;
    
    const powerfulShips = [ShipType.BATTLESHIP, ShipType.CRUISER, ShipType.DESTROYER, ShipType.BATTLECRUISER];
    const shipType = powerfulShips[Math.floor(Math.random() * powerfulShips.length)];

    currentState.status = GhostShipStatus.AWAITING_CHOICE;
    currentState.locationCoords = coords;
    currentState.shipType = shipType;

    addMessage(gameState, {
        type: 'ghost_ship_discovery',
        subject: `Wykryto Statek Widmo!${isTest ? ' (Test)' : ''}`,
        shipType: shipType,
        locationCoords: coords
    } as GhostShipDiscoveryMessage);
};

export const triggerGalacticGoldRush = (gameState: GameState, isTest: boolean) => {
    const stateTarget = isTest ? 'scopedGalacticGoldRushState' : 'galacticGoldRushState';
    if (isTest && !gameState.scopedGalacticGoldRushState) {
        gameState.scopedGalacticGoldRushState = { active: false, endTime: 0 };
    }
    const currentState = gameState[stateTarget]!;
    if (currentState.active) return;
    
    currentState.active = true;
    currentState.endTime = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    addMessage(gameState, {
        type: 'galactic_gold_rush',
        subject: `Ogłoszono Galaktyczną Gorączkę Złota!${isTest ? ' (Test)' : ''}`,
        status: 'activated'
    } as GalacticGoldRushMessage);
};

export const triggerStellarAurora = (gameState: GameState, isTest: boolean) => {
    const stateTarget = isTest ? 'scopedStellarAuroraState' : 'stellarAuroraState';
    if (isTest && !gameState.scopedStellarAuroraState) {
        gameState.scopedStellarAuroraState = { active: false, endTime: 0 };
    }
    const currentState = gameState[stateTarget]!;
    if (currentState.active) return;
    
    const durationHours = [4, 6, 8][Math.floor(Math.random() * 3)];
    currentState.active = true;
    currentState.endTime = Date.now() + durationHours * 60 * 60 * 1000;
    addMessage(gameState, {
        type: 'stellar_aurora',
        subject: `Pojawiła się Zorza Gwiezdna!${isTest ? ' (Test)' : ''}`,
        status: 'activated',
        durationHours: durationHours
    } as StellarAuroraMessage);
};