
import { PlayerState, BuildingType, ResearchType, ShipType, DefenseType, Resources } from '../src/types';
import { BUILDING_DATA, RESEARCH_DATA, ALL_SHIP_DATA, DEFENSE_DATA } from '../src/constants';

const costToPoints = (cost: Resources) => (cost.metal + cost.crystal + cost.deuterium) / 1000;

export const calculatePlayerPoints = (playerState: PlayerState): number => {
    let points = 0;

    // Points from Buildings on all colonies
    for (const colonyId in playerState.colonies) {
        const colony = playerState.colonies[colonyId];
        for (const buildingId in colony.buildings) {
            const level = colony.buildings[buildingId as BuildingType];
            for (let i = 1; i <= level; i++) {
                points += costToPoints(BUILDING_DATA[buildingId as BuildingType].cost(i));
            }
        }
    }
    
    // Points from Buildings on all moons
    for (const moonId in playerState.moons) {
        const moon = playerState.moons[moonId];
        for (const buildingId in moon.buildings) {
            const level = moon.buildings[buildingId as BuildingType];
            for (let i = 1; i <= level; i++) {
                points += costToPoints(BUILDING_DATA[buildingId as BuildingType].cost(i));
            }
        }
    }

    // Points from Research
    for (const researchId in playerState.research) {
        const level = playerState.research[researchId as ResearchType];
        for (let i = 1; i <= level; i++) {
            points += costToPoints(RESEARCH_DATA[researchId as ResearchType].cost(i));
        }
    }

    // Aggregate fleet from all colonies and moons
    const totalFleet: { [key in ShipType]?: number } = {};
    for (const colonyId in playerState.colonies) {
        const colony = playerState.colonies[colonyId];
        for (const shipId in colony.fleet) {
            totalFleet[shipId as ShipType] = (totalFleet[shipId as ShipType] || 0) + (colony.fleet[shipId as ShipType] || 0);
        }
    }
    for (const moonId in playerState.moons) {
        const moon = playerState.moons[moonId];
         for (const shipId in moon.fleet) {
            totalFleet[shipId as ShipType] = (totalFleet[shipId as ShipType] || 0) + (moon.fleet[shipId as ShipType] || 0);
        }
    }
    // Points from Fleet
    for (const shipId in totalFleet) {
        points += costToPoints(ALL_SHIP_DATA[shipId as ShipType].cost(1)) * (totalFleet[shipId as ShipType] || 0);
    }

    // Aggregate defenses from all colonies and moons
    let totalDefenses: { [key in DefenseType]?: number } = {};
     for (const colonyId in playerState.colonies) {
        const colony = playerState.colonies[colonyId];
        for (const defenseId in colony.defenses) {
            totalDefenses[defenseId as DefenseType] = (totalDefenses[defenseId as DefenseType] || 0) + (colony.defenses[defenseId as DefenseType] || 0);
        }
    }
    for (const moonId in playerState.moons) {
        const moon = playerState.moons[moonId];
         for (const defenseId in moon.defenses) {
            totalDefenses[defenseId as DefenseType] = (totalDefenses[defenseId as DefenseType] || 0) + (moon.defenses[defenseId as DefenseType] || 0);
        }
    }
    // Points from Defenses
    for (const defenseId in totalDefenses) {
        points += costToPoints(DEFENSE_DATA[defenseId as DefenseType].cost(1)) * (totalDefenses[defenseId as DefenseType] || 0);
    }

    return Math.floor(points);
};
