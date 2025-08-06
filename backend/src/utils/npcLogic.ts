import { NPCState, BuildingType, Resources, BuildingLevels, ResearchLevels, ResearchType, NPCPersonality, ShipType, DefenseType, NPCFleetMission, MissionType, Fleet, SleeperNpcState, Defenses } from '../types.js';
import { BUILDING_DATA, BASE_STORAGE_CAPACITY, RESEARCH_DATA, SHIPYARD_DATA, DEFENSE_DATA, ALL_SHIP_DATA, ALL_GAME_OBJECTS, INITIAL_NPC_STATE, INITIAL_BUILDING_LEVELS, INITIAL_RESEARCH_LEVELS } from '../constants.js';

const calculateNpcProductions = (npc: NPCState) => {
    const { buildings, fleet, developmentSpeed = 1.0 } = npc;
    let energyProduction = BUILDING_DATA[BuildingType.SOLAR_PLANT].production?.(buildings[BuildingType.SOLAR_PLANT]) ?? 0;
    energyProduction += BUILDING_DATA[BuildingType.FUSION_REACTOR].production?.(buildings[BuildingType.FUSION_REACTOR]) ?? 0;
    const satelliteData = ALL_SHIP_DATA[ShipType.SOLAR_SATELLITE];
    energyProduction += (fleet[ShipType.SOLAR_SATELLITE] || 0) * (satelliteData.energyProduction || 0);
    
    const energyConsumption = (Object.keys(buildings) as BuildingType[]).reduce((total, type) => {
        const buildingInfo = BUILDING_DATA[type as BuildingType];
        if (type !== BuildingType.FUSION_REACTOR && buildings[type as BuildingType] > 0) {
           return total + (buildingInfo.energyConsumption?.(buildings[type as BuildingType]) ?? 0);
        }
        return total;
    }, 0);
    
    const efficiency = energyProduction >= energyConsumption ? 1 : Math.max(0, energyProduction / energyConsumption);
    
    let metalProd = (BUILDING_DATA[BuildingType.METAL_MINE].production?.(buildings[BuildingType.METAL_MINE]) ?? 0) * efficiency;
    let crystalProd = (BUILDING_DATA[BuildingType.CRYSTAL_MINE].production?.(buildings[BuildingType.CRYSTAL_MINE]) ?? 0) * efficiency;
    let deuteriumProd = (BUILDING_DATA[BuildingType.DEUTERIUM_SYNTHESIZER].production?.(buildings[BuildingType.DEUTERIUM_SYNTHESIZER]) ?? 0) * efficiency;

    const fusionReactorDeuteriumConsumption = BUILDING_DATA[BuildingType.FUSION_REACTOR].deuteriumConsumption?.(buildings[BuildingType.FUSION_REACTOR]) ?? 0;
    deuteriumProd -= fusionReactorDeuteriumConsumption;

    return {
        metal: metalProd * developmentSpeed,
        crystal: crystalProd * developmentSpeed,
        deuterium: deuteriumProd * developmentSpeed,
    };
};

const calculateNpcMaxResources = (buildings: BuildingLevels): Resources => {
    return {
      metal: BUILDING_DATA[BuildingType.METAL_STORAGE].capacity?.(buildings[BuildingType.METAL_STORAGE]) || BASE_STORAGE_CAPACITY,
      crystal: BUILDING_DATA[BuildingType.CRYSTAL_STORAGE].capacity?.(buildings[BuildingType.CRYSTAL_STORAGE]) || BASE_STORAGE_CAPACITY,
      deuterium: BUILDING_DATA[BuildingType.DEUTERIUM_TANK].capacity?.(buildings[BuildingType.DEUTERIUM_TANK]) || BASE_STORAGE_CAPACITY,
      energy: BUILDING_DATA[BuildingType.ENERGY_STORAGE].capacity?.(buildings[BuildingType.ENERGY_STORAGE]) || 0,
    };
};

const canAfford = (resources: Resources, cost: Resources) => {
    return resources.metal >= cost.metal && resources.crystal >= cost.crystal && resources.deuterium >= cost.deuterium;
}

const checkNpcRequirements = (requirements: Partial<BuildingLevels & ResearchLevels> | undefined, buildings: BuildingLevels, research: ResearchLevels): boolean => {
    if (!requirements) return true;
    return Object.entries(requirements).every(([reqId, reqLevel]) => {
        if (Object.values(BuildingType).includes(reqId as BuildingType)) {
            return buildings[reqId as BuildingType] >= (reqLevel as number);
        }
        if (Object.values(ResearchType).includes(reqId as ResearchType)) {
            return research[reqId as ResearchType] >= (reqLevel as number);
        }
        return false;
    });
};

