import { NPCState, BuildingType, Resources, BuildingLevels, ResearchLevels, ResearchType, NPCPersonality, ShipType, DefenseType, NPCFleetMission, MissionType, Fleet, SleeperNpcState } from '../types';
import { BUILDING_DATA, BASE_STORAGE_CAPACITY, RESEARCH_DATA, ALL_SHIP_DATA, DEFENSE_DATA, ALL_GAME_OBJECTS, INITIAL_NPC_STATE, INITIAL_BUILDING_LEVELS, INITIAL_RESEARCH_LEVELS, NPC_NAMES, NPC_IMAGES } from '../constants';

export const generateNewNpc = (): NPCState => {
    const personalityValues = Object.values(NPCPersonality);
    const personality = personalityValues[Math.floor(Math.random() * personalityValues.length)];
    const name = NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)];
    const image = NPC_IMAGES[Math.floor(Math.random() * NPC_IMAGES.length)];
    const developmentSpeed = 0.8 + Math.random() * 0.7;

    return {
        ...INITIAL_NPC_STATE,
        personality,
        name,
        image,
        developmentSpeed,
        lastUpdateTime: Date.now(),
    };
};

const calculateNpcProductions = (npc: NPCState) => {
    const { buildings, fleet, developmentSpeed = 1.0 } = npc;
    let energyProduction = BUILDING_DATA[BuildingType.SOLAR_PLANT].production?.(buildings[BuildingType.SOLAR_PLANT]) ?? 0;
    energyProduction += BUILDING_DATA[BuildingType.FUSION_REACTOR].production?.(buildings[BuildingType.FUSION_REACTOR]) ?? 0;
    const satelliteData = ALL_SHIP_DATA[ShipType.SOLAR_SATELLITE];
    energyProduction += (fleet[ShipType.SOLAR_SATELLITE] || 0) * (satelliteData.energyProduction || 0);
    
    const energyConsumption = (Object.keys(buildings) as BuildingType[]).reduce((total, type) => {
        const buildingInfo = BUILDING_DATA[type];
        if (type !== BuildingType.FUSION_REACTOR && buildings[type] > 0) {
           return total + (buildingInfo.energyConsumption?.(buildings[type]) ?? 0);
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


const spendResourcesAI = (npc: NPCState, isThreatened: boolean): NPCState => {
    type BuildItem = { type?: BuildingType | ResearchType | ShipType | DefenseType; kind: 'building' | 'research' | 'ship' | 'defense' | 'cheapest_mine'; amount?: number };

    const DEFENSIVE_PRIORITIES: BuildItem[] = [
        { type: DefenseType.PLASMA_TURRET, kind: 'defense', amount: 2 },
        { type: DefenseType.ION_CANNON, kind: 'defense', amount: 5 },
        { type: ShipType.DESTROYER, kind: 'ship', amount: 1 },
        { type: BuildingType.SHIPYARD, kind: 'building' },
        { kind: 'cheapest_mine' },
    ];

    const buildPriorities: Record<NPCPersonality, BuildItem[]> = {
        [NPCPersonality.AGGRESSIVE]: [
            { type: ShipType.BATTLECRUISER, kind: 'ship', amount: 1 },
            { type: ResearchType.WEAPON_TECHNOLOGY, kind: 'research' },
            { type: BuildingType.SHIPYARD, kind: 'building' },
            { kind: 'cheapest_mine' },
        ],
        [NPCPersonality.ECONOMIC]: [
            { kind: 'cheapest_mine' },
            { type: BuildingType.SOLAR_PLANT, kind: 'building' },
            { type: ShipType.CARGO_SHIP, kind: 'ship', amount: 2 },
        ],
        [NPCPersonality.BALANCED]: [
            { kind: 'cheapest_mine' },
            { type: ShipType.LIGHT_FIGHTER, kind: 'ship', amount: 5 },
            { type: DefenseType.ROCKET_LAUNCHER, kind: 'defense', amount: 10 },
        ],
    };

    let updatedNpc = { ...npc, resources: { ...npc.resources } };
    const prioritiesToUse = isThreatened ? DEFENSIVE_PRIORITIES : buildPriorities[npc.personality];

    for (let i = 0; i < 5; i++) {
        let hasBuilt = false;
        for (const item of prioritiesToUse) {
             let cost: Resources | undefined;
            if(item.type && (item.kind === 'building' || item.kind === 'research' || item.kind === 'ship' || item.kind === 'defense')) {
                // Simplified build logic for brevity
                const data = ALL_GAME_OBJECTS[item.type];
                const currentCost = data.cost(1);
                if (checkNpcRequirements(data.requirements, updatedNpc.buildings, updatedNpc.research) && canAfford(updatedNpc.resources, currentCost)) {
                    cost = currentCost;
                    hasBuilt = true;
                }
            }

            if (hasBuilt && cost) {
                updatedNpc.resources.metal -= cost.metal;
                updatedNpc.resources.crystal -= cost.crystal;
                updatedNpc.resources.deuterium -= cost.deuterium;
                break;
            }
        }
        if (!hasBuilt) break;
    }

    return updatedNpc;
}

const missionDecisionAI = (npc: NPCState, sourceCoords: string): { mission: NPCFleetMission | null, updatedFleet: Fleet } => {
     const militaryPower = Object.values(npc.fleet).reduce((sum, count) => sum + (count || 0), 0);
     const updatedFleet = { ...npc.fleet };
    
    if (npc.personality === NPCPersonality.AGGRESSIVE && militaryPower > 100) {
        if (Math.random() < 0.05) {
            const attackingFleet: Fleet = {};
            const shipType = Object.keys(npc.fleet)[0] as ShipType;
            if(shipType){
                attackingFleet[shipType] = 1;
                updatedFleet[shipType] = (updatedFleet[shipType] || 0) - 1;
                 const now = Date.now();
                const mission = {
                    id: `npc-m-${now}-${Math.random()}`,
                    sourceCoords, fleet: attackingFleet,
                    missionType: MissionType.ATTACK,
                    startTime: now,
                    arrivalTime: now + 30 * 60 * 1000
                };
                 return { mission, updatedFleet };
            }
        } 
    }
    return { mission: null, updatedFleet };
}


export const evolveNpc = (npc: NPCState, offlineSeconds: number, coords: string, isThreatened: boolean): { updatedNpc: NPCState, mission: NPCFleetMission | null } => {
    let evolvedNpc = { ...npc, resources: { ...npc.resources }, fleet: { ...npc.fleet } };

    const productions = calculateNpcProductions(evolvedNpc);
    const maxResources = calculateNpcMaxResources(evolvedNpc.buildings);

    evolvedNpc.resources.metal = Math.min(maxResources.metal, evolvedNpc.resources.metal + (productions.metal / 3600) * offlineSeconds);
    evolvedNpc.resources.crystal = Math.min(maxResources.crystal, evolvedNpc.resources.crystal + (productions.crystal / 3600) * offlineSeconds);
    evolvedNpc.resources.deuterium = Math.min(maxResources.deuterium, evolvedNpc.resources.deuterium + (productions.deuterium / 3600) * offlineSeconds);

    evolvedNpc = spendResourcesAI(evolvedNpc, isThreatened);

    const { mission, updatedFleet } = missionDecisionAI(evolvedNpc, coords);
    evolvedNpc.fleet = updatedFleet;
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
        resources: sleeper.resources ? { ...INITIAL_NPC_STATE.resources, ...sleeper.resources } : { ...INITIAL_NPC_STATE.resources },
        buildings: { ...INITIAL_BUILDING_LEVELS },
        research: { ...INITIAL_RESEARCH_LEVELS },
        fleet: {},
        defenses: {},
        lastUpdateTime: sleeper.lastUpdate,
    };
    
    // Simplified regeneration logic for brevity
    if (pointBudget > 1000) {
        regeneratedNpc.buildings[BuildingType.METAL_MINE] = 5;
    }

    const offlineSeconds = (Date.now() - sleeper.lastUpdate) / 1000;
    if (offlineSeconds > 0) {
        const productions = calculateNpcProductions(regeneratedNpc);
        const maxResources = calculateNpcMaxResources(regeneratedNpc.buildings);
        regeneratedNpc.resources.metal = Math.min(maxResources.metal, (regeneratedNpc.resources.metal || 0) + (productions.metal / 3600) * offlineSeconds);
        regeneratedNpc.resources.crystal = Math.min(maxResources.crystal, (regeneratedNpc.resources.crystal || 0) + (productions.crystal / 3600) * offlineSeconds);
        regeneratedNpc.resources.deuterium = Math.min(maxResources.deuterium, (regeneratedNpc.resources.deuterium || 0) + (productions.deuterium / 3600) * offlineSeconds);
    }

    regeneratedNpc.lastUpdateTime = Date.now();
    
    return regeneratedNpc;
};