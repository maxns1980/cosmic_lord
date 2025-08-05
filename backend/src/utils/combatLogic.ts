import { Fleet, Defenses, ResearchLevels, Resources, ShipType, DefenseType, ResearchType, Loot, BuildingLevels, BuildingType, RoundReport, ShipLevels, CombatParty, SolarFlareStatus } from '../types.js';
import { ALL_SHIP_DATA, DEFENSE_DATA, DEBRIS_FIELD_RECOVERY_RATE, PROTECTED_RESOURCES_FACTOR, BUILDING_DATA, BASE_STORAGE_CAPACITY } from '../constants.js';

// The combat logic has been refactored to use a "health pool" (HP pool) model for each group of units.
// This solves a critical flaw in the previous per-unit simulation where damage against a large number of weak units
// would be spread too thinly, resulting in no units being destroyed and causing incorrect "draw" outcomes.
// In this model, all units of the same type act as a single entity with a combined shield and hull pool.
// Damage from incoming shots is applied to the pool, destroying units sequentially as enough damage accumulates.
// This correctly concentrates fire and produces more realistic and expected combat results.

type CombatGroup = {
    id: ShipType | DefenseType;
    type: 'ship' | 'defense';
    initialCount: number;
    count: number;
    attack: number;
    shield: number; // per unit
    hull: number; // per unit
    currentTotalShield: number;
    currentTotalHull: number;
    rapidFireAgainst?: Record<string, number>;
};

export type CombatResult = {
    winner: 'attacker' | 'defender' | 'draw';
    attackerLosses: Partial<Fleet>;
    defenderLosses: Partial<Fleet>;
    defenderDefensesLosses: Partial<Defenses>;
    loot: Loot;
    debrisCreated: Pick<Resources, 'metal' | 'crystal'>;
    finalDefenderFleet: Fleet;
    finalDefenderDefenses: Defenses;
    rounds: RoundReport[];
};

const getRapidFireBonus = (unitId: ShipType | DefenseType): Record<string, number> => {
    const rapidFireData: Partial<Record<ShipType, Record<string, number>>> = {
        [ShipType.CRUISER]: { [ShipType.LIGHT_FIGHTER]: 6, [DefenseType.ROCKET_LAUNCHER]: 10, [ShipType.SOLAR_SATELLITE]: 10 },
        [ShipType.BOMBER]: { 
            [DefenseType.LIGHT_LASER_CANNON]: 10,
            [DefenseType.HEAVY_LASER_CANNON]: 10,
            [DefenseType.ION_CANNON]: 10,
            [DefenseType.PLASMA_TURRET]: 10,
        },
        [ShipType.BATTLESHIP]: { [ShipType.BATTLECRUISER]: 2 },
        [ShipType.DEATHSTAR]: {
             ...(Object.values(ShipType).reduce((acc, val) => { acc[val] = 250; return acc; }, {} as Record<string, number>)),
             ...(Object.values(DefenseType).reduce((acc, val) => { acc[val] = 250; return acc; }, {} as Record<string, number>)),
        }
    };
    return rapidFireData[unitId as ShipType] || {};
};

const createCombatGroups = (party: CombatParty): CombatGroup[] => {
    const groups: CombatGroup[] = [];
    const armorTech = party.research[ResearchType.ARMOR_TECHNOLOGY] || 0;
    const shieldTech = party.research[ResearchType.SHIELDING_TECHNOLOGY] || 0;
    const weaponTech = party.research[ResearchType.WEAPON_TECHNOLOGY] || 0;
    const isDisruptionActive = party.solarFlare?.status === SolarFlareStatus.DISRUPTION;
    
    for (const shipId in party.fleet) {
        const count = party.fleet[shipId as ShipType];
        if (!count || count <= 0) continue;
        const data = ALL_SHIP_DATA[shipId as ShipType];
        const upgradeLevel = party.shipLevels?.[shipId as ShipType] || 0;

        const shield = isDisruptionActive ? 0 : data.shield * (1 + shieldTech * 0.1) * (1 + upgradeLevel * 0.1);
        const hull = data.structuralIntegrity * (1 + armorTech * 0.1) * (1 + upgradeLevel * 0.1);
        const attack = data.attack * (1 + weaponTech * 0.1) * (1 + upgradeLevel * 0.1);

        groups.push({
            id: shipId as ShipType,
            type: 'ship',
            initialCount: count,
            count: count,
            attack: attack,
            shield: shield,
            hull: hull,
            currentTotalShield: shield * count,
            currentTotalHull: hull * count,
            rapidFireAgainst: getRapidFireBonus(shipId as ShipType),
        });
    }

    if (party.defenses) {
        for (const defenseId in party.defenses) {
            const count = party.defenses[defenseId as DefenseType];
            if (!count || count <= 0) continue;
            const data = DEFENSE_DATA[defenseId as DefenseType];
            const shield = isDisruptionActive ? 0 : data.shield * (1 + shieldTech * 0.1);
            const hull = data.structuralIntegrity * (1 + armorTech * 0.1);
            groups.push({
                id: defenseId as DefenseType,
                type: 'defense',
                initialCount: count,
                count: count,
                attack: data.attack * (1 + weaponTech * 0.1),
                shield: shield,
                hull: hull,
                currentTotalShield: shield * count,
                currentTotalHull: hull * count,
                rapidFireAgainst: getRapidFireBonus(defenseId as DefenseType),
            });
        }
    }
    
    return groups;
};

