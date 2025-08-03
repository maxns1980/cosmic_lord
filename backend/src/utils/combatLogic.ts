import { Fleet, Defenses, ResearchLevels, Resources, ShipType, DefenseType, ResearchType, Loot, BuildingLevels, BuildingType, RoundReport, ShipLevels, SolarFlareState, SolarFlareStatus } from '../types.js';
import { ALL_SHIP_DATA, DEFENSE_DATA, DEBRIS_FIELD_RECOVERY_RATE, PROTECTED_RESOURCES_FACTOR, BUILDING_DATA, BASE_STORAGE_CAPACITY } from '../constants.js';

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

export type CombatParty = {
    fleet: Fleet;
    defenses?: Defenses;
    research: ResearchLevels;
    name: string;
    shipLevels?: ShipLevels;
    solarFlare: SolarFlareState;
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
             ...(Object.values(ShipType).reduce((acc, val) => ({...acc, [val]: 250}), {})),
             ...(Object.values(DefenseType).reduce((acc, val) => ({...acc, [val]: 250}), {})),
        }
    };
    return rapidFireData[unitId as ShipType] || {};
};

const createCombatGroups = (party: CombatParty): CombatGroup[] => {
    const groups: CombatGroup[] = [];
    const armorTech = party.research[ResearchType.ARMOR_TECHNOLOGY] || 0;
    const shieldTech = party.research[ResearchType.SHIELDING_TECHNOLOGY] || 0;
    const weaponTech = party.research[ResearchType.WEAPON_TECHNOLOGY] || 0;
    const isDisruptionActive = party.solarFlare.status === SolarFlareStatus.DISRUPTION;
    
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

    const damageAbsorbedByShield = Math.min(group.currentTotalShield, damage);
    group.currentTotalShield -= damageAbsorbedByShield;
    const damageToHull = damage - damageAbsorbedByShield;

    if (damageToHull > 0) {
        group.currentTotalHull -= damageToHull;
        if (group.currentTotalHull <= 0) {
            group.count = 0;
        } else {
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
    
    for (let round = 1; round <= 6; round++) {
        const attackerUnitCount = attackerGroups.reduce((sum, g) => sum + g.count, 0);
        const defenderUnitCount = defenderGroups.reduce((sum, g) => sum + g.count, 0);
        if (attackerUnitCount === 0 || defenderUnitCount === 0) break;
        
        fireOnGroups(attackerGroups, defenderGroups);
        fireOnGroups(defenderGroups, attackerGroups);
        
        attackerGroups.forEach(g => g.currentTotalShield = g.count * g.shield);
        defenderGroups.forEach(g => g.currentTotalShield = g.count * g.shield);
        attackerGroups.forEach(g => g.initialCount = g.count);
        defenderGroups.forEach(g => g.initialCount = g.count);
    }
    
    let winner: 'attacker' | 'defender' | 'draw';
    const attackerHasFleet = attackerGroups.some(g => g.type === 'ship' && g.count > 0);
    const defenderHasUnits = defenderGroups.some(g => g.count > 0);

    if (attackerHasFleet && !defenderHasUnits) winner = 'attacker';
    else if (!attackerHasFleet && defenderHasUnits) winner = 'defender';
    else winner = 'draw';
    
    const { fleet: finalAttackerFleet } = groupsToFleetDefenses(attackerGroups.filter(g => g.type === 'ship'));
    const { fleet: finalDefenderFleet, defenses: finalDefenderDefenses } = groupsToFleetDefenses(defenderGroups);
    
    const attackerLosses: Partial<Fleet> = {};
    Object.keys(attacker.fleet).forEach(shipId => {
        const initial = attacker.fleet[shipId as ShipType] || 0;
        const final = finalAttackerFleet[shipId as ShipType] || 0;
        if (initial > final) attackerLosses[shipId as ShipType] = initial - final;
    });

    const defenderLosses: Partial<Fleet> = {};
    Object.keys(defender.fleet).forEach(shipId => {
        const initial = defender.fleet[shipId as ShipType] || 0;
        const final = finalDefenderFleet[shipId as ShipType] || 0;
        if (initial > final) defenderLosses[shipId as ShipType] = initial - final;
    });
    
    const defenderDefensesLosses: Partial<Defenses> = {};
     Object.keys(defender.defenses || {}).forEach(defId => {
        const initial = defender.defenses?.[defId as DefenseType] || 0;
        const final = finalDefenderDefenses[defId as DefenseType] || 0;
        if (initial > final) defenderDefensesLosses[defId as DefenseType] = initial - final;
    });
    
    const debris: Pick<Resources, 'metal' | 'crystal'> = { metal: 0, crystal: 0 };
    [...Object.entries(attackerLosses), ...Object.entries(defenderLosses)].forEach(([id, count]) => {
        const cost = ALL_SHIP_DATA[id as ShipType].cost(1);
        if (cost && count) {
            debris.metal += cost.metal * count * DEBRIS_FIELD_RECOVERY_RATE;
            debris.crystal += cost.crystal * count * DEBRIS_FIELD_RECOVERY_RATE;
        }
    });
    
    const loot: Loot = { metal: 0, crystal: 0, deuterium: 0 };
    if (winner === 'attacker') {
        let cargoCapacity = attackerGroups.reduce((sum, group) => {
            if (group.type === 'ship' && group.count > 0) {
                const data = ALL_SHIP_DATA[group.id as ShipType];
                return sum + (data?.cargoCapacity || 0) * group.count;
            }
            return sum;
        }, 0);

        const getCapacity = (type: BuildingType, level: number) => BUILDING_DATA[type].capacity?.(level) || BASE_STORAGE_CAPACITY;
        const metalCapacity = getCapacity(BuildingType.METAL_STORAGE, defenderBuildings[BuildingType.METAL_STORAGE] || 0);
        
        const lootableMetal = Math.max(0, defenderResources.metal / 2);
        const lootableCrystal = Math.max(0, defenderResources.crystal / 2);
        const lootableDeuterium = Math.max(0, defenderResources.deuterium / 2);
        
        const totalLootable = lootableMetal + lootableCrystal + lootableDeuterium;
        if (totalLootable > 0 && cargoCapacity > 0) {
            const lootRatio = Math.min(1, cargoCapacity / totalLootable);
            loot.metal = Math.floor(lootableMetal * lootRatio);
            loot.crystal = Math.floor(lootableCrystal * lootRatio);
            loot.deuterium = Math.floor(lootableDeuterium * lootRatio);
        }
    }

    return { winner, attackerLosses, defenderLosses, defenderDefensesLosses, loot, debrisCreated: debris, finalDefenderFleet, finalDefenderDefenses, rounds: [] };
};