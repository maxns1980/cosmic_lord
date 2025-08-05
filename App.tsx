



import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
    BuildingType, Resources, BuildingLevels, ResearchLevels, ResearchType, Fleet, QueueItem, QueueItemType, GameObject, 
    Defenses, FleetMission, MissionType, DefenseType, ShipType, Message, SpyReport, BattleReport, Loot, 
    SpyMessage, BattleMessage, MerchantState, MerchantStatus, MerchantInfoMessage, View, NPCStates, EspionageEventMessage, NPCFleetMission, ShipLevels, DebrisField,
    PirateMercenaryState, PirateMercenaryStatus, PirateMessage, AsteroidImpactMessage, AsteroidImpactType,
    ResourceVeinBonus, ResourceVeinMessage,
    AncientArtifactState, AncientArtifactStatus, AncientArtifactChoice, AncientArtifactMessage,
    SpacePlagueState, SpacePlagueMessage,
    SolarFlareState, SolarFlareStatus, SolarFlareMessage,
    ContrabandState, ContrabandStatus, ContrabandOfferType, ContrabandMessage, ContrabandOffer,
    Colony, PlanetSpecialization, InfoMessage,
    Inventory, ActiveBoosts, BoostType, Boost, GameState, NPCPersonality, ExplorationOutcomeType, ExplorationMessage, ExpeditionMessage, ExpeditionOutcomeType, ColonizationMessage, ShipOffer, OfflineSummaryMessage, Moon, MoonCreationMessage, FleetTemplate,
    GhostShipState, GhostShipStatus, GhostShipChoice, GhostShipDiscoveryMessage, GhostShipOutcomeMessage,
    GalacticGoldRushState, GalacticGoldRushMessage,
    StellarAuroraState, StellarAuroraMessage,
    TestableEventType,
    NPCState,
    Alliance
} from './types';
import { 
    BUILDING_DATA, ALL_GAME_OBJECTS,
    COLONY_INCOME_BONUS_PER_HOUR,
    ALL_SHIP_DATA
} from './constants';
import Header from './components/Header';
import OverviewPanel from './components/OverviewPanel';
import BuildingsPanel from './components/BuildingsPanel';
import ResearchPanel from './components/ResearchPanel';
import ShipyardPanel from './components/ShipyardPanel';
import DefensePanel from './components/DefensePanel';
import FleetPanel from './components/FleetPanel';
import MessagesPanel from './components/MessagesPanel';
import { MerchantPanel } from './components/MerchantPanel';
import Navigation from './components/Navigation';
import QueuePanel from './components/QueuePanel';
import GalaxyPanel from './components/GalaxyPanel';
import FleetUpgradesPanel from './components/FleetUpgradesPanel';
import PhalanxPanel from './components/PhalanxPanel';
import PirateMercenaryPanel from './components/PirateMercenaryPanel';
import AncientArtifactModal from './components/AncientArtifactModal';
import ContrabandModal from './components/ContrabandModal';
import InfoModal from './components/InfoModal';
import EncyclopediaModal from './components/EncyclopediaModal';
import InventoryModal from './components/InventoryModal';
import SpyModal from './components/SpyModal';
import ExpeditionModal from './components/ExpeditionModal';
import ExploreModal from './components/ExploreModal';
import HarvestModal from './components/HarvestModal';
import AlliancePanel from './components/AlliancePanel';
import Login from './components/Login';


// --- Calculation Helpers (for display purposes) ---
const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

const calculateMaxResources = (buildings: BuildingLevels): Resources => {
    const metalCapacity = BUILDING_DATA[BuildingType.METAL_STORAGE].capacity?.(buildings[BuildingType.METAL_STORAGE]) ?? 0;
    const crystalCapacity = BUILDING_DATA[BuildingType.CRYSTAL_STORAGE].capacity?.(buildings[BuildingType.CRYSTAL_STORAGE]) ?? 0;
    const deuteriumCapacity = BUILDING_DATA[BuildingType.DEUTERIUM_TANK].capacity?.(buildings[BuildingType.DEUTERIUM_TANK]) ?? 0;
    const energyCapacity = BUILDING_DATA[BuildingType.ENERGY_STORAGE].capacity?.(buildings[BuildingType.ENERGY_STORAGE]) ?? 0;

    return {
      metal: metalCapacity,
      crystal: crystalCapacity,
      deuterium: deuteriumCapacity,
      energy: energyCapacity,
    };
};