const costToPoints = (cost: Resources) => {
    return (cost.metal + cost.crystal + cost.deuterium) / 1000;
}

export const calculatePointsForNpc = (npc: NPCState): number => {
    let points = 0;

    for (const id in npc.buildings) {
        const level = npc.buildings[id as BuildingType];
        if (level > 0) {
            for (let i = 1; i <= level; i++) {
                points += costToPoints(BUILDING_DATA[id as BuildingType].cost(i));
            }
        }
    }
    for (const id in npc.research) {
        const level = npc.research[id as ResearchType];
        if (level > 0) {
            for (let i = 1; i <= level; i++) {
                points += costToPoints(RESEARCH_DATA[id as ResearchType].cost(i));
            }
        }
    }
    for (const id in npc.fleet) {
        const count = npc.fleet[id as ShipType] || 0;
        if (count > 0) {
            points += costToPoints(ALL_SHIP_DATA[id as ShipType].cost(1)) * count;
        }
    }
    for (const id in npc.defenses) {
        const count = npc.defenses[id as DefenseType] || 0;
        if (count > 0) {
            points += costToPoints(DEFENSE_DATA[id as DefenseType].cost(1)) * count;
        }
    }

    return Math.floor(points);
}


// Simplified AI logic for spending resources
const spendResourcesAI = (npc: NPCState, isThreatened: boolean): NPCState => {
    type BuildItem = { type?: BuildingType | ResearchType | ShipType | DefenseType; kind: 'building' | 'research' | 'ship' | 'defense' | 'cheapest_mine'; amount?: number };

    const DEFENSIVE_PRIORITIES: BuildItem[] = [
        // Top-tier defenses first
        { type: DefenseType.PLASMA_TURRET, kind: 'defense', amount: 2 },
        { type: DefenseType.ION_CANNON, kind: 'defense', amount: 5 },
        { type: DefenseType.HEAVY_LASER_CANNON, kind: 'defense', amount: 5 },
        // Then ships
        { type: ShipType.DESTROYER, kind: 'ship', amount: 1 },
        { type: ShipType.BATTLESHIP, kind: 'ship', amount: 1 },
        { type: ShipType.CRUISER, kind: 'ship', amount: 2 },
        { type: ShipType.HEAVY_FIGHTER, kind: 'ship', amount: 5 },
        // Basic defenses
        { type: DefenseType.LIGHT_LASER_CANNON, kind: 'defense', amount: 10 },
        { type: DefenseType.ROCKET_LAUNCHER, kind: 'defense', amount: 10 },
        // Supporting infrastructure
        { type: BuildingType.SHIPYARD, kind: 'building' },
        { type: ResearchType.WEAPON_TECHNOLOGY, kind: 'research' },
        { type: ResearchType.SHIELDING_TECHNOLOGY, kind: 'research' },
        { type: ResearchType.ARMOR_TECHNOLOGY, kind: 'research' },
        // Fallback to econ if nothing else can be built
        { kind: 'cheapest_mine' },
        { type: BuildingType.SOLAR_PLANT, kind: 'building' },
        { type: BuildingType.METAL_STORAGE, kind: 'building' },
        { type: BuildingType.CRYSTAL_STORAGE, kind: 'building' },
    ];

    const buildPriorities: Record<NPCPersonality, BuildItem[]> = {
        [NPCPersonality.AGGRESSIVE]: [
            // End-Game Units
            { type: ShipType.BATTLECRUISER, kind: 'ship', amount: 1 },
             // Capital Ships
            { type: ShipType.DESTROYER, kind: 'ship', amount: 1 },
            { type: ShipType.BATTLESHIP, kind: 'ship', amount: 1 },
            { type: ShipType.CRUISER, kind: 'ship', amount: 2 },
             // Research
            { type: ResearchType.WEAPON_TECHNOLOGY, kind: 'research' },
            { type: ResearchType.ARMOR_TECHNOLOGY, kind: 'research' },
            { type: ResearchType.SHIELDING_TECHNOLOGY, kind: 'research' },
            { type: ResearchType.COMBUSTION_DRIVE, kind: 'research' },
            { type: ResearchType.IMPULSE_DRIVE, kind: 'research' },
            { type: ResearchType.HYPERSPACE_DRIVE, kind: 'research' },
            // Ships and High-Tier Defense
            { type: ShipType.HEAVY_FIGHTER, kind: 'ship', amount: 2 },
            { type: DefenseType.PLASMA_TURRET, kind: 'defense', amount: 2 },
            { type: ShipType.MEDIUM_FIGHTER, kind: 'ship', amount: 5 },
            { type: ShipType.LIGHT_FIGHTER, kind: 'ship', amount: 10 },
            { type: ShipType.CARGO_SHIP, kind: 'ship', amount: 2 },
            // Defenses
            { type: DefenseType.HEAVY_LASER_CANNON, kind: 'defense', amount: 5 },
            { type: DefenseType.LIGHT_LASER_CANNON, kind: 'defense', amount: 10 },
            // Research
            { type: ResearchType.SPY_TECHNOLOGY, kind: 'research' },
            { type: ResearchType.LASER_TECHNOLOGY, kind: 'research' },
            // Buildings
            { type: BuildingType.SHIPYARD, kind: 'building' },
            { type: BuildingType.RESEARCH_LAB, kind: 'building' },
            { type: BuildingType.FUSION_REACTOR, kind: 'building' },
            { type: BuildingType.SOLAR_PLANT, kind: 'building' },
            { kind: 'cheapest_mine' }, // Dynamic mine building
            // Storage as fallback to prevent stagnation
            { type: BuildingType.METAL_STORAGE, kind: 'building' },
            { type: BuildingType.CRYSTAL_STORAGE, kind: 'building' },
            { type: BuildingType.DEUTERIUM_TANK, kind: 'building' },
        ],
        [NPCPersonality.ECONOMIC]: [
            { kind: 'cheapest_mine' },
            { type: BuildingType.SOLAR_PLANT, kind: 'building' },
            { type: BuildingType.METAL_STORAGE, kind: 'building' },
            { type: BuildingType.CRYSTAL_STORAGE, kind: 'building' },
            // Ships for transport
            { type: ShipType.SOLAR_SATELLITE, kind: 'ship', amount: 5 },
            { type: ShipType.HEAVY_CARGO_SHIP, kind: 'ship', amount: 1 },
            { type: ShipType.MEDIUM_CARGO_SHIP, kind: 'ship', amount: 2 },
            // Defense
            { type: DefenseType.ROCKET_LAUNCHER, kind: 'defense', amount: 20 },
            { type: DefenseType.LIGHT_LASER_CANNON, kind: 'defense', amount: 10 },
            // Research
            { type: ResearchType.ENERGY_TECHNOLOGY, kind: 'research' },
            { type: BuildingType.RESEARCH_LAB, kind: 'building' },
            { type: BuildingType.SHIPYARD, kind: 'building' },
        ],
        [NPCPersonality.BALANCED]: [
            { kind: 'cheapest_mine' },
            { type: BuildingType.SOLAR_PLANT, kind: 'building' },
            // Ships
            { type: ShipType.SOLAR_SATELLITE, kind: 'ship', amount: 3 },
            { type: ShipType.MEDIUM_FIGHTER, kind: 'ship', amount: 3 },
            { type: ShipType.LIGHT_FIGHTER, kind: 'ship', amount: 5 },
            { type: ShipType.CARGO_SHIP, kind: 'ship', amount: 3 },
            // Defense
            { type: DefenseType.ROCKET_LAUNCHER, kind: 'defense', amount: 10 },
            { type: DefenseType.LIGHT_LASER_CANNON, kind: 'defense', amount: 5 },
            // Research & supporting buildings
            { type: ResearchType.ARMOR_TECHNOLOGY, kind: 'research' },
            { type: ResearchType.COMBUSTION_DRIVE, kind: 'research' },
            { type: ResearchType.WEAPON_TECHNOLOGY, kind: 'research' },
            { type: BuildingType.SHIPYARD, kind: 'building' },
            { type: BuildingType.RESEARCH_LAB, kind: 'building' },
            // Storage as fallback
            { type: BuildingType.METAL_STORAGE, kind: 'building' },
            { type: BuildingType.CRYSTAL_STORAGE, kind: 'building' },
            { type: BuildingType.DEUTERIUM_TANK, kind: 'building' },
        ],
    };

    let updatedNpc = { ...npc, resources: { ...npc.resources } };

    // If threatened, use defensive priorities, otherwise use personality-based ones.
    const prioritiesToUse = isThreatened ? DEFENSIVE_PRIORITIES : buildPriorities[npc.personality];

    // Try to build something up to 5 times per evolution cycle
    for (let i = 0; i < 5; i++) {
        let hasBuilt = false;
        for (const item of prioritiesToUse) {
            let cost: Resources | undefined;

            if (item.kind === 'cheapest_mine') {
                const mineOptions = [
                    BuildingType.METAL_MINE,
                    BuildingType.CRYSTAL_MINE,
                    BuildingType.DEUTERIUM_SYNTHESIZER,
                ].map(mineType => {
                    const level = updatedNpc.buildings[mineType];
                    const mineCost = BUILDING_DATA[mineType].cost(level + 1);
                    return {
                        type: mineType,
                        cost: mineCost,
                        totalCost: mineCost.metal + mineCost.crystal,
                    };
                }).sort((a, b) => a.totalCost - b.totalCost);

                for (const mineOption of mineOptions) {
                    if (canAfford(updatedNpc.resources, mineOption.cost)) {
                        updatedNpc.buildings[mineOption.type]++;
                        cost = mineOption.cost;
                        hasBuilt = true;
                        break; // Build only the cheapest affordable one
                    }
                }
                if (hasBuilt && cost) {
                    updatedNpc.resources.metal -= cost.metal;
                    updatedNpc.resources.crystal -= cost.crystal;
                    updatedNpc.resources.deuterium -= cost.deuterium;
                    break;
                }
                continue; // Move to the next priority if no mine could be built
            }

            let levelOrAmount: number;
            let data;
            let requirementsMet = false;
            let currentCost: Resources | undefined;

            switch(item.kind) {
                case 'building':
                    levelOrAmount = updatedNpc.buildings[item.type as BuildingType] + 1;
                    data = BUILDING_DATA[item.type as BuildingType];
                    requirementsMet = checkNpcRequirements(data.requirements, updatedNpc.buildings, updatedNpc.research);
                    currentCost = data.cost(levelOrAmount);
                    if (requirementsMet && canAfford(updatedNpc.resources, currentCost)) {
                        updatedNpc.buildings[item.type as BuildingType]++;
                        cost = currentCost;
                        hasBuilt = true;
                    }
                    break;
                case 'research':
                     levelOrAmount = updatedNpc.research[item.type as ResearchType] + 1;
                     data = RESEARCH_DATA[item.type as ResearchType];
                     requirementsMet = checkNpcRequirements(data.requirements, updatedNpc.buildings, updatedNpc.research);
                     currentCost = data.cost(levelOrAmount);
                     if (requirementsMet && canAfford(updatedNpc.resources, currentCost)) {
                         updatedNpc.research[item.type as ResearchType]++;
                         cost = currentCost;
                         hasBuilt = true;
                     }
                     break;
                case 'ship':
                    levelOrAmount = item.amount || 1;
                    data = ALL_SHIP_DATA[item.type as ShipType];
                    if (data) {
                        requirementsMet = checkNpcRequirements(data.requirements, updatedNpc.buildings, updatedNpc.research);
                        currentCost = data.cost(1);
                        if (currentCost) {
                            const totalCost: Resources = { metal: currentCost.metal * levelOrAmount, crystal: currentCost.crystal * levelOrAmount, deuterium: currentCost.deuterium * levelOrAmount, energy: 0 };
                            if (requirementsMet && canAfford(updatedNpc.resources, totalCost)) {
                                updatedNpc.fleet[item.type as ShipType] = (updatedNpc.fleet[item.type as ShipType] || 0) + levelOrAmount;
                                cost = totalCost;
                                hasBuilt = true;
                            }
                        }
                    }
                    break;
                case 'defense':
                    levelOrAmount = item.amount || 1;
                    data = DEFENSE_DATA[item.type as DefenseType];
                    if (data) {
                        requirementsMet = checkNpcRequirements(data.requirements, updatedNpc.buildings, updatedNpc.research);
                        currentCost = data.cost(1);
                         if (currentCost) {
                            const totalDefenseCost: Resources = { metal: currentCost.metal * levelOrAmount, crystal: currentCost.crystal * levelOrAmount, deuterium: currentCost.deuterium * levelOrAmount, energy: 0 };
                            if (requirementsMet && canAfford(updatedNpc.resources, totalDefenseCost)) {
                                updatedNpc.defenses[item.type as DefenseType] = (updatedNpc.defenses[item.type as DefenseType] || 0) + levelOrAmount;
                                cost = totalDefenseCost;
                                hasBuilt = true;
                            }
                        }
                    }
                    break;
            }
            
            if (hasBuilt && cost) {
                updatedNpc.resources.metal -= cost.metal;
                updatedNpc.resources.crystal -= cost.crystal;
                updatedNpc.resources.deuterium -= cost.deuterium;
                break; // Exit after one successful build per loop iteration
            }
        }
        if (!hasBuilt) break; // If nothing could be built, stop trying
    }

    return updatedNpc;
}

