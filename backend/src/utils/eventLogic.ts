import { GameState, SolarFlareStatus, PirateMercenaryStatus, ContrabandStatus, AncientArtifactStatus, AsteroidImpactType, BuildingType, Resources, ShipType, SpacePlagueState, ContrabandOfferType, ResearchType, GhostShipStatus, GalacticGoldRushState, StellarAuroraState, InfoMessage, SolarFlareMessage, AsteroidImpactMessage, ResourceVeinMessage, SpacePlagueMessage, GhostShipDiscoveryMessage, GalacticGoldRushMessage, StellarAuroraMessage } from '../types';
import { ALL_SHIP_DATA, BUILDING_DATA, RESEARCH_DATA } from '../constants';

const addMessage = (gameState: GameState, message: any) => {
    gameState.messages.unshift({
        id: `msg-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        isRead: false,
        ...message
    });
};

// --- Event Trigger Functions ---

export const triggerSolarFlare = (gameState: GameState) => {
    if (gameState.solarFlare.status !== SolarFlareStatus.INACTIVE) return;

    const isDisruption = Math.random() < 0.3; // 30% chance for a negative event

    if (isDisruption) {
        gameState.solarFlare.status = SolarFlareStatus.DISRUPTION;
        gameState.solarFlare.endTime = Date.now() + 1 * 60 * 60 * 1000; // 1 hour
        addMessage(gameState, { type: 'solar_flare', subject: 'Rozbłysk: Zakłócenia Systemów!', status: SolarFlareStatus.DISRUPTION } as SolarFlareMessage);
    } else {
        gameState.solarFlare.status = SolarFlareStatus.POWER_BOOST;
        gameState.solarFlare.endTime = Date.now() + 12 * 60 * 60 * 1000; // 12 hours
        addMessage(gameState, { type: 'solar_flare', subject: 'Rozbłysk: Bonus Energii!', status: SolarFlareStatus.POWER_BOOST } as SolarFlareMessage);
    }
};

export const triggerPirateMercenary = (gameState: GameState) => {
    if (gameState.pirateMercenaryState.status !== PirateMercenaryStatus.INACTIVE) return;
    
    gameState.pirateMercenaryState.status = PirateMercenaryStatus.INCOMING;
    gameState.pirateMercenaryState.arrivalTime = Date.now() + 5 * 60 * 1000; // Arrives in 5 minutes
};

export const triggerContraband = (gameState: GameState) => {
    if (gameState.contrabandState.status !== ContrabandStatus.INACTIVE) return;

    gameState.contrabandState.status = ContrabandStatus.INCOMING;
    gameState.contrabandState.arrivalTime = Date.now() + 7 * 60 * 1000; // Arrives in 7 minutes
};

export const triggerAncientArtifact = (gameState: GameState) => {
    if (gameState.ancientArtifactState.status !== AncientArtifactStatus.INACTIVE) return;
    
    gameState.ancientArtifactState.status = AncientArtifactStatus.AWAITING_CHOICE;
    addMessage(gameState, { type: 'info', subject: 'Odkryto Starożytny Artefakt!', text: 'Na jednej z twoich planet odkryto tajemniczy obiekt. Sprawdź wiadomości, aby podjąć decyzję.' } as InfoMessage);
};

export const triggerAsteroidImpact = (gameState: GameState) => {
    const isBonus = Math.random() < 0.5; // 50% chance for a bonus event
    
    if (isBonus) {
        const resourceType = Math.random() < 0.6 ? 'metal' : 'crystal';
        const amount = Math.floor(Math.random() * 5000) + 2500;
        gameState.resources[resourceType] += amount;
        addMessage(gameState, {
            type: 'asteroid_impact',
            subject: 'Deszcz Meteorytów!',
            impactType: AsteroidImpactType.BONUS,
            details: { resourceType, amount }
        } as AsteroidImpactMessage);
    } else {
        const builtBuildings = Object.entries(gameState.colonies[Object.keys(gameState.colonies)[0]].buildings)
            .filter(([, level]) => level > 0)
            .map(([id]) => id as BuildingType);
        
        if (builtBuildings.length > 0) {
            const buildingToDamage = builtBuildings[Math.floor(Math.random() * builtBuildings.length)];
            const currentLevel = gameState.colonies[Object.keys(gameState.colonies)[0]].buildings[buildingToDamage];
            if (currentLevel > 1) {
                const newLevel = Math.max(1, currentLevel - 1);
                gameState.colonies[Object.keys(gameState.colonies)[0]].buildings[buildingToDamage] = newLevel;
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

export const triggerResourceVein = (gameState: GameState) => {
    if (gameState.resourceVeinBonus.active) return;

    const resourceType = ['metal', 'crystal', 'deuterium'][Math.floor(Math.random() * 3)] as keyof Resources;
    gameState.resourceVeinBonus.active = true;
    gameState.resourceVeinBonus.resourceType = resourceType;
    gameState.resourceVeinBonus.endTime = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    addMessage(gameState, {
        type: 'resource_vein',
        subject: 'Odkryto Bogatą Żyłę!',
        resourceType,
        status: 'activated',
        bonusEndTime: gameState.resourceVeinBonus.endTime
    } as ResourceVeinMessage);
};

export const triggerSpacePlague = (gameState: GameState) => {
    if (gameState.spacePlague.active) return;

    const playerFleet = Object.entries(gameState.colonies)
        .flatMap(([, colony]) => Object.entries(colony.fleet))
        .filter(([, count]) => count > 0);
        
    if (playerFleet.length > 0) {
        const [infectedShip] = playerFleet[Math.floor(Math.random() * playerFleet.length)];
        gameState.spacePlague.active = true;
        gameState.spacePlague.infectedShip = infectedShip as ShipType;
        gameState.spacePlague.endTime = Date.now() + 6 * 60 * 60 * 1000; // 6 hours
        addMessage(gameState, {
            type: 'space_plague',
            subject: 'Wykryto Kosmiczną Zarazę!',
            infectedShip: infectedShip as ShipType,
            status: 'activated'
        } as SpacePlagueMessage);
    }
};

export const triggerGhostShip = (gameState: GameState) => {
    if (gameState.ghostShipState.status !== GhostShipStatus.INACTIVE) return;
    
    // Find an empty location
    const galaxy = Math.floor(Math.random() * 3) + 1;
    const system = Math.floor(Math.random() * 499) + 1;
    const position = Math.floor(Math.random() * 15) + 1;
    const coords = `${galaxy}:${system}:${position}`;
    
    const powerfulShips = [ShipType.BATTLESHIP, ShipType.CRUISER, ShipType.DESTROYER, ShipType.BATTLECRUISER];
    const shipType = powerfulShips[Math.floor(Math.random() * powerfulShips.length)];

    gameState.ghostShipState = {
        status: GhostShipStatus.AWAITING_CHOICE,
        locationCoords: coords,
        shipType: shipType
    };
    
    addMessage(gameState, {
        type: 'ghost_ship_discovery',
        subject: 'Wykryto Statek Widmo!',
        shipType: shipType,
        locationCoords: coords
    } as GhostShipDiscoveryMessage);
};

export const triggerGalacticGoldRush = (gameState: GameState) => {
    if (gameState.galacticGoldRushState.active) return;
    
    gameState.galacticGoldRushState.active = true;
    gameState.galacticGoldRushState.endTime = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    addMessage(gameState, {
        type: 'galactic_gold_rush',
        subject: 'Ogłoszono Galaktyczną Gorączkę Złota!',
        status: 'activated'
    } as GalacticGoldRushMessage);
};

export const triggerStellarAurora = (gameState: GameState) => {
    if (gameState.stellarAuroraState.active) return;
    
    const durationHours = [4, 6, 8][Math.floor(Math.random() * 3)];
    gameState.stellarAuroraState.active = true;
    gameState.stellarAuroraState.endTime = Date.now() + durationHours * 60 * 60 * 1000;
    addMessage(gameState, {
        type: 'stellar_aurora',
        subject: 'Pojawiła się Zorza Gwiezdna!',
        status: 'activated',
        durationHours: durationHours
    } as StellarAuroraMessage);
};