const applyGroupDamage = (group: CombatGroup, damage: number) => {
    if (group.count <= 0 || damage <= 0) return;

    // A single shot can at most destroy one unit's shields before hitting hull.
    // This prevents a massive shot from being entirely absorbed by the shield pool.
    const damageAbsorbedByShield = Math.min(group.shield, damage);
    const damageToHull = damage - damageAbsorbedByShield;

    // Reduce from the total shield pool
    group.currentTotalShield = Math.max(0, group.currentTotalShield - damageAbsorbedByShield);

    if (damageToHull > 0) {
        group.currentTotalHull -= damageToHull;
        if (group.currentTotalHull <= 0) {
            group.count = 0;
        } else {
            // Recalculate count based on remaining hull pool
            const survivingUnits = Math.ceil(group.currentTotalHull / group.hull);
            if (survivingUnits < group.count) {
                group.count = survivingUnits;
            }
        }
    }
};

const fireOnGroups = (firingGroups: CombatGroup[], targetGroups: CombatGroup[]) => {
    firingGroups.forEach(firingGroup => {
        if (firingGroup.count <= 0) return;
        
        // Each unit in the group gets to fire.
        for (let i = 0; i < firingGroup.initialCount; i++) {
            let keepFiring = true;
            while (keepFiring) {
                const availableTargetGroups = targetGroups.filter(g => g.count > 0);
                if (availableTargetGroups.length === 0) {
                    keepFiring = false;
                    break;
                }

                const targetGroupIndex = Math.floor(Math.random() * availableTargetGroups.length);
                const targetGroup = availableTargetGroups[targetGroupIndex];

                applyGroupDamage(targetGroup, firingGroup.attack);
                
                const rapidFireBonus = firingGroup.rapidFireAgainst?.[targetGroup.id];
                if (rapidFireBonus && rapidFireBonus > 1) {
                    keepFiring = Math.random() < (rapidFireBonus - 1) / rapidFireBonus;
                } else {
                    keepFiring = false;
                }
            }
        }
    });
};

const groupsToFleetDefenses = (groups: CombatGroup[]): { fleet: Fleet, defenses: Defenses } => {
    const result: { fleet: Fleet, defenses: Defenses } = { fleet: {}, defenses: {} };
    groups.forEach(group => {
        if (group.count > 0) {
            if (group.type === 'ship') {
                result.fleet[group.id as ShipType] = group.count;
            } else {
                result.defenses[group.id as DefenseType] = group.count;
            }
        }
    });
    return result;
};


