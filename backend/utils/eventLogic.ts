

import { GameState, SolarFlareStatus, PirateMercenaryStatus, ContrabandStatus, AncientArtifactStatus, AsteroidImpactType, BuildingType, Resources, ShipType, SpacePlagueState, ContrabandOfferType, ResearchType, GhostShipStatus, GalacticGoldRushState, StellarAuroraState, InfoMessage, SolarFlareMessage, AsteroidImpactMessage, ResourceVeinMessage, SpacePlagueMessage, GhostShipDiscoveryMessage, GalacticGoldRushMessage, StellarAuroraMessage, Colony, Message } from '../types.js';
import { ALL_SHIP_DATA, BUILDING_DATA, RESEARCH_DATA } from '../constants.js';

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
    if (gameState.solarFlare.status !== SolarFlareStatus.INACTIVE) return;

    const isDisruption = Math.random() < 0.3; // 30% chance for a negative event

    if (isDisruption) {
        gameState.solarFlare.status = SolarFlareStatus.DISRUPTION;
        gameState.solarFlare.endTime = Date.now() + 1 * 60 * 60 * 1000; // 1 hour
        addMessage(gameState, { type: 'solar_flare', subject: 'Rozbłysk: Zakłócenia Systemów!', status: SolarFlareStatus.DISRUPTION });
    } else {
        gameState.solarFlare.status = SolarFlareStatus.POWER_BOOST;
        gameState.solarFlare.endTime = Date.now() + 12 * 60 * 60 * 1000; // 12 hours
        addMessage(gameState, { type: 'solar_flare', subject: 'Rozbłysk: Bonus Energii!', status: SolarFlareStatus.POWER_BOOST });
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
    if (gameState.resourceVeinBonus.active) return;

    const resourceType = ['metal', 'crystal', 'deuterium'][Math.floor(Math.random() * 3)] as keyof Omit<Resources, 'energy'>;
    gameState.resourceVeinBonus.active = true;
    gameState.resourceVeinBonus.resourceType = resourceType;
    gameState.resourceVeinBonus.endTime = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    addMessage(gameState, {
        type: 'resource_vein',
        subject: 'Odkryto Bogatą Żyłę!',
        resourceType,
        status: 'activated',
        bonusEndTime: gameState.resourceVeinBonus.endTime
    });
};

export const triggerSpacePlague = (gameState: GameState) => {
    if (gameState.spacePlague.active) return;

    const playerFleet = Object.values(gameState.colonies)
        .flatMap((colony: Colony): [string, number | undefined][] => Object.entries(colony.fleet))
        .filter((entry): entry is [ShipType, number] => {
            const [, count] = entry;
            return (count || 0) > 0;
        });
        
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
        });
    }
};

export const triggerGhostShip = (gameState: GameState) => {
    if (gameState.ghostShipState.status !== GhostShipStatus.INACTIVE) return;
    
    