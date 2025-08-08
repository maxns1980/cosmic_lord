import { GameState, SolarFlareStatus, PirateMercenaryStatus, ContrabandStatus, AncientArtifactStatus, AsteroidImpactType, BuildingType, Resources, ShipType, SpacePlagueState, ContrabandOfferType, ResearchType, GhostShipStatus, GalacticGoldRushState, StellarAuroraState, InfoMessage, SolarFlareMessage, AsteroidImpactMessage, ResourceVeinMessage, SpacePlagueMessage, GhostShipDiscoveryMessage, GalacticGoldRushMessage, StellarAuroraMessage, Colony, Message, PirateMessage, ContrabandMessage, PirateMercenaryState, AncientArtifactMessage, ContrabandOffer } from '../types.js';
import { ALL_SHIP_DATA, BUILDING_DATA, RESEARCH_DATA } from '../constants.js';

const addMessage = <T extends Message>(gameState: GameState, message: Omit<T, 'id' | 'timestamp' | 'isRead'>, customTimestamp?: number) => {
    const eventTime = customTimestamp || Date.now();
    gameState.messages.unshift({
        id: `msg-${eventTime}-${Math.random()}`,
        timestamp: eventTime,
        isRead: false,
        ...message
    } as T);
};

// --- Event Trigger Functions ---

export const triggerSolarFlare = (gameState: GameState, timestamp?: number) => {
    if (gameState.scopedSolarFlareState && gameState.scopedSolarFlareState.status !== SolarFlareStatus.INACTIVE) return;

    const isDisruption = Math.random() < 0.3; // 30% chance for a negative event
    const eventTime = timestamp || Date.now();
    const status = isDisruption ? SolarFlareStatus.DISRUPTION : SolarFlareStatus.POWER_BOOST;
    const endTime = eventTime + (isDisruption ? 1 : 12) * 60 * 60 * 1000;
    
    gameState.scopedSolarFlareState = { status, endTime };

    addMessage<SolarFlareMessage>(gameState, { 
        type: 'solar_flare', 
        subject: isDisruption ? 'Rozbłysk: Zakłócenia Systemów!' : 'Rozbłysk: Bonus Energii!', 
        status,
        isEndMessage: false,
    }, eventTime);
};

export const triggerPirateMercenary = (gameState: GameState, timestamp?: number) => {
    if (gameState.scopedPirateMercenaryState && gameState.scopedPirateMercenaryState.status !== PirateMercenaryStatus.INACTIVE) return;
    
    const arrivalMinutes = Math.floor(Math.random() * (60 - 10 + 1)) + 10; // Random between 10 and 60 minutes
    const eventTime = timestamp || Date.now();

    gameState.scopedPirateMercenaryState = {
        status: PirateMercenaryStatus.INCOMING,
        arrivalTime: eventTime + arrivalMinutes * 60 * 1000,
        departureTime: 0,
        fleet: {},
        hireCost: 0,
    };
    addMessage<InfoMessage>(gameState, { type: 'info', subject: 'Wykryto sygnaturę Piratów!', text: 'Zbliżają się do Twojego systemu.' }, eventTime);
};

export const triggerContraband = (gameState: GameState, timestamp?: number) => {
    if (gameState.scopedContrabandState && gameState.scopedContrabandState.status !== ContrabandStatus.INACTIVE) return;

    const arrivalMinutes = Math.floor(Math.random() * (60 - 7 + 1)) + 7; // Random between 7 and 60 minutes
    const eventTime = timestamp || Date.now();
    gameState.scopedContrabandState = {
        status: ContrabandStatus.INCOMING,
        arrivalTime: eventTime + arrivalMinutes * 60 * 1000,
        departureTime: 0,
        offer: null,
    };
    addMessage<InfoMessage>(gameState, { type: 'info', subject: 'Zaszyfrowana transmisja!', text: 'Przemytnicy kontrabandy wkrótce złożą ofertę.' }, eventTime);
};

export const triggerAncientArtifact = (gameState: GameState, timestamp?: number) => {
    if (gameState.scopedAncientArtifactState && gameState.scopedAncientArtifactState.status !== AncientArtifactStatus.INACTIVE) return;
    
    gameState.scopedAncientArtifactState = { status: AncientArtifactStatus.AWAITING_CHOICE };
    addMessage<InfoMessage>(gameState, { type: 'info', subject: 'Odkryto Starożytny Artefakt!', text: 'Na jednej z twoich planet odkryto tajemniczy obiekt. Sprawdź wiadomości, aby podjąć decyzję.' }, timestamp);
};

