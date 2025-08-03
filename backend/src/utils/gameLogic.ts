

import { BuildingLevels, Resources, ResourceVeinBonus, Colony, ActiveBoosts, SolarFlareState, Fleet, StellarAuroraState, ResearchLevels, BuildingType, ResearchType, ShipType, PlanetSpecialization, SolarFlareStatus, BoostType, GameState } from '../types.js';
import { BUILDING_DATA, ALL_SHIP_DATA, COLONY_INCOME_BONUS_PER_HOUR, BASE_STORAGE_CAPACITY } from '../constants.js';

export const calculateNextBlackMarketIncome = (level: number): number => {
    if (level === 0) return 0;
    const minIncome = 50 * Math.pow(1.1, level - 1);
    const maxIncome = 200 * Math.pow(1.1, level - 1);
    return Math.floor(Math.random() * (maxIncome - minIncome + 1)) + minIncome;
};

export const calculateMaxResources = (colonies: Record<string, Colony>): Resources => {
    let totalCapacity: Resources = { metal: 0, crystal: 0, deuterium: 0, energy: 0 };
     for (const colony of Object.values(colonies)) {
        totalCapacity.metal += BUILDING_DATA[BuildingType.METAL_STORAGE].capacity?.(colony.buildings[BuildingType.METAL_STORAGE]) ?? BASE_STORAGE_CAPACITY;
        totalCapacity.crystal += BUILDING_DATA[BuildingType.CRYSTAL_STORAGE].capacity?.(colony.buildings[BuildingType.CRYSTAL_STORAGE]) ?? BASE_STORAGE_CAPACITY;
        totalCapacity.deuterium += BUILDING_DATA[BuildingType.DEUTERIUM_TANK].capacity?.(colony.buildings[BuildingType.DEUTERIUM_TANK]) ?? BASE_STORAGE_CAPACITY;
        totalCapacity.energy += BUILDING_DATA[BuildingType.ENERGY_STORAGE].capacity?.(colony.buildings[BuildingType.ENERGY_STORAGE]) ?? 0;
    }
    return totalCapacity;
};

export const calculateProductions = (gameState: GameState) => {
    const { colonies, resourceVeinBonus, activeBoosts, solarFlare, stellarAuroraState, research } = gameState;
    
    let totalProductions = { metal: 0, crystal: 0, deuterium: 0 };
    let totalEnergy = { produced: 0, consumed: 0 };

    for (const planet of Object.values(colonies)) {
        const energyTechLevel = research[ResearchType.ENERGY_TECHNOLOGY] || 0;
        const energyTechBonus = 1 + (energyTechLevel * 0.02);

        let solarPlantProduction = (BUILDING_DATA[BuildingType.SOLAR_PLANT].production?.(planet.buildings[BuildingType.SOLAR_PLANT]) ?? 0) * energyTechBonus;
        if (stellarAuroraState.active) {
            solarPlantProduction *= 1.30;
        }

        let planetEnergyProduction = solarPlantProduction;

        if (planet.buildings[BuildingType.FUSION_REACTOR] > 0) {
            planetEnergyProduction += (BUILDING_DATA[BuildingType.FUSION_REACTOR].production?.(planet.buildings[BuildingType.FUSION_REACTOR]) ?? 0) * energyTechBonus;
        }

        const satelliteData = ALL_SHIP_DATA[ShipType.SOLAR_SATELLITE];
        planetEnergyProduction += (planet.fleet[ShipType.SOLAR_SATELLITE] || 0) * (satelliteData.energyProduction || 0);
       
        if (solarFlare.status === SolarFlareStatus.POWER_BOOST) {
            planetEnergyProduction *= 1.5;
        }

        const planetEnergyConsumption = (Object.keys(planet.buildings) as BuildingType[]).reduce((total, type) => {
            const buildingInfo = BUILDING_DATA[type as BuildingType];
            if (type !== BuildingType.FUSION_REACTOR && planet.buildings[type as BuildingType] > 0) {
               return total + (buildingInfo.energyConsumption?.(planet.buildings[type as BuildingType]) ?? 0);
            }
            return total;
        }, 0);
        
        const efficiency = planetEnergyProduction >= planetEnergyConsumption ? 1 : (planetEnergyConsumption > 0 ? Math.max(0, planetEnergyProduction / planetEnergyConsumption) : 1);

        let metalProd = (BUILDING_DATA[BuildingType.METAL_MINE].production?.(planet.buildings[BuildingType.METAL_MINE]) ?? 0) * efficiency;
        let crystalProd = (BUILDING_DATA[BuildingType.CRYSTAL_MINE].production?.(planet.buildings[BuildingType.CRYSTAL_MINE]) ?? 0) * efficiency;
        let deuteriumProd = (BUILDING_DATA[BuildingType.DEUTERIUM_SYNTHESIZER].production?.(planet.buildings[BuildingType.DEUTERIUM_SYNTHESIZER]) ?? 0) * efficiency;
        
        if (planet.buildings[BuildingType.FUSION_REACTOR] > 0) {
            deuteriumProd -= BUILDING_DATA[BuildingType.FUSION_REACTOR].deuteriumConsumption?.(planet.buildings[BuildingType.FUSION_REACTOR]) ?? 0;
        }

        if (planet.id !== PLAYER_HOME_COORDS) {
            metalProd += COLONY_INCOME_BONUS_PER_HOUR.metal;
            crystalProd += COLONY_INCOME_BONUS_PER_HOUR.crystal;
            let colonyDeuterium = COLONY_INCOME_BONUS_PER_HOUR.deuterium;
            if (planet.specialization === PlanetSpecialization.DEUTERIUM_BOOST) {
                colonyDeuterium *= 1.10; // 10% bonus
            }
            deuteriumProd += colonyDeuterium;
        }
        
        totalProductions.metal += metalProd;
        totalProductions.crystal += crystalProd;
        totalProductions.deuterium += deuteriumProd;
        totalEnergy.produced += planetEnergyProduction;
        totalEnergy.consumed += planetEnergyConsumption;
    }


    if (resourceVeinBonus?.active && resourceVeinBonus.resourceType) {
        if (resourceVeinBonus.resourceType === 'metal') totalProductions.metal *= resourceVeinBonus.bonusMultiplier;
        else if (resourceVeinBonus.resourceType === 'crystal') totalProductions.crystal *= resourceVeinBonus.bonusMultiplier;
        else if (resourceVeinBonus.resourceType === 'deuterium') totalProductions.deuterium *= resourceVeinBonus.bonusMultiplier;
    }

    if (activeBoosts?.[BoostType.RESOURCE_PRODUCTION_BOOST]) {
        const boostPercent = activeBoosts[BoostType.RESOURCE_PRODUCTION_BOOST]!.level / 100;
        totalProductions.metal *= (1 + boostPercent);
        totalProductions.crystal *= (1 + boostPercent);
        totalProductions.deuterium *= (1 + boostPercent);
    }
     
    return {
        metal: totalProductions.metal,
        crystal: totalProductions.crystal,
        deuterium: totalProductions.deuterium,
        energy: { 
            produced: totalEnergy.produced, 
            consumed: totalEnergy.consumed, 
            efficiency: totalEnergy.produced >= totalEnergy.consumed ? 1 : (totalEnergy.consumed > 0 ? totalEnergy.produced / totalEnergy.consumed : 1)
        }
    };
};