const missionDecisionAI = (npc: NPCState, sourceCoords: string): NPCFleetMission | null => {
     const militaryPower = Object.entries(npc.fleet).reduce((power, [shipId, count]) => {
        const shipData = ALL_SHIP_DATA[shipId as ShipType];
        if (shipData && count) {
            const finalAttack = shipData.attack * (1 + (npc.research[ResearchType.WEAPON_TECHNOLOGY] || 0) * 0.1);
            const finalShield = shipData.shield * (1 + (npc.research[ResearchType.SHIELDING_TECHNOLOGY] || 0) * 0.1);
            const finalIntegrity = shipData.structuralIntegrity * (1 + (npc.research[ResearchType.ARMOR_TECHNOLOGY] || 0) * 0.1);
            return power + (finalAttack + finalShield + finalIntegrity / 10) * count;
        }
        return power;
    }, 0);

    // Aggressive NPCs are more likely to act
    if (npc.personality === NPCPersonality.AGGRESSIVE && militaryPower > 15000) {
        // 5% chance to attack
        if (Math.random() < 0.05) {
            const attackingFleet: Partial<Fleet> = {};

            const bcToSend = Math.floor((npc.fleet[ShipType.BATTLECRUISER] || 0) * 0.5);
            if (bcToSend > 0) attackingFleet[ShipType.BATTLECRUISER] = bcToSend;

            const destToSend = Math.floor((npc.fleet[ShipType.DESTROYER] || 0) * 0.5);
            if (destToSend > 0) attackingFleet[ShipType.DESTROYER] = destToSend;

            const bsToSend = Math.floor((npc.fleet[ShipType.BATTLESHIP] || 0) * 0.5);
            if (bsToSend > 0) attackingFleet[ShipType.BATTLESHIP] = bsToSend;

            const crToSend = Math.floor((npc.fleet[ShipType.CRUISER] || 0) * 0.5);
            if (crToSend > 0) attackingFleet[ShipType.CRUISER] = crToSend;
            
            const hfToSend = Math.floor((npc.fleet[ShipType.HEAVY_FIGHTER] || 0) * 0.5);
            if (hfToSend > 0) attackingFleet[ShipType.HEAVY_FIGHTER] = hfToSend;
            
            const mfToSend = Math.floor((npc.fleet[ShipType.MEDIUM_FIGHTER] || 0) * 0.5);
            if (mfToSend > 0) attackingFleet[ShipType.MEDIUM_FIGHTER] = mfToSend;
            
            const lfToSend = Math.floor((npc.fleet[ShipType.LIGHT_FIGHTER] || 0) * 0.5);
            if (lfToSend > 0) attackingFleet[ShipType.LIGHT_FIGHTER] = lfToSend;
            
            const cargoToSend = Math.floor((npc.fleet[ShipType.CARGO_SHIP] || 0) * 0.5);
            if (cargoToSend > 0) attackingFleet[ShipType.CARGO_SHIP] = cargoToSend;


            if (Object.values(attackingFleet).some(count => count && count > 0)) {
                const now = Date.now();
                const missionDuration = 30 * 60 * 1000; // 30 minutes for simplicity

                return {
                    id: `npc-m-${now}-${Math.random()}`,
                    sourceCoords,
                    fleet: attackingFleet as Fleet,
                    missionType: MissionType.ATTACK,
                    startTime: now,
                    arrivalTime: now + missionDuration
                };
            }
        } 
        // 10% chance to spy
        else if (Math.random() < 0.1) {
             const hasProbes = (npc.research[ResearchType.SPY_TECHNOLOGY] || 0) > 0 && (npc.fleet[ShipType.SPY_PROBE] || 0) > 0;
             if (hasProbes) {
                const now = Date.now();
                const missionDuration = 5 * 60 * 1000; // 5 minutes for spy
                 return {
                    id: `npc-m-${now}-${Math.random()}`,
                    sourceCoords,
                    fleet: { [ShipType.SPY_PROBE]: 1 },
                    missionType: MissionType.SPY,
                    startTime: now,
                    arrivalTime: now + missionDuration
                };
             }
        }
    }
    return null;
}