export const triggerAsteroidImpact = (gameState: GameState, timestamp?: number) => {
    const isBonus = Math.random() < 0.5; // 50% chance for a bonus event
    
    if (isBonus) {
        const resourceType = Math.random() < 0.6 ? 'metal' : 'crystal';
        const amount = Math.floor(Math.random() * 5000) + 2500;
        gameState.resources[resourceType as 'metal' | 'crystal'] += amount;
        addMessage<AsteroidImpactMessage>(gameState, {
            type: 'asteroid_impact',
            subject: 'Deszcz Meteorytów!',
            impactType: AsteroidImpactType.BONUS,
            details: { resourceType, amount }
        }, timestamp);
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
                addMessage<AsteroidImpactMessage>(gameState, {
                    type: 'asteroid_impact',
                    subject: 'Uderzenie Asteroidy!',
                    impactType: AsteroidImpactType.DAMAGE,
                    details: { buildingId: buildingToDamage, newLevel }
                }, timestamp);
            }
        }
    }
};

export const triggerResourceVein = (gameState: GameState, timestamp?: number) => {
    if (gameState.scopedResourceVeinBonus && gameState.scopedResourceVeinBonus.active) {
        return;
    }

    const resourceType = ['metal', 'crystal', 'deuterium'][Math.floor(Math.random() * 3)] as keyof Omit<Resources, 'energy'>;
    const eventTime = timestamp || Date.now();
    const endTime = eventTime + 24 * 60 * 60 * 1000;
    
    gameState.scopedResourceVeinBonus = {
        active: true,
        resourceType,
        endTime,
        bonusMultiplier: 1.25,
    };

    addMessage<ResourceVeinMessage>(gameState, {
        type: 'resource_vein',
        subject: 'Odkryto Bogatą Żyłę!',
        resourceType,
        status: 'activated',
        bonusEndTime: endTime
    }, eventTime);
};

export const triggerSpacePlague = (gameState: GameState, timestamp?: number) => {
    if (gameState.scopedSpacePlagueState && gameState.scopedSpacePlagueState.active) return;

    const playerFleet = Object.values(gameState.colonies)
        .flatMap((colony: Colony): [string, number | undefined][] => Object.entries(colony.fleet))
        .filter((entry): entry is [ShipType, number] => {
            const [, count] = entry;
            return (count || 0) > 0;
        });
        
    if (playerFleet.length > 0) {
        const [infectedShip] = playerFleet[Math.floor(Math.random() * playerFleet.length)];
        const eventTime = timestamp || Date.now();
        gameState.scopedSpacePlagueState = {
            active: true,
            infectedShip: infectedShip as ShipType,
            endTime: eventTime + 6 * 60 * 60 * 1000, // 6 hours
        };

        addMessage<SpacePlagueMessage>(gameState, {
            type: 'space_plague',
            subject: 'Wykryto Kosmiczną Zarazę!',
            infectedShip: infectedShip as ShipType,
            status: 'activated'
        }, eventTime);
    }
};

export const triggerGhostShip = (gameState: GameState, timestamp?: number) => {
    if (gameState.scopedGhostShipState && gameState.scopedGhostShipState.status !== GhostShipStatus.INACTIVE) return;
    
    const galaxy = Math.floor(Math.random() * 3) + 1;
    const system = Math.floor(Math.random() * 499) + 1;
    const position = Math.floor(Math.random() * 15) + 1;
    const coords = `${galaxy}:${system}:${position}`;
    
    const powerfulShips = [ShipType.BATTLESHIP, ShipType.CRUISER, ShipType.DESTROYER, ShipType.BATTLECRUISER];
    const shipType = powerfulShips[Math.floor(Math.random() * powerfulShips.length)];

    gameState.scopedGhostShipState = {
        status: GhostShipStatus.AWAITING_CHOICE,
        locationCoords: coords,
        shipType: shipType
    };
    
    addMessage<GhostShipDiscoveryMessage>(gameState, {
        type: 'ghost_ship_discovery',
        subject: 'Wykryto Statek Widmo!',
        shipType: shipType,
        locationCoords: coords
    }, timestamp);
};

export const triggerGalacticGoldRush = (gameState: GameState, timestamp?: number) => {
    if (gameState.scopedGalacticGoldRushState && gameState.scopedGalacticGoldRushState.active) return;
    
    const eventTime = timestamp || Date.now();
    gameState.scopedGalacticGoldRushState = {
        active: true,
        endTime: eventTime + 24 * 60 * 60 * 1000, // 24 hours
    };

    addMessage<GalacticGoldRushMessage>(gameState, {
        type: 'galactic_gold_rush',
        subject: 'Ogłoszono Galaktyczną Gorączkę Złota!',
        status: 'activated'
    }, eventTime);
};

export const triggerStellarAurora = (gameState: GameState, timestamp?: number) => {
    if (gameState.scopedStellarAuroraState && gameState.scopedStellarAuroraState.active) return;
    
    const durationHours = [4, 6, 8][Math.floor(Math.random() * 3)];
    const eventTime = timestamp || Date.now();
    gameState.scopedStellarAuroraState = {
        active: true,
        endTime: eventTime + durationHours * 60 * 60 * 1000,
    };
    addMessage<StellarAuroraMessage>(gameState, {
        type: 'stellar_aurora',
        subject: 'Pojawiła się Zorza Gwiezdna!',
        status: 'activated',
        durationHours: durationHours
    }, eventTime);
};