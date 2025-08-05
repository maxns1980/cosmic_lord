import { BuildingType, ResearchType, ShipType, DefenseType, Resources, BuildingLevels, ResearchLevels, Fleet, Defenses, BuildingCategory, MerchantState, MerchantStatus, NPCState, NPCFleetMission, ShipLevels, DebrisField, PirateMercenaryState, PirateMercenaryStatus, ResourceVeinBonus, AncientArtifactState, AncientArtifactStatus, SpacePlagueState, CombatStats, Colony, Inventory, ActiveBoosts, NPCPersonality, SolarFlareState, SolarFlareStatus, ContrabandState, ContrabandStatus, Moon, FleetTemplate, GhostShipState, GhostShipStatus, GalacticGoldRushState, StellarAuroraState, Boost, BoostType, GameState, PlanetSpecialization, PlayerState, WorldState, InfoMessage, NPCStates } from './types.js';
import { calculatePointsForNpc } from './utils/npcLogic.js';

export const TICK_INTERVAL = 1000; // ms
export const BASE_STORAGE_CAPACITY = 10000;
export const PLAYER_HOME_COORDS = '1:42:8';
export const DEBRIS_FIELD_RECOVERY_RATE = 0.3; // 30% of destroyed units' cost becomes debris
export const PROTECTED_RESOURCES_FACTOR = 0.1; // 10% of storage capacity is protected from raids
export const HOMEWORLD_MAX_FIELDS_BASE = 163;
export const TERRAFORMER_FIELDS_BONUS = 5;
export const COLONY_INCOME_BONUS_PER_HOUR: Omit<Resources, 'energy'> = {
    metal: 500,
    crystal: 250,
    deuterium: 100,
};

export const MERCHANT_CHECK_INTERVAL = (6 * 60 + 15) * 60 * 1000; // 6 hours 15 minutes
export const MERCHANT_SPAWN_CHANCE = 0.2; // 20%
export const PHALANX_SCAN_COST = 5000;

// --- NPC Management ---
export const TOTAL_NPC_COUNT = 1000;
export const NPC_NAMES = [ "Xylar", "Vortex", "Cygnus", "Orion", "Draconis", "Vega", "Sirius", "Rigel", "Altair", "Pulsar", "Wraith", "Nomad", "Spectre", "Juggernaut", "Reaper" ];
export const NPC_IMAGES = [ "👽", "👾", "🤖", "👹", "👺", "👻", "💀", "🤡", "🎃", "😈", "👹", "👺", "👻", "💀", "🤡" ];

// --- Random Event Constants ---
export const RANDOM_EVENT_CHECK_INTERVAL = 60 * 1000; // 1 minute
// Chances are per check, not per minute.
export const SOLAR_FLARE_CHANCE = 0.02; // 2%
export const PIRATE_MERCENARY_CHANCE = 0.03; // 3%
export const CONTRABAND_CHANCE = 0.025; // 2.5%
export const ANCIENT_ARTIFACT_CHANCE = 0.01; // 1%
export const ASTEROID_IMPACT_CHANCE = 0.04; // 4%
export const RESOURCE_VEIN_CHANCE = 0.03; // 3%
export const SPACE_PLAGUE_CHANCE = 0.015; // 1.5%
export const GHOST_SHIP_CHANCE = 0.01; // 1%
export const GALACTIC_GOLD_RUSH_CHANCE = 0.005; // 0.5%
export const STELLAR_AURORA_CHANCE = 0.015; // 1.5%

export const INITIAL_RESOURCES: Resources = {
  metal: 500,
  crystal: 500,
  deuterium: 0,
  energy: 0,
};


type BaseGameObjectInfo = {
    name: string;
    description: string;
    icon?: string;
    cost: (levelOrAmount: number) => Resources;
    requirements?: Partial<BuildingLevels & ResearchLevels>;
    buildTime: (levelOrAmount: number) => number; // in seconds
}