export const calculateCombat = (
    attacker: CombatParty, 
    defender: CombatParty, 
    defenderResources: Resources,
    defenderBuildings: BuildingLevels
): CombatResult => {
    let attackerGroups = createCombatGroups(attacker);
    let defenderGroups = createCombatGroups(defender);
    const rounds: RoundReport[] = [];

    const MAX_ROUNDS = 6;

    for (let round = 1; round <= MAX_ROUNDS; round++) {
        const attackerUnitCount = attackerGroups.reduce((sum, g) => sum + g.count, 0);
        const defenderUnitCount = defenderGroups.reduce((sum, g) => sum + g.count, 0);
        if (attackerUnitCount === 0 || defenderUnitCount === 0) break;

        // Store state before combat this round
        const attackerStateBefore = groupsToFleetDefenses(attackerGroups);
        const defenderStateBefore = groupsToFleetDefenses(defenderGroups);
        const attackerTotalAttackPower = attackerGroups.reduce((sum, g) => sum + (g.attack * g.count), 0);
        const defenderTotalAttackPower = defenderGroups.reduce((sum, g) => sum + (g.attack * g.count), 0);
        const attackerTotalShieldPower = attackerGroups.reduce((sum, g) => sum + g.currentTotalShield, 0);
        const defenderTotalShieldPower = defenderGroups.reduce((sum, g) => sum + g.currentTotalShield, 0);

        fireOnGroups(attackerGroups, defenderGroups);
        fireOnGroups(defenderGroups, attackerGroups);

        const attackerStateAfter = groupsToFleetDefenses(attackerGroups);
        const defenderStateAfter = groupsToFleetDefenses(defenderGroups);

        const attackerLossesThisRound: Partial<Fleet> = {};
        for(const shipId in attackerStateBefore.fleet) {
            const initial = attackerStateBefore.fleet[shipId as ShipType] || 0;
            const final = attackerStateAfter.fleet[shipId as ShipType] || 0;
            if(initial > final) attackerLossesThisRound[shipId as ShipType] = initial - final;
        }

        const defenderLossesThisRound: Partial<Fleet> = {};
        for(const shipId in defenderStateBefore.fleet) {
            const initial = defenderStateBefore.fleet[shipId as ShipType] || 0;
            const final = defenderStateAfter.fleet[shipId as ShipType] || 0;
            if(initial > final) defenderLossesThisRound[shipId as ShipType] = initial - final;
        }
        
        const defenderDefenseLossesThisRound: Partial<Defenses> = {};
        for(const defId in defenderStateBefore.defenses) {
            const initial = defenderStateBefore.defenses[defId as DefenseType] || 0;
            const final = defenderStateAfter.defenses[defId as DefenseType] || 0;
            if(initial > final) defenderDefenseLossesThisRound[defId as DefenseType] = initial - final;
        }

        rounds.push({
            roundNumber: round,
            attackerFleetState: attackerStateBefore.fleet,
            defenderFleetState: defenderStateBefore.fleet,
            defenderDefenseState: defenderStateBefore.defenses,
            attackerTotalAttackPower,
            defenderTotalAttackPower,
            attackerTotalShieldPower,
            defenderTotalShieldPower,
            attackerLossesThisRound,
            defenderLossesThisRound,
            defenderDefenseLossesThisRound,
        });

        // Regenerate shields for surviving units
        attackerGroups.forEach(g => g.currentTotalShield = g.count * g.shield);
        defenderGroups.forEach(g => g.currentTotalShield = g.count * g.shield);
        // Update initialCount for next round's firing phase
        attackerGroups.forEach(g => g.initialCount = g.count);
        defenderGroups.forEach(g => g.initialCount = g.count);
    }
    
    let winner: 'attacker' | 'defender' | 'draw';
    const attackerHasFleet = attackerGroups.some(g => g.type === 'ship' && g.count > 0);
    const defenderHasUnits = defenderGroups.some(g => g.count > 0);

    if (attackerHasFleet && !defenderHasUnits) {
        winner = 'attacker';
    } else if (!attackerHasFleet && defenderHasUnits) {
        winner = 'defender';
    } else if (!attackerHasFleet && !defenderHasUnits) {
        winner = 'draw';
    } else {
        winner = 'draw';
    }
    
    const { fleet: finalAttackerFleet } = groupsToFleetDefenses(attackerGroups.filter(g => g.type === 'ship'));
    const { fleet: finalDefenderFleet, defenses: finalDefenderDefenses } = groupsToFleetDefenses(defenderGroups);
    
    const attackerLosses: Partial<Fleet> = {};
    Object.keys(attacker.fleet).forEach(shipId => {
        const initialCount = attacker.fleet[shipId as ShipType] || 0;
        const finalCount = finalAttackerFleet[shipId as ShipType] || 0;
        if (initialCount > finalCount) {
             attackerLosses[shipId as ShipType] = initialCount - finalCount;
        }
    });

    const defenderLosses: Partial<Fleet> = {};
    Object.keys(defender.fleet).forEach(shipId => {
        const initialCount = defender.fleet[shipId as ShipType] || 0;
        const finalCount = finalDefenderFleet[shipId as ShipType] || 0;
        if (initialCount > finalCount) {
             defenderLosses[shipId as ShipType] = initialCount - finalCount;
        }
    });
    
    const defenderDefensesLosses: Partial<Defenses> = {};
     Object.keys(defender.defenses || {}).forEach(defenseId => {
        const initialCount = defender.defenses?.[defenseId as DefenseType] || 0;
        const finalCount = finalDefenderDefenses[defenseId as DefenseType] || 0;
        if (initialCount > finalCount) {
             defenderDefensesLosses[defenseId as DefenseType] = initialCount - finalCount;
        }
    });
    
    const debris: Pick<Resources, 'metal' | 'crystal'> = { metal: 0, crystal: 0 };
    const allShipLosses = [
        ...Object.entries(attackerLosses),
        ...Object.entries(defenderLosses)
    ];

    allShipLosses.forEach(([id, count]) => {
        const data = ALL_SHIP_DATA[id as ShipType];
        if (data && count) {
            const cost = data.cost(1);
            debris.metal += cost.metal * count * DEBRIS_FIELD_RECOVERY_RATE;
            debris.crystal += cost.crystal * count * DEBRIS_FIELD_RECOVERY_RATE;
        }
    });
    
    const loot: Loot = { metal: 0, crystal: 0, deuterium: 0 };
    if (winner === 'attacker') {
        let cargoCapacity = attackerGroups.reduce((sum, group) => {
            if (group.type === 'ship' && group.count > 0) {
                const data = ALL_SHIP_DATA[group.id as ShipType];
                let shipCargo = data?.cargoCapacity || 0;

                const isTransport = [
                    ShipType.CARGO_SHIP,
                    ShipType.MEDIUM_CARGO_SHIP,
                    ShipType.HEAVY_CARGO_SHIP,
                    ShipType.RECYCLER,
                    ShipType.COLONY_SHIP,
                    ShipType.RESEARCH_VESSEL
                ].includes(group.id as ShipType);

                if (isTransport && attacker.shipLevels) {
                    const level = attacker.shipLevels[group.id as ShipType] || 0;
                    shipCargo *= (1 + level * 0.1);
                }
                return sum + shipCargo * group.count;
            }
            return sum;
        }, 0);

        const metalStorageLevel = defenderBuildings[BuildingType.METAL_STORAGE] || 0;
        const crystalStorageLevel = defenderBuildings[BuildingType.CRYSTAL_STORAGE] || 0;
        const deuteriumTankLevel = defenderBuildings[BuildingType.DEUTERIUM_TANK] || 0;
        
        const getCapacity = (type: BuildingType, level: number) => BUILDING_DATA[type].capacity?.(level) || BASE_STORAGE_CAPACITY;
        
        const metalCapacity = getCapacity(BuildingType.METAL_STORAGE, metalStorageLevel);
        const crystalCapacity = getCapacity(BuildingType.CRYSTAL_STORAGE, crystalStorageLevel);
        const deuteriumCapacity = getCapacity(BuildingType.DEUTERIUM_TANK, deuteriumTankLevel);
        
        const protectionFactor = PROTECTED_RESOURCES_FACTOR;
        const protectedMetal = metalCapacity * protectionFactor;
        const protectedCrystal = crystalCapacity * protectionFactor;
        const protectedDeuterium = deuteriumCapacity * protectionFactor;

        const lootableMetal = Math.max(0, (defenderResources.metal || 0) - protectedMetal);
        const lootableCrystal = Math.max(0, (defenderResources.crystal || 0) - protectedCrystal);
        const lootableDeuterium = Math.max(0, (defenderResources.deuterium || 0) - protectedDeuterium);
        
        const LOOT_FACTOR = 0.5; // Standard loot is 50% of unprotected resources
        const metalToLoot = lootableMetal * LOOT_FACTOR;
        const crystalToLoot = lootableCrystal * LOOT_FACTOR;
        const deuteriumToLoot = lootableDeuterium * LOOT_FACTOR;
        
        const totalLootable = metalToLoot + crystalToLoot + deuteriumToLoot;
        
        if (totalLootable > 0 && cargoCapacity > 0) {
            const lootRatio = Math.min(1, cargoCapacity / totalLootable);
            loot.metal = Math.floor(metalToLoot * lootRatio);
            loot.crystal = Math.floor(crystalToLoot * lootRatio);
            loot.deuterium = Math.floor(deuteriumToLoot * lootRatio);
        }
    }

    return {
        winner,
        attackerLosses,
        defenderLosses,
        defenderDefensesLosses,
        loot,
        debrisCreated: debris,
        finalDefenderFleet,
        finalDefenderDefenses,
        rounds,
    };
};