const calculateProductions = (gameState: GameState) => {
    const { colonies, activeBoosts, research } = gameState;
    
    // Use player-scoped test event if active, otherwise fall back to global event
    const resourceVeinBonus = gameState.scopedResourceVeinBonus || gameState.resourceVeinBonus;
    const solarFlare = gameState.scopedSolarFlareState || gameState.solarFlare;
    const stellarAuroraState = gameState.scopedStellarAuroraState || gameState.stellarAuroraState;

    let totalProductions = { metal: 0, crystal: 0, deuterium: 0 };
    let totalEnergy = { produced: 0, consumed: 0 };

    const allColonies = Object.values(colonies);
    if (allColonies.length === 0) {
        return { metal: 0, crystal: 0, deuterium: 0, energy: { produced: 0, consumed: 0, efficiency: 1 }};
    }
      
    const homeworld = allColonies.reduce((oldest, current) => 
        current.creationTime < oldest.creationTime ? current : oldest
    );

    for (const planet of allColonies) {
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

        if (planet.id !== homeworld.id) {
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

function App() {
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('authToken'));
  const [username, setUsername] = useState<string | null>(localStorage.getItem('username'));
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<View>('overview');
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  
  // UI state
  const [fleetTarget, setFleetTarget] = useState<{coords: string, mission: MissionType} | null>(null);
  const [spyModalTarget, setSpyModalTarget] = useState<string | null>(null);
  const [expeditionModalTargetCoords, setExpeditionModalTargetCoords] = useState<string | null>(null);
  const [exploreModalTargetCoords, setExploreModalTargetCoords] = useState<string | null>(null);
  const [harvestModalTarget, setHarvestModalTarget] = useState<{coords: string, debris: DebrisField} | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isEncyclopediaOpen, setIsEncyclopediaOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);

  const API_URL = 'https://cosmic-lord-1skk.onrender.com';

  const showNotification = useCallback((message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const handleLogout = useCallback(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('username');
      setAuthToken(null);
      setUsername(null);
      setGameState(null);
      setActiveLocationId(null);
  }, []);

  const handleLoginSuccess = (token: string, loggedInUsername: string) => {
      localStorage.setItem('authToken', token);
      localStorage.setItem('username', loggedInUsername);
      setAuthToken(token);
      setUsername(loggedInUsername);
      setGameState(null);
      setActiveLocationId(null);
  };

  useEffect(() => {
    if (!authToken) return;

    const fetchState = async () => {
        try {
            const response = await fetch(`${API_URL}/api/state`, {
                headers: { 'Authorization': authToken }
            });

            if (!response.ok) {
                console.error(`Failed to fetch state from server, status: ${response.status}`);
                // If token is invalid (e.g. user was deleted from DB), log out
                if (response.status === 401 || response.status === 404) {
                    handleLogout();
                }
                return;
            }

            const data: GameState = await response.json();
            setGameState(data);
        } catch (error) {
            console.error("Error fetching game state:", error);
            // Don't log out on network errors, just retry
        }
    };

    fetchState();
    const interval = setInterval(fetchState, 5000);

    return () => clearInterval(interval);
  }, [API_URL, authToken, handleLogout]);
  
  useEffect(() => {
    if (gameState && !activeLocationId) {
      const colonyIds = Object.keys(gameState.colonies);
      if (colonyIds.length > 0) {
        const firstColony = Object.values(gameState.colonies).sort((a, b) => a.creationTime - b.creationTime)[0];
        setActiveLocationId(firstColony.id);
      }
    }
  }, [gameState, activeLocationId]);
  
  const performAction = async (type: string, payload: any) => {
      if (!API_URL || !authToken) return;
      try {
          const response = await fetch(`${API_URL}/api/action`, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': authToken
              },
              body: JSON.stringify({ type, payload }),
          });
          const result = await response.json();
          if (!response.ok) {
              throw new Error(result.message || 'Action failed');
          }
          if (result.message) {
              showNotification(result.message);
          }
          if (result.gameState) {
              setGameState(result.gameState);
          }
      } catch (error) {
          console.error(`Error performing action ${type}:`, error);
          showNotification((error as Error).message);
      }
  };

  const handleAddToQueue = useCallback((id: GameObject, type: QueueItemType, amount: number = 1) => {
    performAction('ADD_TO_QUEUE', { id, type, amount, activeLocationId });
  }, [activeLocationId]);

  const handleMerchantTrade = useCallback((resource: keyof Omit<Resources, 'energy'>, amount: number, tradeType: 'buy' | 'sell') => {
    performAction('MERCHANT_TRADE', { resource, amount, tradeType });
  }, []);

  const handleMerchantShipPurchase = useCallback((shipType: ShipType, amount: number) => {
    performAction('MERCHANT_BUY_SHIP', { shipType, amount });
  }, []);
  
  const handleReadMessage = useCallback((messageId: string) => {
    performAction('READ_MESSAGE', { messageId });
  }, []);

  const handleDeleteMessage = useCallback((messageId: string) => {
    performAction('DELETE_MESSAGE', { messageId });
  }, []);

  const handleDeleteAllMessages = useCallback(() => {
    performAction('DELETE_ALL_MESSAGES', {});
  }, []);

  const handleSendFleet = useCallback((missionFleet: Fleet, targetCoords: string, missionType: MissionType, durationSeconds: number, fuelCost: number) => {
    performAction('SEND_FLEET', { missionFleet, targetCoords, missionType, durationSeconds, fuelCost, activeLocationId });
  }, [activeLocationId]);

  const handleSendSpyMission = useCallback((probeCount: number, targetCoords: string, durationSeconds: number, fuelCost: number) => {
    performAction('SEND_SPY', { probeCount, targetCoords, durationSeconds, fuelCost, activeLocationId });
    setSpyModalTarget(null);
  }, [activeLocationId]);

  const handleSendExpeditionMission = useCallback((missionFleet: Fleet, targetCoords: string, durationSeconds: number, explorationDurationSeconds: number, fuelCost: number) => {
     performAction('SEND_EXPEDITION', { missionFleet, targetCoords, durationSeconds, explorationDurationSeconds, fuelCost, activeLocationId });
     setExpeditionModalTargetCoords(null);
  }, [activeLocationId]);

  const handleSendExploreMission = useCallback((missionFleet: Fleet, targetCoords: string, durationSeconds: number, fuelCost: number) => {
      performAction('SEND_EXPLORE', { missionFleet, targetCoords, durationSeconds, fuelCost, activeLocationId });
      setExploreModalTargetCoords(null);
  }, [activeLocationId]);

  const handleSendHarvestMission = useCallback((recyclerCount: number, targetCoords: string, durationSeconds: number, fuelCost: number) => {
      performAction('SEND_HARVEST', { recyclerCount, targetCoords, durationSeconds, fuelCost, activeLocationId });
      setHarvestModalTarget(null);
  }, [activeLocationId]);

  const handlePhalanxScan = useCallback((sourceMoonId: string, targetCoords: string) => {
    performAction('PHALANX_SCAN', { sourceMoonId, targetCoords });
  }, []);

  const handleRecallFleet = useCallback((missionId: string) => {
      performAction('RECALL_FLEET', { missionId });
  }, []);
  
  const handleSaveTemplate = useCallback((name: string, fleet: Fleet) => {
    performAction('SAVE_TEMPLATE', { name, fleet });
  }, []);

  const handleDeleteTemplate = useCallback((name: string) => {
      performAction('DELETE_TEMPLATE', { name });
  }, []);

  const handleToggleFavoritePlanet = useCallback((coords: string) => {
      performAction('TOGGLE_FAVORITE', { coords });
  }, []);

  const handleResetGame = useCallback(() => {
      if (window.confirm('Czy na pewno chcesz zresetować grę? Cały postęp zostanie utracony!')) {
          performAction('RESET_GAME', {});
      }
  }, []);

  const handleCreateAlliance = useCallback((name: string, tag: string) => {
    performAction('CREATE_ALLIANCE', { name, tag });
  }, []);

  const handleLeaveAlliance = useCallback(() => {
    if (window.confirm('Czy na pewno chcesz opuścić sojusz? Spowoduje to jego rozwiązanie, jeśli jesteś jedynym członkiem.')) {
        performAction('LEAVE_ALLIANCE', {});
    }
  }, []);
  
  const activeEntity = useMemo(() => {
    if (!gameState || !activeLocationId) return null;
    const { colonies, moons } = gameState;
    const isMoon = activeLocationId.endsWith('_moon');
    const planetId = isMoon ? activeLocationId.replace('_moon', '') : activeLocationId;
    return isMoon ? (moons[planetId] || null) : (colonies[planetId] || null);
  }, [gameState, activeLocationId]);
  
  const homeworld = useMemo(() => {
    if (!gameState) return null;
    const allColonies = Object.values(gameState.colonies);
    if (allColonies.length === 0) return null;
    return allColonies.reduce((oldest, current) => 
        current.creationTime < oldest.creationTime ? current : oldest
    );
  }, [gameState]);

  if (!authToken || !username) {
      return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (!gameState || !activeLocationId || !activeEntity) {
    return <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center"><p className="text-2xl animate-pulse">Łączenie z serwerem gry...</p></div>;
  }
  
  const { resources, research, shipLevels, fleetMissions, npcFleetMissions, messages, credits, merchantState, ancientArtifactState, spacePlague, npcStates, debrisFields, colonies, moons, inventory, activeBoosts, fleetTemplates, alliance, nextBlackMarketIncome, lastBonusClaimTime, favoritePlanets } = gameState;
  
    // Use player-scoped test event if active, otherwise fall back to global event
  const pirateMercenaryState = gameState.scopedPirateMercenaryState || gameState.pirateMercenaryState;
  const solarFlare = gameState.scopedSolarFlareState || gameState.solarFlare;
  const contrabandState = gameState.scopedContrabandState || gameState.contrabandState;
  const ghostShipState = gameState.scopedGhostShipState || gameState.ghostShipState;

  const { fleet: activeFleet, buildings: activeBuildings, defenses: activeDefenses, buildingQueue: activeBuildingQueue, shipyardQueue: activeShipyardQueue, maxFields } = activeEntity;
  const isMoon = activeLocationId.endsWith('_moon');

  const productions = calculateProductions(gameState);
  const maxResources = calculateMaxResources(activeBuildings);
  const unreadMessagesCount = messages.filter(m => !m.isRead).length;
  
  const usedFields = Object.values(activeBuildings).reduce((sum, level) => sum + level, 0);
  const maxFleetSlots = 1 + (research[ResearchType.COMPUTER_TECHNOLOGY] || 0) + (homeworld?.buildings[BuildingType.COMMAND_CENTER] || 0);

  const availableProbesOnActiveLocation = activeFleet[ShipType.SPY_PROBE] || 0;
  const availableRecyclersOnActiveLocation = activeFleet[ShipType.RECYCLER] || 0;

  const buildingQueueCapacity = activeBoosts[BoostType.EXTRA_BUILD_QUEUE]?.level || 1;
  const shipyardQueueCapacity = 1;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">
        <Header 
            resources={resources}
            maxResources={maxResources}
            productions={productions}
            credits={credits}
            blackMarketHourlyIncome={nextBlackMarketIncome}
            resourceVeinBonus={gameState.scopedResourceVeinBonus || gameState.resourceVeinBonus}
            inventory={inventory}
            activeBoosts={activeBoosts}
            solarFlare={solarFlare}
            stellarAuroraState={gameState.scopedStellarAuroraState || gameState.stellarAuroraState}
            npcFleetMissions={npcFleetMissions}
            colonies={colonies}
            moons={moons}
            activeLocationId={activeLocationId}
            onLocationChange={setActiveLocationId}
            onInfoClick={() => setIsInfoModalOpen(true)}
            onEncyclopediaClick={() => setIsEncyclopediaOpen(true)}
            onInventoryClick={() => setIsInventoryOpen(true)}
            username={username}
            onLogout={handleLogout}
            homeworld={homeworld}
        />
        <main className="container mx-auto p-4 flex flex-col xl:flex-row gap-4">
           <Navigation
                activeView={activeView}
                setActiveView={setActiveView}
                unreadMessagesCount={unreadMessagesCount}
                merchantState={merchantState}
                hasPhalanx={Object.values(moons).some(m => m.buildings[BuildingType.PHALANX_SENSOR] > 0)}
                hasAlliance={!!alliance}
                onTriggerEvent={(eventType) => performAction('TRIGGER_EVENT', { eventType })}
                username={username}
            />
            <div className="flex-grow space-y-4">
                <QueuePanel 
                    buildingQueue={activeBuildingQueue} 
                    shipyardQueue={activeShipyardQueue} 
                    buildingQueueCapacity={buildingQueueCapacity}
                    shipyardQueueCapacity={shipyardQueueCapacity}
                />
                {activeView === 'overview' && (
                    <OverviewPanel 
                        gameState={gameState} 
                        productions={productions} 
                        onRecallFleet={handleRecallFleet} 
                    />
                )}
                {activeView === 'buildings' && (
                    <BuildingsPanel
                        buildings={activeBuildings}
                        research={research}
                        resources={resources}
                        onUpgrade={(type) => handleAddToQueue(type, 'building')}
                        onDestroy={(type) => { /* logic */}}
                        buildQueue={activeBuildingQueue}
                        buildingQueueCapacity={buildingQueueCapacity}
                        energyEfficiency={productions.energy.efficiency}
                        isMoon={isMoon}
                        usedFields={usedFields}
                        maxFields={maxFields}
                    />
                )}
                 {activeView === 'research' && homeworld && (
                    <ResearchPanel
                        research={research}
                        buildings={homeworld.buildings}
                        resources={resources}
                        onUpgrade={(type) => handleAddToQueue(type, 'research')}
                        buildQueue={homeworld.buildingQueue}
                        buildingQueueCapacity={buildingQueueCapacity}
                    />
                )}
                 {activeView === 'fleet_upgrades' && homeworld && (
                    <FleetUpgradesPanel
                        research={research}
                        buildings={homeworld.buildings}
                        shipLevels={shipLevels}
                        resources={resources}
                        onUpgrade={(type) => handleAddToQueue(type, 'ship_upgrade')}
                        buildQueue={homeworld.buildingQueue}
                        buildingQueueCapacity={buildingQueueCapacity}
                    />
                )}
                {activeView === 'shipyard' && (
                    <ShipyardPanel 
                        research={research}
                        buildings={activeBuildings}
                        resources={resources}
                        onBuild={(type, amount) => handleAddToQueue(type, 'ship', amount)}
                        buildQueue={activeShipyardQueue}
                        fleet={activeFleet}
                        shipLevels={shipLevels}
                    />
                )}
                {activeView === 'defense' && (
                    <DefensePanel
                        research={research}
                        buildings={activeBuildings}
                        resources={resources}
                        onBuild={(type, amount) => handleAddToQueue(type, 'defense', amount)}
                        buildQueue={activeShipyardQueue}
                        defenses={activeDefenses}
                    />
                )}
                {activeView === 'fleet' && (
                    <FleetPanel 
                        fleet={activeFleet}
                        resources={resources}
                        fleetMissions={fleetMissions}
                        research={research}
                        shipLevels={shipLevels}
                        onSendFleet={handleSendFleet}
                        onRecallFleet={handleRecallFleet}
                        initialTarget={fleetTarget}
                        onClearInitialTarget={() => setFleetTarget(null)}
                        spacePlague={spacePlague}
                        solarFlare={solarFlare}
                        colonies={colonies}
                        npcStates={npcStates}
                        fleetTemplates={fleetTemplates}
                        onSaveTemplate={handleSaveTemplate}
                        onDeleteTemplate={handleDeleteTemplate}
                        activeLocationId={activeLocationId}
                        activeBoosts={activeBoosts}
                        maxFleetSlots={maxFleetSlots}
                    />
                )}
                 {activeView === 'messages' && (
                    <MessagesPanel
                        messages={messages}
                        onRead={handleReadMessage}
                        onDelete={handleDeleteMessage}
                        onDeleteAll={handleDeleteAllMessages}
                        onGhostShipChoice={(choice) => performAction('GHOST_SHIP_CHOICE', { choice }) }
                        gameState={gameState}
                        onAction={(coords, mission) => { 
                            if (mission === MissionType.SPY) {
                                setSpyModalTarget(coords);
                            } else {
                                setFleetTarget({coords, mission});
                                setActiveView('fleet');
                            }
                        }}
                    />
                )}
                {activeView === 'merchant' && merchantState.status !== MerchantStatus.INACTIVE && (
                    <MerchantPanel 
                        merchantState={merchantState}
                        resources={resources}
                        credits={credits}
                        maxResources={maxResources}
                        onTrade={handleMerchantTrade}
                        onBuyShip={handleMerchantShipPurchase}
                    />
                )}
                {activeView === 'galaxy' && (
                    <GalaxyPanel 
                         onAction={(coords, mission) => { 
                            setFleetTarget({coords, mission});
                            setActiveView('fleet');
                         }}
                         onSpy={(coords) => setSpyModalTarget(coords)}
                         onExpedition={(coords) => setExpeditionModalTargetCoords(coords)}
                         onExplore={(coords) => setExploreModalTargetCoords(coords)}
                         onHarvest={(coords, debris) => setHarvestModalTarget({ coords, debris })}
                         npcStates={npcStates}
                         debrisFields={debrisFields}
                         gameState={gameState}
                         favoritePlanets={favoritePlanets}
                         onToggleFavorite={handleToggleFavoritePlanet}
                         username={username}
                         homeworld={homeworld}
                    />
                )}
                {activeView === 'phalanx' && (
                    <PhalanxPanel 
                        gameState={gameState}
                        onScan={handlePhalanxScan}
                    />
                )}
                {activeView === 'alliance' && (
                    <AlliancePanel 
                        alliance={alliance} 
                        onCreate={handleCreateAlliance}
                        onLeave={handleLeaveAlliance}
                    />
                )}
            </div>
        </main>
        {spyModalTarget && (
            <SpyModal
                targetCoords={spyModalTarget}
                availableProbes={availableProbesOnActiveLocation}
                research={research}
                activeLocationId={activeLocationId}
                resources={resources}
                onSend={handleSendSpyMission}
                onClose={() => setSpyModalTarget(null)}
            />
        )}
        {expeditionModalTargetCoords && (
            <ExpeditionModal
                targetCoords={expeditionModalTargetCoords}
                fleet={activeFleet}
                resources={resources}
                research={research}
                shipLevels={shipLevels}
                activeLocationId={activeLocationId}
                activeBoosts={activeBoosts}
                onSend={handleSendExpeditionMission}
                onClose={() => setExpeditionModalTargetCoords(null)}
            />
        )}
        {exploreModalTargetCoords && (
            <ExploreModal
                targetCoords={exploreModalTargetCoords}
                fleet={activeFleet}
                resources={resources}
                research={research}
                shipLevels={shipLevels}
                activeLocationId={activeLocationId}
                activeBoosts={activeBoosts}
                onSend={handleSendExploreMission}
                onClose={() => setExploreModalTargetCoords(null)}
            />
        )}
        {harvestModalTarget && (
            <HarvestModal
                targetCoords={harvestModalTarget.coords}
                debrisField={harvestModalTarget.debris}
                availableRecyclers={availableRecyclersOnActiveLocation}
                research={research}
                activeLocationId={activeLocationId}
                resources={resources}
                onSend={handleSendHarvestMission}
                onClose={() => setHarvestModalTarget(null)}
            />
        )}
        {isInfoModalOpen && (
            <InfoModal
                onClose={() => setIsInfoModalOpen(false)}
                onResetGame={handleResetGame}
            />
        )}
        {isEncyclopediaOpen && (
            <EncyclopediaModal
                onClose={() => setIsEncyclopediaOpen(false)}
            />
        )}
        {notification && (
            <div className="fixed bottom-5 right-5 bg-cyan-600 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in-out z-50">
                {notification}
            </div>
        )}
         {ancientArtifactState.status === AncientArtifactStatus.AWAITING_CHOICE && (
            <AncientArtifactModal onChoice={(choice) => performAction('ANCIENT_ARTIFACT_CHOICE', { choice })} />
        )}
        {contrabandState.status === ContrabandStatus.ACTIVE && (
            <ContrabandModal 
                contrabandState={contrabandState} 
                resources={resources}
                credits={credits}
                npcStates={npcStates}
                onDeal={(accepted) => performAction('CONTRABAND_DEAL', { accepted })} 
            />
        )}
        {isInventoryOpen && (
            <InventoryModal 
                inventory={inventory}
                onActivateBoost={(boostId) => {
                    performAction('ACTIVATE_BOOST', { boostId });
                    setIsInventoryOpen(false);
                }}
                onClose={() => setIsInventoryOpen(false)}
            />
        )}
    </div>
  );
}

export default App;