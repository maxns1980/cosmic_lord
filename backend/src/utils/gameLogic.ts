
import { BuildingLevels, Resources, ResourceVeinBonus, Colony, ActiveBoosts, SolarFlareState, Fleet, StellarAuroraState, ResearchLevels, BuildingType, ResearchType, ShipType, PlanetSpecialization, SolarFlareStatus, BoostType } from '../types.js';
import { BUILDING_DATA, ALL_SHIP_DATA, COLONY_INCOME_BONUS_PER_HOUR, BASE_STORAGE_CAPACITY } from '../constants.js';

export const calculateNextBlackMarketIncome = (level: number): number => {
    if (level === 0) return 0;
    const minIncome = 50 * Math.pow(1.1, level - 1);
    const maxIncome = 200 * Math.pow(1.1, level - 1);
    return Math.floor(Math.random() * (maxIncome - minIncome + 1)) + minIncome;
};

export const calculateMaxResources = (buildings: BuildingLevels): Resources => {
    const metalCapacity = BUILDING_DATA[BuildingType.METAL_STORAGE].capacity?.(buildings[BuildingType.METAL_STORAGE]) ?? BASE_STORAGE_CAPACITY;
    const crystalCapacity = BUILDING_DATA[BuildingType.CRYSTAL_STORAGE].capacity?.(buildings[BuildingType.CRYSTAL_STORAGE]) ?? BASE_STORAGE_CAPACITY;
    const deuteriumCapacity = BUILDING_DATA[BuildingType.DEUTERIUM_TANK].capacity?.(buildings[BuildingType.DEUTERIUM_TANK]) ?? BASE_STORAGE_CAPACITY;
    const energyCapacity = BUILDING_DATA[BuildingType.ENERGY_STORAGE].capacity?.(buildings[BuildingType.ENERGY_STORAGE]) ?? 0;

    return {
      metal: metalCapacity,
      crystal: crystalCapacity,
      deuterium: deuteriumCapacity,
      energy: energyCapacity,
    };
};

export const calculateProductions = (buildings: BuildingLevels, resourceVeinBonus: ResourceVeinBonus, colonies: Colony[], activeBoosts: ActiveBoosts, solarFlare: SolarFlareState, fleet: Fleet, stellarAurora: StellarAuroraState, research: ResearchLevels) => {
    const energyTechLevel = research[ResearchType.ENERGY_TECHNOLOGY] || 0;
    const energyTechBonus = 1 + (energyTechLevel * 0.02);

    let solarPlantProduction = (BUILDING_DATA[BuildingType.SOLAR_PLANT].production?.(buildings[BuildingType.SOLAR_PLANT]) ?? 0) * energyTechBonus;
    
    if (stellarAurora.active) {
        solarPlantProduction *= 1.30;
    }

    let energyProduction = solarPlantProduction;

    if (buildings[BuildingType.FUSION_REACTOR] > 0) {
        energyProduction += (BUILDING_DATA[BuildingType.FUSION_REACTOR].production?.(buildings[BuildingType.FUSION_REACTOR]) ?? 0) * energyTechBonus;
    }

    const satelliteData = ALL_SHIP_DATA[ShipType.SOLAR_SATELLITE];
    energyProduction += (fleet[ShipType.SOLAR_SATELLITE] || 0) * (satelliteData.energyProduction || 0);

    if (solarFlare.status === SolarFlareStatus.POWER_BOOST) {
        energyProduction *= 1.5;
    }
    
    const energyConsumption = (Object.keys(buildings) as BuildingType[]).reduce((total, type) => {
        const buildingInfo = BUILDING_DATA[type as BuildingType];
        if (type !== BuildingType.FUSION_REACTOR && buildings[type as BuildingType] > 0) {
           return total + (buildingInfo.energyConsumption?.(buildings[type as BuildingType]) ?? 0);
        }
        return total;
    }, 0);
    
    const efficiency = energyProduction >= energyConsumption ? 1 : (energyConsumption > 0 ? Math.max(0, energyProduction / energyConsumption) : 1);
    
    let metalProd = (BUILDING_DATA[BuildingType.METAL_MINE].production?.(buildings[BuildingType.METAL_MINE]) ?? 0);
    let crystalProd = (BUILDING_DATA[BuildingType.CRYSTAL_MINE].production?.(buildings[BuildingType.CRYSTAL_MINE]) ?? 0);
    let deuteriumProd = (BUILDING_DATA[BuildingType.DEUTERIUM_SYNTHESIZER].production?.(buildings[BuildingType.DEUTERIUM_SYNTHESIZER]) ?? 0);

    if (resourceVeinBonus?.active && resourceVeinBonus.resourceType) {
        if (resourceVeinBonus.resourceType === 'metal') metalProd *= resourceVeinBonus.bonusMultiplier;
        else if (resourceVeinBonus.resourceType === 'crystal') crystalProd *= resourceVeinBonus.bonusMultiplier;
        else if (resourceVeinBonus.resourceType === 'deuterium') deuteriumProd *= resourceVeinBonus.bonusMultiplier;
    }

    if (activeBoosts?.[BoostType.RESOURCE_PRODUCTION_BOOST]) {
        const boostPercent = activeBoosts[BoostType.RESOURCE_PRODUCTION_BOOST]!.level / 100;
        metalProd *= (1 + boostPercent);
        crystalProd *= (1 + boostPercent);
        deuteriumProd *= (1 + boostPercent);
    }

    colonies.forEach(colony => {
        metalProd += COLONY_INCOME_BONUS_PER_HOUR.metal;
        crystalProd += COLONY_INCOME_BONUS_PER_HOUR.crystal;
        let colonyDeuterium = COLONY_INCOME_BONUS_PER_HOUR.deuterium;
        if(colony.specialization === PlanetSpecialization.DEUTERIUM_BOOST) {
            colonyDeuterium *= 1.10;
        }
        deuteriumProd += colonyDeuterium;
    });

    if (buildings[BuildingType.FUSION_REACTOR] > 0) {
        const fusionReactorDeuteriumConsumption = BUILDING_DATA[BuildingType.FUSION_REACTOR].deuteriumConsumption?.(buildings[BuildingType.FUSION_REACTOR]) ?? 0;
        deuteriumProd -= fusionReactorDeuteriumConsumption;
    }
     
    return {
        metal: metalProd * efficiency,
        crystal: crystalProd * efficiency,
        deuterium: deuteriumProd * efficiency,
        energy: { produced: energyProduction, consumed: energyConsumption, efficiency: efficiency, techBonus: energyTechLevel * 2 }
    };
};