type BuildingInfo = BaseGameObjectInfo & {
    category: BuildingCategory;
    icon: string;
    image?: string;
    production?: (level: number) => number;
    energyConsumption?: (level: number) => number;
    deuteriumConsumption?: (level: number) => number;
    capacity?: (level: number) => number;
    buildableOn?: ('PLANET' | 'MOON')[];
}


export type ShipInfo = BaseGameObjectInfo & CombatStats & {
    icon: string;
    image?: string;
    cargoCapacity: number;
    speed: number;
    drive: ResearchType;
    deuteriumConsumption: number;
    requiredEnergy?: number;
    energyProduction?: number;
}

type DefenseInfo = BaseGameObjectInfo & CombatStats & {
    icon: string;
};

type ShipUpgradeInfo = Omit<BaseGameObjectInfo, 'icon'>;

export const BUILDING_DATA: Record<BuildingType, BuildingInfo> = {
  [BuildingType.METAL_MINE]: {
    name: "Kopalnia Metalu",
    category: BuildingCategory.RESOURCE,
    description: "Wydobywa metal z jądra planety. Metal jest podstawowym surowcem budowlanym.",
    icon: "🔩",
    image: "metal.jpg",
    cost: (level) => ({ metal: Math.floor(60 * Math.pow(1.5, level - 1)), crystal: Math.floor(15 * Math.pow(1.5, level - 1)), deuterium: 0, energy: 0 }),
    buildTime: (level) => Math.floor(((60 * Math.pow(1.5, level - 1)) + (15 * Math.pow(1.5, level - 1))) / 2500 * 360),
    production: (level) => Math.floor(30 * level * Math.pow(1.1, level)),
    energyConsumption: (level) => Math.floor(10 * level * Math.pow(1.1, level)),
    buildableOn: ['PLANET'],
  },
  [BuildingType.CRYSTAL_MINE]: {
    name: "Kopalnia Kryształu",
    category: BuildingCategory.RESOURCE,
    description: "Wydobywa kryształy, niezbędne do zaawansowanych technologii i budynków.",
    icon: "💎",
    image: "krysztal.jpg",
    cost: (level) => ({ metal: Math.floor(48 * Math.pow(1.6, level - 1)), crystal: Math.floor(24 * Math.pow(1.6, level - 1)), deuterium: 0, energy: 0 }),
    buildTime: (level) => Math.floor(((48 * Math.pow(1.6, level - 1)) + (24 * Math.pow(1.6, level - 1))) / 2500 * 360),
    production: (level) => Math.floor(20 * level * Math.pow(1.1, level)),
    energyConsumption: (level) => Math.floor(10 * level * Math.pow(1.1, level)),
    buildableOn: ['PLANET'],
  },
  [BuildingType.DEUTERIUM_SYNTHESIZER]: {
    name: "Syntezator Deuteru",
    category: BuildingCategory.RESOURCE,
    description: "Pozyskuje deuter z wody. Deuter jest paliwem dla statków i niektórych elektrowni.",
    icon: "💧",
    image: "deuter.jpg",
    cost: (level) => ({ metal: Math.floor(225 * Math.pow(1.5, level - 1)), crystal: Math.floor(75 * Math.pow(1.5, level - 1)), deuterium: 0, energy: 0 }),
    buildTime: (level) => Math.floor(((225 * Math.pow(1.5, level - 1)) + (75 * Math.pow(1.5, level - 1))) / 2500 * 360),
    production: (level) => (level > 0 ? Math.floor(10 * level * Math.pow(1.1, level)) : 0),
    energyConsumption: (level) => Math.floor(20 * level * Math.pow(1.1, level)),
    buildableOn: ['PLANET'],
  },
  [BuildingType.SOLAR_PLANT]: {
    name: "Elektrownia Słoneczna",
    category: BuildingCategory.RESOURCE,
    description: "Produkuje energię z promieniowania gwiazdy, zasilając budynki na planecie.",
    icon: "☀️",
    image: "elektrownia.jpg",
    cost: (level) => ({ metal: Math.floor(75 * Math.pow(1.5, level - 1)), crystal: Math.floor(30 * Math.pow(1.5, level - 1)), deuterium: 0, energy: 0 }),
    buildTime: (level) => Math.floor(((75 * Math.pow(1.5, level - 1)) + (30 * Math.pow(1.5, level - 1))) / 2500 * 360),
    production: (level) => Math.floor(20 * level * Math.pow(1.1, level)),
    buildableOn: ['PLANET'],
  },
  [BuildingType.FUSION_REACTOR]: {
    name: "Reaktor Fuzyjny",
    category: BuildingCategory.RESOURCE,
    description: "Generuje ogromne ilości energii w zamian za deuter. Zużycie deuteru jest stałe i zależy od poziomu.",
    icon: "⚛️",
    image: "reaktor.jpg",
    cost: level => ({ metal: Math.floor(900 * Math.pow(1.8, level - 1)), crystal: Math.floor(500 * Math.pow(1.8, level - 1)), deuterium: Math.floor(150 * Math.pow(1.8, level - 1)), energy: 0 }),
    buildTime: level => Math.floor(((900 * 1.8**(level-1)) + (500 * 1.8**(level-1)) + (150 * 1.8**(level-1))) / 2500 * 360),
    requirements: { [ResearchType.ENERGY_TECHNOLOGY]: 12, [BuildingType.DEUTERIUM_SYNTHESIZER]: 5 },
    production: (level) => Math.floor(50 * level * Math.pow(1.1, level)),
    deuteriumConsumption: (level) => Math.floor(10 * level * Math.pow(1.1, level)),
    buildableOn: ['PLANET'],
  },
  [BuildingType.RESEARCH_LAB]: {
    name: "Laboratorium Badawcze",
    icon: "🔬",
    category: BuildingCategory.INDUSTRIAL,
    description: "Centrum rozwoju technologicznego twojego imperium. Umożliwia prowadzenie badań.",
    image: "laboratorium.jpg",
    cost: level => ({ metal: 200 * Math.pow(2, level-1), crystal: 400 * Math.pow(2, level-1), deuterium: 200 * Math.pow(2, level-1), energy: 0 }),
    buildTime: level => Math.floor((200 * Math.pow(2, level-1) + 400 * Math.pow(2, level-1) + 200 * Math.pow(2, level-1)) / 2500 * 360),
    energyConsumption: level => Math.floor(25 * level * Math.pow(1.1, level)),
    buildableOn: ['PLANET'],
  },
  [BuildingType.SHIPYARD]: {
      name: "Stocznia",
      icon: "🛠️",
      category: BuildingCategory.INDUSTRIAL,
      description: "Buduje statki i struktury obronne. Wymaga Laboratorium na poziomie 1.",
      image: "stocznia.jpg",
      cost: level => ({ metal: 400 * Math.pow(2, level-1), crystal: 200 * Math.pow(2, level-1), deuterium: 100 * Math.pow(2, level-1), energy: 0 }),
      buildTime: level => Math.floor((400 * Math.pow(2, level-1) + 200 * Math.pow(2, level-1) + 100 * Math.pow(2, level-1)) / 2500 * 360),
      energyConsumption: level => Math.floor(50 * level * Math.pow(1.1, level)),
      requirements: { [BuildingType.RESEARCH_LAB]: 1 },
      buildableOn: ['PLANET', 'MOON'],
  },
  [BuildingType.BLACK_MARKET]: {
      name: "Czarny Rynek",
      icon: "💹",
      image: "rynek.jpg",
      category: BuildingCategory.INDUSTRIAL,
      description: "Generuje losowy dochód w kredytach co godzinę. Ryzyko się opłaca... czasami.",
      cost: level => ({ metal: 300 * Math.pow(2, level-1), crystal: 500 * Math.pow(2, level-1), deuterium: 200 * Math.pow(2, level-1), energy: 0 }),
      buildTime: level => Math.floor((300 * Math.pow(2, level-1) + 500 * Math.pow(2, level-1) + 200 * Math.pow(2, level-1)) / 2500 * 360),
      energyConsumption: level => Math.floor(30 * level * Math.pow(1.1, level)),
      requirements: { [BuildingType.RESEARCH_LAB]: 3, [ResearchType.COMPUTER_TECHNOLOGY]: 2 },
      buildableOn: ['PLANET'],
  },
  [BuildingType.METAL_STORAGE]: {
      name: "Magazyn Metalu",
      icon: "📦",
      category: BuildingCategory.STORAGE,
      description: "Zwiększa pojemność magazynową dla metalu. Chroni część surowców przed grabieżą.",
      cost: level => ({ metal: 1000 * Math.pow(2, level-1), crystal: 0, deuterium: 0, energy: 0 }),
      buildTime: level => Math.floor((1000 * Math.pow(2, level-1)) / 2500 * 360),
      capacity: level => BASE_STORAGE_CAPACITY * Math.pow(1.6, level),
      buildableOn: ['PLANET', 'MOON'],
  },
  [BuildingType.CRYSTAL_STORAGE]: {
      name: "Magazyn Kryształu",
      icon: "📦",
      category: BuildingCategory.STORAGE,
      description: "Zwiększa pojemność magazynową dla kryształu. Chroni część surowców przed grabieżą.",
      cost: level => ({ metal: 1000 * Math.pow(2, level-1), crystal: 500 * Math.pow(2, level-1), deuterium: 0, energy: 0 }),
      buildTime: level => Math.floor(((1000 * Math.pow(2, level-1)) + (500 * Math.pow(2, level-1))) / 2500 * 360),
      capacity: level => BASE_STORAGE_CAPACITY * Math.pow(1.6, level),
      buildableOn: ['PLANET', 'MOON'],
  },
  [BuildingType.DEUTERIUM_TANK]: {
      name: "Zbiornik Deuteru",
      icon: "🛢️",
      category: BuildingCategory.STORAGE,
      description: "Zwiększa pojemność magazynową dla deuteru. Chroni część surowców przed grabieżą.",
      cost: level => ({ metal: 1000 * Math.pow(2, level-1), crystal: 1000 * Math.pow(2, level-1), deuterium: 0, energy: 0 }),
      buildTime: level => Math.floor(((1000 * Math.pow(2, level-1)) + (1000 * Math.pow(2, level-1))) / 2500 * 360),
      capacity: level => BASE_STORAGE_CAPACITY * Math.pow(1.6, level),
      buildableOn: ['PLANET', 'MOON'],
  },
  [BuildingType.ENERGY_STORAGE]: {
      name: "Magazyn Energii",
      icon: "🔋",
      category: BuildingCategory.STORAGE,
      description: "Zwiększa pojemność magazynową dla nadwyżek energii. Zmagazynowana energia jest wykorzystywana, gdy produkcja jest niewystarczająca.",
      image: "magazyn_energii.jpg",
      cost: level => ({ metal: 1600 * Math.pow(2, level-1), crystal: 1000 * Math.pow(2, level-1), deuterium: 0, energy: 0 }),
      buildTime: level => Math.floor(((1600 * Math.pow(2, level-1)) + (1000 * Math.pow(2, level-1))) / 2500 * 360),
      capacity: level => level === 0 ? 0 : Math.floor(5000 * Math.pow(1.2, level - 1)),
      energyConsumption: level => Math.floor(5 * level * Math.pow(1.1, level)),
      requirements: { [BuildingType.SOLAR_PLANT]: 3, [ResearchType.ENERGY_TECHNOLOGY]: 2 },
      buildableOn: ['PLANET'],
  },
  [BuildingType.PHALANX_SENSOR]: {
    name: "Falanga Czujników",
    icon: "📡",
    category: BuildingCategory.INDUSTRIAL,
    description: "Pozwala skanować ruchy flot wrogów w danym układzie słonecznym. Każdy poziom zwiększa zasięg skanowania. Budynek dostępny tylko na księżycu.",
    cost: level => ({ metal: 20000 * Math.pow(2, level - 1), crystal: 40000 * Math.pow(2, level - 1), deuterium: 20000 * Math.pow(2, level - 1), energy: 0 }),
    buildTime: level => Math.floor(((20000 + 40000 + 20000) * Math.pow(2, level - 1)) / 2500 * 360),
    energyConsumption: level => Math.floor(1000 * level),
    requirements: { [BuildingType.SHIPYARD]: 1, [ResearchType.SPY_TECHNOLOGY]: 6 },
    buildableOn: ['MOON'],
  },
  [BuildingType.JUMP_GATE]: {
    name: "Teleporter Międzygwiezdny",
    icon: "🌀",
    category: BuildingCategory.INDUSTRIAL,
    description: "Umożliwia natychmiastowe przemieszczanie floty między dwoma teleporterami. Budowa na razie niemożliwa. Budynek dostępny tylko na księżycu.",
    cost: level => ({ metal: 2000000, crystal: 4000000, deuterium: 2000000, energy: 0 }),
    buildTime: _ => 9999999,
    energyConsumption: _ => 0,
    requirements: { [BuildingType.SHIPYARD]: 1, [ResearchType.HYPERSPACE_DRIVE]: 7 },
    buildableOn: ['MOON'],
  },
  [BuildingType.TERRAFORMER]: {
    name: "Terraformer",
    icon: "🏞️",
    category: BuildingCategory.INDUSTRIAL,
    description: "Zmienia powierzchnię planety, tworząc nowe pola pod zabudowę. Każdy poziom daje +5 pól.",
    cost: level => ({ metal: 0, crystal: 50000 * Math.pow(2, level - 1), deuterium: 100000 * Math.pow(2, level - 1), energy: 0 }),
    buildTime: level => Math.floor(((50000 * Math.pow(2, level-1)) + (100000 * Math.pow(2, level-1))) / 2500 * 360),
    energyConsumption: level => Math.floor(1000 * Math.pow(1.5, level-1)),
    requirements: { [BuildingType.RESEARCH_LAB]: 12, [ResearchType.ENERGY_TECHNOLOGY]: 10, [ResearchType.AI_TECHNOLOGY]: 5 },
    buildableOn: ['PLANET'],
  },
  [BuildingType.COMMAND_CENTER]: {
    name: "Centrum Dowodzenia",
    icon: "🎖️",
    category: BuildingCategory.INDUSTRIAL,
    description: "Zaawansowane centrum logistyczne, które zwiększa liczbę dostępnych slotów flot o 1 na każdy poziom.",
    cost: level => ({ metal: 100000 * Math.pow(2, level - 1), crystal: 100000 * Math.pow(2, level - 1), deuterium: 50000 * Math.pow(2, level - 1), energy: 0 }),
    buildTime: level => Math.floor(((100000 + 100000 + 50000) * Math.pow(2, level-1)) / 2500 * 360),
    energyConsumption: level => Math.floor(500 * level),
    requirements: { [ResearchType.COMPUTER_TECHNOLOGY]: 10, [ResearchType.HYPERSPACE_DRIVE]: 5 },
    buildableOn: ['PLANET'],
  },
  [BuildingType.ALLIANCE_DEPOT]: {
    name: "Depozyt Sojuszniczy",
    icon: "🏦",
    category: BuildingCategory.INDUSTRIAL,
    description: "Umożliwia przechowywanie i transfer surowców między członkami sojuszu. Wymaga bycia w sojuszu (funkcja do zaimplementowania).",
    cost: level => ({ metal: 20000 * Math.pow(1.8, level-1), crystal: 40000 * Math.pow(1.8, level-1), deuterium: 0, energy: 0 }),
    buildTime: level => Math.floor(((20000 + 40000) * Math.pow(1.8, level-1)) / 2500 * 360),
    energyConsumption: level => Math.floor(250 * level),
    requirements: { [ResearchType.COMPUTER_TECHNOLOGY]: 8, [BuildingType.SHIPYARD]: 6 },
    buildableOn: ['PLANET'],
  },
  [BuildingType.ORBITAL_DEFENSE_PLATFORM]: {
    name: "Platforma Obrony Orbitalnej",
    icon: "🌐",
    category: BuildingCategory.INDUSTRIAL,
    description: "Ogromna stacja na orbicie, która koordynuje i wzmacnia wszystkie struktury obronne na planecie. Każdy poziom zwiększa siłę ataku i tarcz obrony o 5% (funkcja do zaimplementowania).",
    cost: level => ({ metal: 200000 * Math.pow(2, level - 1), crystal: 150000 * Math.pow(2, level - 1), deuterium: 50000 * Math.pow(2, level - 1), energy: 0 }),
    buildTime: level => Math.floor(((200000 + 150000 + 50000) * Math.pow(2, level-1)) / 2500 * 360),
    energyConsumption: level => Math.floor(2000 * level),
    requirements: { [BuildingType.SHIPYARD]: 10, [ResearchType.SHIELDING_TECHNOLOGY]: 8, [ResearchType.WEAPON_TECHNOLOGY]: 8 },
    buildableOn: ['PLANET'],
  },
};