export const evolveNpc = (npc: NPCState, offlineSeconds: number, coords: string, isThreatened: boolean): { updatedNpc: NPCState, mission: NPCFleetMission | null } => {
    let evolvedNpc = {
        ...npc,
        resources: { ...npc.resources },
        buildings: { ...npc.buildings },
        research: { ...npc.research },
        fleet: { ...npc.fleet },
        defenses: { ...npc.defenses },
    };

    // 1. Resource Production
    const productions = calculateNpcProductions(evolvedNpc);
    const maxResources = calculateNpcMaxResources(evolvedNpc.buildings);

    evolvedNpc.resources.metal = Math.min(maxResources.metal, evolvedNpc.resources.metal + (productions.metal / 3600) * offlineSeconds);
    evolvedNpc.resources.crystal = Math.min(maxResources.crystal, evolvedNpc.resources.crystal + (productions.crystal / 3600) * offlineSeconds);
    evolvedNpc.resources.deuterium = Math.min(maxResources.deuterium, evolvedNpc.resources.deuterium + (productions.deuterium / 3600) * offlineSeconds);

    // 2. AI spending resources
    evolvedNpc = spendResourcesAI(evolvedNpc, isThreatened);

    // 3. AI deciding to launch a mission
    const mission = missionDecisionAI(evolvedNpc, coords);

    // 4. Update timestamp
    evolvedNpc.lastUpdateTime = Date.now();

    return { updatedNpc: evolvedNpc, mission };
};


