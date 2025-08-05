

import { GameState, SolarFlareStatus, PirateMercenaryStatus, ContrabandStatus, AncientArtifactStatus, AsteroidImpactType, BuildingType, Resources, ShipType, SpacePlagueState, ContrabandOfferType, ResearchType, GhostShipStatus, GalacticGoldRushState, StellarAuroraState, InfoMessage, SolarFlareMessage, AsteroidImpactMessage, ResourceVeinMessage, SpacePlagueMessage, GhostShipDiscoveryMessage, GalacticGoldRushMessage, StellarAuroraMessage, Colony, Message, PirateMessage, ContrabandMessage } from '../src/types.js';
import { ALL_SHIP_DATA, BUILDING_DATA, RESEARCH_DATA } from '../src/constants.js';

const addMessage = (gameState: GameState, message: Omit<Message, 'id' | 'timestamp' | 'isRead'>) => {
    gameState.messages.unshift({
        id: `msg-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        isRead: false,
        ...message
    } as Message);
};

// --- Event Trigger Functions ---

export const triggerSolarFlare = (gameState: GameState) => {
    if (gameState.scopedSolarFlareState && gameState.scopedSolarFlareState.status !== SolarFlareStatus.INACTIVE) return;

    const isDisruption = Math.random() < 0.3; // 30% chance for a negative event

    const status = isDisruption ? SolarFlareStatus.DISRUPTION : SolarFlareStatus.POWER_BOOST;
    const endTime = Date.now() + (isDisruption ? 1 : 12) * 60 * 60 * 1000;
    
    gameState.scopedSolarFlareState = { status, endTime };

    addMessage(gameState, { 
        type: 'solar_flare', 
        subject: isDisruption ? 'Rozbłysk: Zakłócenia Systemów!' : 'Rozbłysk: Bonus Energii!', 
        status,
        isEndMessage: false,
    });
};

export const triggerPirateMercenary = (gameState: GameState) => {
    if (gameState.scopedPirateMercenaryState && gameState.scopedPirateMercenaryState.status !== PirateMercenaryStatus.INACTIVE) return;
    
    gameState.scopedPirateMercenaryState = {
        status: PirateMercenaryStatus.INCOMING,
        arrivalTime: Date.now() + 5 * 60 * 1000, // Arrives in 5 minutes
        departureTime: 0,
        fleet: {},
        hireCost: 0,
    };
    addMessage(gameState, { type: 'info', subject: 'Wykryto sygnaturę Piratów!', text: 'Zbliżają się do Twojego systemu.' });
};

export const triggerContraband = (gameState: GameState) => {
    if (gameState.scopedContrabandState && gameState.scopedContrabandState.status !== ContrabandStatus.INACTIVE) return;

    gameState.scopedContrabandState = {
        status: ContrabandStatus.INCOMING,
        arrivalTime: Date.now() + 7 * 60 * 1000, // Arrives in 7 minutes
        departureTime: 0,
        offer: null,
    };
    addMessage(gameState, { type: 'info', subject: 'Zaszyfrowana transmisja!', text: 'Przemytnicy kontrabandy wkrótce złożą ofertę.' });
};

export const triggerAncientArtifact = (gameState: GameState) => {
    if (gameState.scopedAncientArtifactState && gameState.scopedAncientArtifactState.status !== AncientArtifactStatus.INACTIVE) return;
    
    gameState.scopedAncientArtifactState = { status: AncientArtifactStatus.AWAITING_CHOICE };
    addMessage(gameState, { type: 'info', subject: 'Odkryto Starożytny Artefakt!', text: 'Na jednej z twoich planet odkryto tajemniczy obiekt. Sprawdź wiadomości, aby podjąć decyzję.' });
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
        });
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
                });
            }
        }
    }
};

export const triggerResourceVein = (gameState: GameState) => {
    if (gameState.scopedResourceVeinBonus && gameState.scopedResourceVeinBonus.active) return;

    const resourceType = ['metal', 'crystal', 'deuterium'][Math.floor(Math.random() * 3)] as keyof Omit<Resources, 'energy'>;
    const endTime = Date.now() + 24 * 60 * 60 * 1000;
    
    gameState.scopedResourceVeinBonus = {
        active: true,
        resourceType,
        endTime,
        bonusMultiplier: 1.25,
    };

    addMessage(gameState, {
        type: 'resource_vein',
        subject: 'Odkryto Bogatą Żyłę!',
        resourceType,
        status: 'activated',
        bonusEndTime: endTime
    });
};

export const triggerSpacePlague = (gameState: GameState) => {
    if (gameState.scopedSpacePlagueState && gameState.scopedSpacePlagueState.active) return;

    const playerFleet = Object.values(gameState.colonies)
        .flatMap((colony: Colony): [string, number | undefined][] => Object.entries(colony.fleet))
        .filter((entry): entry is [ShipType, number] => {
            const [, count] = entry;
            return (count || 0) > 0;
        });
        
    if (playerFleet.length > 0) {
        const [infectedShip] = playerFleet[Math.floor(Math.random() * playerFleet.length)];
        
        gameState.scopedSpacePlagueState = {
            active: true,
            infectedShip: infectedShip as ShipType,
            endTime: Date.now() + 6 * 60 * 60 * 1000, // 6 hours
        };

        addMessage(gameState, {
            type: 'space_plague',
            subject: 'Wykryto Kosmiczną Zarazę!',
            infectedShip: infectedShip as ShipType,
            status: 'activated'
        });
    }
};

export const triggerGhostShip = (gameState: GameState) => {
    if (gameState.scopedGhostShipState && gameState.scopedGhostShipState.status !== GhostShipStatus.INACTIVE) return;
    
    // Find an empty location
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
    
    addMessage(gameState, {
        type: 'ghost_ship_discovery',
        subject: 'Wykryto Statek Widmo!',
        shipType: shipType,
        locationCoords: coords
    });
};

export const triggerGalacticGoldRush = (gameState: GameState) => {
    if (gameState.scopedGalacticGoldRushState && gameState.scopedGalacticGoldRushState.active) return;
    
    gameState.scopedGalacticGoldRushState = {
        active: true,
        endTime: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };

    addMessage(gameState, {
        type: 'galactic_gold_rush',
        subject: 'Ogłoszono Galaktyczną Gorączkę Złota!',
        status: 'activated'
    });
};

export const triggerStellarAurora = (gameState: GameState) => {
    if (gameState.scopedStellarAuroraState && gameState.scopedStellarAuroraState.active) return;
    
    const durationHours = [4, 6, 8][Math.floor(Math.random() * 3)];
    gameState.scopedStellarAuroraState = {
        active: true,
        endTime: Date.now() + durationHours * 60 * 60 * 1000,
    };
    addMessage(gameState, {
        type: 'stellar_aurora',
        subject: 'Pojawiła się Zorza Gwiezdna!',
        status: 'activated',
        durationHours: durationHours
    });
};