export const RESEARCH_DATA: Record<ResearchType, BaseGameObjectInfo & {icon: string}> = {
    [ResearchType.ENERGY_TECHNOLOGY]: {
        name: "Technologia energetyczna",
        description: "Zwiększa wydajność produkcji energii i pozwala na rozwój zaawansowanych technologii.",
        icon: "⚡",
        cost: level => ({ metal: 0, crystal: 800 * Math.pow(2, level - 1), deuterium: 400 * Math.pow(2, level - 1), energy: 0 }),
        buildTime: level => Math.floor((800 * Math.pow(2, level-1) + 400 * Math.pow(2, level-1)) / 2500 * 360),
        requirements: { [BuildingType.RESEARCH_LAB]: 1 },
    },
    [ResearchType.ARMOR_TECHNOLOGY]: {
        name: "Technologia pancerza",
        description: "Zwiększa wytrzymałość strukturalną statków i obrony o 10% za każdy poziom.",
        icon: "🧱",
        cost: level => ({ metal: 1000 * Math.pow(2, level - 1), crystal: 0, deuterium: 0, energy: 0 }),
        buildTime: level => Math.floor((1000 * Math.pow(2, level-1)) / 2500 * 360),
        requirements: { [BuildingType.RESEARCH_LAB]: 2 },
    },
     [ResearchType.SHIELDING_TECHNOLOGY]: {
        name: "Technologia osłon",
        description: "Wzmacnia tarcze ochronne wszystkich jednostek o 10% na poziom.",
        icon: "🛡️",
        cost: level => ({ metal: 200 * Math.pow(2, level - 1), crystal: 600 * Math.pow(2, level - 1), deuterium: 0, energy: 0 }),
        buildTime: level => Math.floor((200 * Math.pow(2, level-1) + 600 * Math.pow(2, level-1)) / 2500 * 360),
        requirements: { [BuildingType.RESEARCH_LAB]: 6, [ResearchType.ENERGY_TECHNOLOGY]: 3 },
    },
    [ResearchType.WEAPON_TECHNOLOGY]: {
        name: "Technologia bojowa",
        description: "Zwiększa siłę ognia jednostek bojowych o 10% na poziom.",
        icon: "💥",
        cost: level => ({ metal: 800 * Math.pow(2, level - 1), crystal: 200 * Math.pow(2, level - 1), deuterium: 0, energy: 0 }),
        buildTime: level => Math.floor((800 * Math.pow(2, level-1) + 200 * Math.pow(2, level-1)) / 2500 * 360),
        requirements: { [BuildingType.RESEARCH_LAB]: 4 },
    },
    [ResearchType.LASER_TECHNOLOGY]: {
        name: "Technologia laserowa",
        description: "Odblokowuje podstawową broń energetyczną i jej ulepszenia.",
        icon: "🔴",
        cost: level => ({ metal: 200 * Math.pow(2, level-1), crystal: 100 * Math.pow(2, level-1), deuterium: 0, energy: 0 }),
        buildTime: level => Math.floor((200 * Math.pow(2, level-1) + 100 * Math.pow(2, level-1)) / 2500 * 360),
        requirements: { [BuildingType.RESEARCH_LAB]: 1, [ResearchType.ENERGY_TECHNOLOGY]: 2 },
    },
    [ResearchType.ION_TECHNOLOGY]: {
        name: "Technologia jonowa",
        description: "Odblokowuje broń jonową, wyspecjalizowaną w niszczeniu tarcz.",
        icon: "🔵",
        cost: level => ({ metal: 1000 * Math.pow(2, level - 1), crystal: 300 * Math.pow(2, level-1), deuterium: 100 * Math.pow(2, level-1), energy: 0 }),
        buildTime: level => Math.floor((1000 * Math.pow(2, level-1) + 300 * Math.pow(2, level-1) + 100 * Math.pow(2, level-1)) / 2500 * 360),
        requirements: { [BuildingType.RESEARCH_LAB]: 4, [ResearchType.LASER_TECHNOLOGY]: 5, [ResearchType.ENERGY_TECHNOLOGY]: 4 },
    },
    [ResearchType.PLASMA_TECHNOLOGY]: {
        name: "Technologia plazmowa",
        description: "Najwyższy poziom technologii zbrojeniowej, zadający ogromne obrażenia.",
        icon: "🟣",
        cost: level => ({ metal: 2000 * Math.pow(2, level - 1), crystal: 4000 * Math.pow(2, level-1), deuterium: 1000 * Math.pow(2, level-1), energy: 0 }),
        buildTime: level => Math.floor((2000 * Math.pow(2, level-1) + 4000 * Math.pow(2, level-1) + 1000 * Math.pow(2, level-1)) / 2500 * 360),
        requirements: { [BuildingType.RESEARCH_LAB]: 4, [ResearchType.ION_TECHNOLOGY]: 5, [ResearchType.WEAPON_TECHNOLOGY]: 8 },
    },
    [ResearchType.COMBUSTION_DRIVE]: {
        name: "Napęd spalinowy",
        description: "Podstawowy napęd dla małych statków. Każdy poziom zwiększa ich prędkość o 10%.",
        icon: "🔥",
        cost: level => ({ metal: 400 * Math.pow(2, level-1), crystal: 0, deuterium: 600 * Math.pow(2, level-1), energy: 0 }),
        buildTime: level => Math.floor((400 * Math.pow(2, level-1) + 600 * Math.pow(2, level-1)) / 2500 * 360),
        requirements: { [BuildingType.RESEARCH_LAB]: 1, [ResearchType.ENERGY_TECHNOLOGY]: 1 },
    },
    [ResearchType.IMPULSE_DRIVE]: {
        name: "Napęd impulsowy",
        description: "Ulepszony napęd dla cięższych statków. Każdy poziom zwiększa ich prędkość o 20%.",
        icon: "💨",
        cost: level => ({ metal: 2000 * Math.pow(2, level-1), crystal: 4000 * Math.pow(2, level-1), deuterium: 600 * Math.pow(2, level-1), energy: 0 }),
        buildTime: level => Math.floor((2000 * Math.pow(2, level-1) + 4000 * Math.pow(2, level-1) + 600 * Math.pow(2, level-1)) / 2500 * 360),
        requirements: { [BuildingType.RESEARCH_LAB]: 2, [ResearchType.ENERGY_TECHNOLOGY]: 1 },
    },
    [ResearchType.HYPERSPACE_DRIVE]: {
        name: "Napęd nadprzestrzenny",
        description: "Najszybszy napęd dla okrętów bojowych. Każdy poziom zwiększa ich prędkość o 30%.",
        icon: "🌀",
        cost: level => ({ metal: 10000 * Math.pow(2, level-1), crystal: 20000 * Math.pow(2, level-1), deuterium: 600