export const regenerateNpcFromSleeper = (sleeper: SleeperNpcState): NPCState => {
    let pointBudget = sleeper.points;
    const regeneratedNpc: NPCState = {
        ...(JSON.parse(JSON.stringify(INITIAL_NPC_STATE))),
        name: sleeper.name,
        image: sleeper.image,
        personality: sleeper.personality,
        developmentSpeed: sleeper.developmentSpeed,
        resources: { ...INITIAL_NPC_STATE.resources, ...(sleeper.resources ?? {}) },
        buildings: { ...INITIAL_BUILDING_LEVELS },
        research: { ...INITIAL_RESEARCH_LEVELS },
        fleet: {} as Fleet,
        defenses: {} as Defenses,
        lastUpdateTime: sleeper.lastUpdate,
    };

    const buildPriorities = {
        // Build priorities adapted for point-based regeneration
        [NPCPersonality.AGGRESSIVE]: [
            { id: ResearchType.WEAPON_TECHNOLOGY, kind: 'research' },
            { id: BuildingType.METAL_MINE, kind: 'building' },
            { id: BuildingType.SHIPYARD, kind: 'building' },
            { id: ResearchType.ARMOR_TECHNOLOGY, kind: 'research' },
            { id: ShipType.LIGHT_FIGHTER, kind: 'ship', pointsPerUnit: costToPoints(ALL_SHIP_DATA[ShipType.LIGHT_FIGHTER].cost(1)) },
            { id: ShipType.HEAVY_FIGHTER, kind: 'ship', pointsPerUnit: costToPoints(ALL_SHIP_DATA[ShipType.HEAVY_FIGHTER].cost(1)) },
            { id: DefenseType.ROCKET_LAUNCHER, kind: 'defense', pointsPerUnit: costToPoints(DEFENSE_DATA[DefenseType.ROCKET_LAUNCHER].cost(1)) },
        ],
        [NPCPersonality.ECONOMIC]: [
            { id: BuildingType.METAL_MINE, kind: 'building' },
            { id: BuildingType.CRYSTAL_MINE, kind: 'building' },
            { id: BuildingType.SOLAR_PLANT, kind: 'building' },
            { id: ResearchType.ENERGY_TECHNOLOGY, kind: 'research' },
            { id: ShipType.CARGO_SHIP, kind: 'ship', pointsPerUnit: costToPoints(ALL_SHIP_DATA[ShipType.CARGO_SHIP].cost(1)) },
        ],
        [NPCPersonality.BALANCED]: [
            { id: BuildingType.METAL_MINE, kind: 'building' },
            { id: BuildingType.SOLAR_PLANT, kind: 'building' },
            { id: ResearchType.ARMOR_TECHNOLOGY, kind: 'research' },
            { id: ShipType.LIGHT_FIGHTER, kind: 'ship', pointsPerUnit: costToPoints(ALL_SHIP_DATA[ShipType.LIGHT_FIGHTER].cost(1)) },
            { id: DefenseType.ROCKET_LAUNCHER, kind: 'defense', pointsPerUnit: costToPoints(DEFENSE_DATA[DefenseType.ROCKET_LAUNCHER].cost(1)) },
        ],
    };
    
    // Spend points to rebuild structure
    while (pointBudget > 5) { // 5 is arbitrary threshold to stop
        let somethingWasBuilt = false;
        for (const item of buildPriorities[sleeper.personality]) {
            let itemCostPoints = 0;
            const data = ALL_GAME_OBJECTS[item.id as keyof typeof ALL_GAME_OBJECTS];
            if (!checkNpcRequirements(data.requirements, regeneratedNpc.buildings, regeneratedNpc.research)) {
                continue;
            }

            if (item.kind === 'building') {
                const nextLevel = regeneratedNpc.buildings[item.id as BuildingType] + 1;
                itemCostPoints = costToPoints(BUILDING_DATA[item.id as BuildingType].cost(nextLevel));
                if (pointBudget >= itemCostPoints) {
                    regeneratedNpc.buildings[item.id as BuildingType]++;
                    pointBudget -= itemCostPoints;
                    somethingWasBuilt = true;
                }
            } else if (item.kind === 'research') {
                const nextLevel = regeneratedNpc.research[item.id as ResearchType] + 1;
                itemCostPoints = costToPoints(RESEARCH_DATA[item.id as ResearchType].cost(nextLevel));
                if (pointBudget >= itemCostPoints) {
                    regeneratedNpc.research[item.id as ResearchType]++;
                    pointBudget -= itemCostPoints;
                    somethingWasBuilt = true;
                }
            } else if (item.kind === 'ship') {
                itemCostPoints = item.pointsPerUnit || 1;
                if (pointBudget >= itemCostPoints) {
                    const amountToBuild = Math.max(1, Math.floor(pointBudget / (itemCostPoints * 10))); // build in chunks
                    const totalCost = itemCostPoints * amountToBuild;
                    if(pointBudget >= totalCost){
                        regeneratedNpc.fleet[item.id as ShipType] = (regeneratedNpc.fleet[item.id as ShipType] || 0) + amountToBuild;
                        pointBudget -= totalCost;
                        somethingWasBuilt = true;
                    }
                }
            } else if (item.kind === 'defense') {
                 itemCostPoints = item.pointsPerUnit || 1;
                 if (pointBudget >= itemCostPoints) {
                    const amountToBuild = Math.max(1, Math.floor(pointBudget / (itemCostPoints * 10)));
                    const totalCost = itemCostPoints * amountToBuild;
                     if(pointBudget >= totalCost){
                        regeneratedNpc.defenses[item.id as DefenseType] = (regeneratedNpc.defenses[item.id as DefenseType] || 0) + amountToBuild;
                        pointBudget -= totalCost;
                        somethingWasBuilt = true;
                    }
                }
            }
        }
        if (!somethingWasBuilt) break; // Exit if no affordable upgrades found
    }
    
    // Now that the structure is rebuilt, calculate production during sleep
    const offlineSeconds = (Date.now() - sleeper.lastUpdate) / 1000;
    if (offlineSeconds > 0) {
        const productions = calculateNpcProductions(regeneratedNpc);
        const maxResources = calculateNpcMaxResources(regeneratedNpc.buildings);

        regeneratedNpc.resources.metal = Math.min(maxResources.metal, (regeneratedNpc.resources.metal || 0) + (productions.metal / 3600) * offlineSeconds);
        regeneratedNpc.resources.crystal = Math.min(maxResources.crystal, (regeneratedNpc.resources.crystal || 0) + (productions.crystal / 3600) * offlineSeconds);
        regeneratedNpc.resources.deuterium = Math.min(maxResources.deuterium, (regeneratedNpc.resources.deuterium || 0) + (productions.deuterium / 3600) * offlineSeconds);
    }

    // Set final update time to now, as it's now active
    regeneratedNpc.lastUpdateTime = Date.now();
    
    return regeneratedNpc;
};
