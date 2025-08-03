import React, { useState, useEffect, useMemo } from 'react';
import { Message, InfoMessage, SpyReport, BattleReport, MerchantStatus, MerchantInfoMessage, EspionageEventMessage, Loot, PirateMessage, PirateMercenaryStatus, ShipType, AsteroidImpactMessage, AsteroidImpactType, BuildingType, ResourceVeinMessage, AncientArtifactMessage, AncientArtifactChoice, ResearchType, SpacePlagueMessage, OfflineSummaryMessage, ExpeditionMessage, ExpeditionOutcomeType, ColonizationMessage, BattleMessage, SpyMessage, ExplorationMessage, ExplorationOutcomeType, BoostType, Boost, Resources, SolarFlareMessage, SolarFlareStatus, ContrabandMessage, MoonCreationMessage, PlanetSpecialization, GhostShipDiscoveryMessage, GhostShipOutcomeMessage, GhostShipChoice, GalacticGoldRushMessage, StellarAuroraMessage, MissionType } from '../types';
import { ALL_GAME_OBJECTS, BUILDING_DATA, RESEARCH_DATA, ALL_SHIP_DATA } from '../constants';

interface MessagesPanelProps {
    messages: Message[];
    onRead: (messageId: string) => void;
    onDelete: (messageId: string) => void;
    onDeleteAll: () => void;
    onGhostShipChoice: (choice: GhostShipChoice) => void;
    onAction: (targetCoords: string, missionType: MissionType) => void;
}

type MessageCategory = 'all' | 'spy' | 'battle' | 'mission';

const formatNumber = (num: number) => Math.floor(num).toLocaleString('pl-PL');
const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

const ReportSection: React.FC<{ title: string, data: object | undefined, emptyText: string }> = ({ title, data, emptyText }) => {
    if (!data || Object.keys(data).length === 0 || Object.values(data).every(v => v === 0)) {
        return (
            <div>
                <h4 className="font-bold text-cyan-400 border-b border-gray-600 pb-1 mb-2">{title}</h4>
                <p className="text-gray-400">{emptyText}</p>
            </div>
        );
    }

    return (
        <div>
            <h4 className="font-bold text-cyan-400 border-b border-gray-600 pb-1 mb-2">{title}</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                {Object.entries(data).map(([id, value]) => {
                    const info = ALL_GAME_OBJECTS[id as keyof typeof ALL_GAME_OBJECTS];
                    if (!info || !value) return null;
                    return <span key={id}>{info.name}: {formatNumber(value)}</span>
                })}
            </div>
        </div>
    )
}

const LootDisplay: React.FC<{ loot: Loot }> = ({ loot }) => {
    const hasLoot = (loot.metal || 0) > 0 || (loot.crystal || 0) > 0 || (loot.deuterium || 0) > 0 || (loot.credits || 0) > 0;
    if (!hasLoot) {
        return <p className="text-gray-400">Nie zgrabiono żadnych surowców.</p>
    }
    return (
        <div className="grid grid-cols-2 gap-2">
            {loot.metal && loot.metal > 0 ? <span>🔩 Metal: {formatNumber(loot.metal)}</span> : null}
            {loot.crystal && loot.crystal > 0 ? <span>💎 Kryształ: {formatNumber(loot.crystal)}</span> : null}
            {loot.deuterium && loot.deuterium > 0 ? <span>💧 Deuter: {formatNumber(loot.deuterium)}</span> : null}
            {loot.credits && loot.credits > 0 ? <span>💰 Kredyty: {formatNumber(loot.credits)}</span> : null}
        </div>
    );
};

const SpyReportDisplay: React.FC<{ report: SpyReport, onAction: (coords: string, mission: MissionType) => void }> = ({ report, onAction }) => {
    return (
        <div className="space-y-4 text-sm">
            <div>
                <h4 className="font-bold text-cyan-400 border-b border-gray-600 pb-1 mb-2">Surowce</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <span>🔩 Metal: {formatNumber(report.resources.metal || 0)}</span>
                    <span>💎 Kryształ: {formatNumber(report.resources.crystal || 0)}</span>
                    <span>💧 Deuter: {formatNumber(report.resources.deuterium || 0)}</span>
                    <span>🔋 Energia: {formatNumber(report.resources.energy || 0)}</span>
                </div>
            </div>
             <ReportSection title="Flota" data={report.fleet} emptyText="Brak floty." />
             <ReportSection title="Obrona" data={report.defenses} emptyText="Brak obrony." />
             <ReportSection title="Budynki" data={report.buildings} emptyText="Nie wykryto budynków." />
             <ReportSection title="Badania" data={report.research} emptyText="Nie wykryto badań." />
            <div className="flex items-center gap-4 border-t border-gray-700 pt-3 mt-4">
                <span className="text-gray-300 font-semibold">Szybkie akcje:</span>
                <button
                    onClick={() => onAction(report.targetCoords, MissionType.ATTACK)}
                    className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded-md text-xs font-bold transition-transform transform hover:scale-105"
                >
                    Atakuj
                </button>
                <button
                    onClick={() => onAction(report.targetCoords, MissionType.SPY)}
                    className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 rounded-md text-xs font-bold transition-transform transform hover:scale-105"
                >
                    Szpieguj ponownie
                </button>
            </div>
        </div>
    );
};

const BattleReportDisplay: React.FC<{ report: BattleReport }> = ({ report }) => {
    const { 
        attackerName, defenderName, attackerFleet, defenderFleet, defenderDefenses, 
        attackerLosses, defenderLosses, defenderDefensesLosses, loot, debrisCreated, winner
    } = report;

    const [detailedView, setDetailedView] = useState(false);
    const hasDebris = (debrisCreated?.metal || 0) > 0 || (debrisCreated?.crystal || 0) > 0;

    let resultText = '';
    let resultColor = 'text-yellow-400';
    
    // Assuming isPlayerAttacker is true from the player's perspective when receiving this report
    if (winner === 'attacker') {
        resultText = '(Wygrana)';
        resultColor = 'text-green-400';
    } else if (winner === 'defender') {
        resultText = '(Przegrana)';
        resultColor = 'text-red-400';
    } else {
        resultText = '(Remis)';
    }

    return (
        <div className="space-y-6 text-sm">
             <div className="flex justify-between items-center">
                <p className="text-gray-300">
                    Flota gracza <span className="font-bold text-red-400">{attackerName}</span> zaatakowała planetę gracza <span className="font-bold text-green-400">{defenderName}</span>.
                </p>
                <span className={`text-lg font-bold ${resultColor}`}>{resultText}</span>
            </div>
            
            {/* Attacker */}
            <div className="p-3 bg-red-900 bg-opacity-20 rounded-lg">
                <h3 className="text-lg font-bold text-red-300 mb-2">Atakujący: {attackerName}</h3>
                <div className="space-y-4">
                    <ReportSection title="Flota przed bitwą" data={attackerFleet} emptyText="Brak floty."/>
                    <ReportSection title="Poniesione straty" data={attackerLosses} emptyText="Brak strat."/>
                </div>
            </div>

            {/* Defender */}
            <div className="p-3 bg-green-900 bg-opacity-20 rounded-lg">
                <h3 className="text-lg font-bold text-green-300 mb-2">Obrońca: {defenderName}</h3>
                <div className="space-y-4">
                    <ReportSection title="Flota przed bitwą" data={defenderFleet} emptyText="Brak floty na orbicie."/>
                    <ReportSection title="Obrona przed bitwą" data={defenderDefenses} emptyText="Brak struktur obronnych."/>
                    <ReportSection title="Straty floty" data={defenderLosses} emptyText="Brak strat."/>
                    <ReportSection title="Straty obrony" data={defenderDefensesLosses} emptyText="Brak strat."/>
                </div>
            </div>

            {/* Loot */}
            <div>
                 <h4 className="font-bold text-cyan-400 border-b border-gray-600 pb-1 mb-2">Zgrabione surowce</h4>
                 <LootDisplay loot={loot} />
            </div>
            
            {/* Debris */}
            {hasDebris && (
                 <div>
                    <h4 className="font-bold text-yellow-300 border-b border-gray-600 pb-1 mb-2">Pole Zniszczeń ♻️</h4>
                    <p className="text-gray-400">
                        Pole zniszczeń zawiera: 
                        <span className="mx-2">🔩 Metal: {formatNumber(debrisCreated.metal || 0)}</span>
                        <span className="mx-2">💎 Kryształ: {formatNumber(debrisCreated.crystal || 0)}</span>.
                        Możesz je zebrać za pomocą Recyklerów.
                    </p>
                 </div>
            )}

            {/* Detailed Report Button & Section */}
            <div className="pt-4 border-t border-gray-700">
                <button
                    onClick={() => setDetailedView(!detailedView)}
                    className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-md text-sm font-bold transition-transform transform hover:scale-105"
                >
                    {detailedView ? 'Ukryj Szczegółowy Raport' : 'Pokaż Szczegółowy Raport'}
                </button>

                {detailedView && (
                    <div className="mt-4 space-y-4">
                        {report.rounds && report.rounds.length > 0 ? (
                            report.rounds.map(round => (
                                <div key={round.roundNumber} className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                                    <h4 className="text-lg font-bold text-cyan-300 border-b border-gray-600 pb-2 mb-3">Runda {round.roundNumber}</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                        {/* Attacker column */}
                                        <div className="space-y-3">
                                            <h5 className="font-semibold text-red-400">Atakujący</h5>
                                            <p>💥 Siła ataku: <span className="font-mono">{formatNumber(round.attackerTotalAttackPower)}</span></p>
                                            <p>🛡️ Siła tarcz: <span className="font-mono">{formatNumber(round.attackerTotalShieldPower)}</span></p>
                                            <ReportSection title="Flota na początku rundy" data={round.attackerFleetState} emptyText="Brak floty"/>
                                            <ReportSection title="Straty w tej rundzie" data={round.attackerLossesThisRound} emptyText="Brak strat"/>
                                        </div>
                                        {/* Defender column */}
                                        <div className="space-y-3">
                                            <h5 className="font-semibold text-green-400">Obrońca</h5>
                                            <p>💥 Siła ataku: <span className="font-mono">{formatNumber(round.defenderTotalAttackPower)}</span></p>
                                            <p>🛡️ Siła tarcz: <span className="font-mono">{formatNumber(round.defenderTotalShieldPower)}</span></p>
                                            <ReportSection title="Flota na początku rundy" data={round.defenderFleetState} emptyText="Brak floty"/>
                                            <ReportSection title="Obrona na początku rundy" data={round.defenderDefenseState} emptyText="Brak obrony"/>
                                            <ReportSection title="Straty floty w tej rundzie" data={round.defenderLossesThisRound} emptyText="Brak strat"/>
                                            <ReportSection title="Straty obrony w tej rundzie" data={round.defenderDefenseLossesThisRound} emptyText="Brak strat"/>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="mt-4 bg-gray-900 p-4 rounded-lg border border-gray-700 text-center text-gray-400">
                                Bitwa zakończyła się bez walki, ponieważ obrońca nie posiadał żadnych sił.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const MerchantInfoDisplay: React.FC<{ message: MerchantInfoMessage }> = ({ message }) => {
    let text = '';
    let detail = '';

    switch (message.merchantStatus) {
        case MerchantStatus.INCOMING:
            text = `Wykryto sygnaturę kupca. Przybędzie za jakiś czas.`;
            if (message.hasShipOffer === true) {
                detail = `Nasze skanery dalekiego zasięgu wskazują, że w jego ładowniach znajdują się statki na sprzedaż!`;
            } else if (message.hasShipOffer === false) {
                detail = `Wygląda na to, że tym razem będzie handlował wyłącznie surowcami.`;
            }
            break;
        case MerchantStatus.ACTIVE:
            text = `Wędrowny kupiec przybył na Twoją orbitę. Pozostanie tu przez jakiś czas, oferując swoje towary.`;
            break;
        case MerchantStatus.INACTIVE: // This means it just departed
            text = `Kupiec opuścił Twoją orbitę.`;
            break;
    }
    return (
        <div>
            <p>{text}</p>
            {detail && <p className="mt-2 text-yellow-300">{detail}</p>}
        </div>
    );
};

const EspionageEventDisplay: React.FC<{ message: EspionageEventMessage }> = ({ message }) => {
    return <p>Twoja planeta została wyszpiegowana przez flotę z koordynatów <span className="font-bold text-yellow-400">[{message.spyCoords}]</span>. Napastnik jest znany jako <span className="font-bold text-red-400">{message.spyName || 'Nieznany'}</span>.</p>
};

const PirateMessageDisplay: React.FC<{ message: PirateMessage }> = ({ message }) => {
    const { pirateState } = message;
    let text = '';
    switch (pirateState.status) {
        case PirateMercenaryStatus.INCOMING:
            text = `Wykryto sygnaturę floty piratów-najemników. Zbliżają się do Twojego systemu.`;
            break;
        case PirateMercenaryStatus.AVAILABLE:
            text = `Piraci-najemnicy przybyli i oferują swoje usługi. Ich oferta jest ograniczona czasowo.`;
            break;
        case PirateMercenaryStatus.DEPARTED:
             text = `Oferta najemników wygasła i odlecieli w poszukiwaniu innych klientów.`;
            break;
    }
    return <p>{text}</p>;
};

const AsteroidImpactDisplay: React.FC<{ message: AsteroidImpactMessage }> = ({ message }) => {
    if (message.impactType === AsteroidImpactType.DAMAGE && message.details.buildingId) {
        const buildingName = BUILDING_DATA[message.details.buildingId].name;
        return <p>Uderzenie asteroidy uszkodziło Twój budynek: <span className="font-bold text-red-400">{buildingName}</span>. Został on zdegradowany do poziomu {message.details.newLevel}.</p>;
    }
    if (message.impactType === AsteroidImpactType.BONUS && message.details.resourceType) {
        const resourceName = message.details.resourceType === 'metal' ? 'Metalu' : 'Kryształu';
        return <p>Deszcz meteorytów wzbogacił Twoją planetę! Otrzymano bonus: <span className="font-bold text-green-400">+{formatNumber(message.details.amount || 0)} {resourceName}</span>.</p>;
    }
    return <p>Wykryto zjawisko astronomiczne w pobliżu planety.</p>;
};

const ResourceVeinDisplay: React.FC<{ message: ResourceVeinMessage }> = ({ message }) => {
    const resourceNameMap: Record<keyof Resources, string> = { metal: 'Metalu', crystal: 'Kryształu', deuterium: 'Deuteru', energy: 'Energii' };
    const resourceName = resourceNameMap[message.resourceType];
    if (message.status === 'activated') {
        return <p>Odkryto bogatą żyłę <span className="font-bold text-yellow-400">{resourceName}</span>! Produkcja wzrosła o 25% na 24 godziny.</p>;
    } else {
        return <p>Premia do wydobycia <span className="font-bold text-yellow-400">{resourceName}</span> wygasła. Produkcja wróciła do normy.</p>;
    }
};

const AncientArtifactDisplay: React.FC<{ message: AncientArtifactMessage }> = ({ message }) => {
    const { choice, outcome } = message;
    switch (choice) {
        case AncientArtifactChoice.STUDY:
            if (outcome.success && outcome.technology) {
                const techName = RESEARCH_DATA[outcome.technology].name;
                return <p>Twoi naukowcy z sukcesem zbadali artefakt! <span className="font-bold text-green-400">Technologia {techName} została ulepszona do poziomu {outcome.newLevel}!</span></p>;
            }
            return <p>Niestety, artefakt okazał się zbyt skomplikowany. Twoi naukowcy nie zdołali niczego odkryć, a surowce przepadły.</p>;
        case AncientArtifactChoice.SELL:
            return <p>Sprzedano artefakt na czarnym rynku za <span className="font-bold text-yellow-400">{formatNumber(outcome.creditsGained || 0)}💰</span>. Dobry interes!</p>;
        case AncientArtifactChoice.IGNORE:
            return <p>Postanowiono zignorować artefakt, zakopując go głęboko. Kto wie, jakie tajemnice skrywał...</p>;
    }
    return null;
};

const SpacePlagueDisplay: React.FC<{ message: SpacePlagueMessage }> = ({ message }) => {
    const shipName = ALL_SHIP_DATA[message.infectedShip].name;
    if (message.status === 'activated') {
        return <p>Wykryto kosmiczną zarazę! Twoje statki typu <span className="font-bold text-red-400">{shipName}</span> zostały zainfekowane. Ich siła ataku jest tymczasowo zmniejszona.</p>;
    } else {
        return <p>Dobra wiadomość! Zaraza na statkach typu <span className="font-bold text-green-400">{shipName}</span> została zwalczona. Ich siła wróciła do normy.</p>;
    }
};

const SolarFlareDisplay: React.FC<{ message: SolarFlareMessage }> = ({ message }) => {
    if (message.isEndMessage) {
        let text = 'Wydarzenie słoneczne zakończone.';
        if (message.status === SolarFlareStatus.POWER_BOOST) {
            text = 'Rozbłysk słoneczny zakończył się. Produkcja energii wróciła do normy.';
        } else if (message.status === SolarFlareStatus.DISRUPTION) {
            text = 'Zakłócenia elektromagnetyczne minęły. Tarcze i systemy szpiegowskie działają normalnie.';
        }
        return <p>{text}</p>;
    }

    if (message.status === SolarFlareStatus.POWER_BOOST) {
        return <p>Potężny rozbłysk słoneczny naładował Twoje panele! <span className="font-bold text-green-400">Produkcja energii z Elektrowni Słonecznych wzrosła o 50% na 12 godzin.</span></p>;
    }
    if (message.status === SolarFlareStatus.DISRUPTION) {
        return <p>Rozbłysk słoneczny spowodował poważne zakłócenia elektromagnetyczne! <span className="font-bold text-red-400">Wszystkie tarcze ochronne są wyłączone, a misje szpiegowskie niemożliwe do wykonania przez 1 godzinę.</span></p>;
    }
    return <p>Wykryto potężny rozbłysk słoneczny w Twoim systemie.</p>;
};

const ContrabandDisplay: React.FC<{ message: ContrabandMessage }> = ({ message }) => {
    return <p>{message.outcomeText}</p>;
};

const OfflineSummaryDisplay: React.FC<{ message: OfflineSummaryMessage }> = ({ message }) => {
    return (
        <div>
            <p className="mb-2">Podczas Twojej nieobecności (<span className="font-bold">{formatTime(message.duration)}</span>) miały miejsce następujące wydarzenia:</p>
            {message.events.length > 0 ? (
                <ul className="list-disc list-inside text-sm space-y-1 text-gray-400">
                    {message.events.map((event, index) => <li key={index}>{event}</li>)}
                </ul>
            ) : (
                <p className="text-gray-400">Wszystko przebiegało spokojnie.</p>
            )}
        </div>
    );
};

const ExpeditionDisplay: React.FC<{ message: ExpeditionMessage }> = ({ message }) => {
    const { outcome, details } = message;

    const outcomeText = {
        [ExpeditionOutcomeType.FIND_RESOURCES]: 'Twoja flota natrafiła na opuszczony wrak i odzyskała surowce!',
        [ExpeditionOutcomeType.FIND_MONEY]: 'Twoi zwiadowcy znaleźli starożytny skarbiec z kredytami!',
        [ExpeditionOutcomeType.FIND_FLEET]: 'Odnaleziono porzucone, ale wciąż sprawne statki, które dołączyły do Twojej floty!',
        [ExpeditionOutcomeType.NOTHING]: 'Wyprawa nie przyniosła żadnych rezultatów. Twoja flota wraca z pustymi rękami.',
        [ExpeditionOutcomeType.PIRATES]: 'Twoja flota wpadła w zasadzkę piratów! Po krótkiej walce udało się uciec, ale poniesiono straty.',
        [ExpeditionOutcomeType.ALIENS]: 'Napotkano wrogą cywilizację obcych! Flota ledwo uszła z życiem, ponosząc ciężkie straty.',
        [ExpeditionOutcomeType.DELAY]: 'Niespodziewana burza kosmiczna spowolniła Twoją flotę. Jej powrót opóźni się.',
        [ExpeditionOutcomeType.LOST]: 'Tragiczne wieści. Kontakt z flotą został utracony. Uznaje się ją za zaginioną w akcji.',
    };

    return (
        <div className="space-y-4">
            <p>{outcomeText[outcome]}</p>
            {details.resourcesGained && <div className="p-2 bg-gray-700 rounded"><h5 className="font-bold text-cyan-300">Zyskane surowce:</h5><LootDisplay loot={details.resourcesGained} /></div>}
            {details.creditsGained && <div className="p-2 bg-gray-700 rounded"><h5 className="font-bold text-cyan-300">Zyskane kredyty:</h5><LootDisplay loot={{ credits: details.creditsGained }} /></div>}
            {details.fleetGained && <div className="p-2 bg-gray-700 rounded"><ReportSection title="Odzyskana flota" data={details.fleetGained} emptyText=""/></div>}
            {details.fleetLost && <div className="p-2 bg-red-900 bg-opacity-30 rounded"><ReportSection title="Poniesione straty" data={details.fleetLost} emptyText=""/></div>}
            {details.delaySeconds && <p className="text-yellow-400">Opóźnienie powrotu o około: {formatTime(details.delaySeconds)}.</p>}
        </div>
    );
};

const getSpecializationText = (specialization: PlanetSpecialization | undefined) => {
    switch (specialization) {
        case PlanetSpecialization.ENERGY_BOOST:
            return 'Planeta charakteryzuje się wysoką aktywnością geotermalną, zapewniając stały bonus +15% do produkcji energii.';
        case PlanetSpecialization.DEUTERIUM_BOOST:
            return 'Na planecie odkryto bogate złoża lodu deuterowego, co zapewnia bonus +10% do wydobycia deuteru.';
        default:
            return 'Planeta ma standardowe warunki do życia i produkcji.';
    }
}

const ColonizationDisplay: React.FC<{ message: ColonizationMessage }> = ({ message }) => {
    if (message.success) {
        return (
            <div>
                <p>Twoja misja zakończyła się sukcesem! <span className="font-bold text-green-400">Nowa kolonia została założona na [{message.coords}]!</span></p>
                <p className="mt-2 text-sm text-gray-400">{getSpecializationText(message.specialization)}</p>
            </div>
        );
    }
    return <p>Niestety, misja kolonizacyjna na [{message.coords}] nie powiodła się. Planeta jest już zamieszkana lub nie nadaje się do życia.</p>;
};

const MoonCreationDisplay: React.FC<{ message: MoonCreationMessage }> = ({ message }) => {
    return (
        <div>
            <p>Ogromne siły grawitacyjne powstałe po bitwie na <span className="font-bold text-cyan-300">[{message.coords}]</span> skupiły pole zniszczeń, tworząc... księżyc!</p>
            <p className="text-sm text-gray-400 mt-2">Szansa na to wydarzenie wynosiła {message.chance.toFixed(2)}% przy polu zniszczeń o wielkości {formatNumber(message.debrisSize)}.</p>
        </div>
    )
}

const ExplorationDisplay: React.FC<{ message: ExplorationMessage }> = ({ message }) => {
    const { outcome, details } = message;

    const outcomeText = {
        [ExplorationOutcomeType.FIND_RESOURCES]: `Twoja ekipa badawcza na [${details.targetCoords}] odkryła złoża surowców!`,
        [ExplorationOutcomeType.FIND_BOOST]: `W starożytnych ruinach na [${details.targetCoords}] odnaleziono działający moduł ulepszeń!`,
        [ExplorationOutcomeType.FIND_SHIP_WRECK]: `Natrafiono na wrak statku na [${details.targetCoords}]. Odzyskano z niego kilka sprawnych jednostek.`,
        [ExplorationOutcomeType.NOTHING]: `Eksploracja [${details.targetCoords}] nie przyniosła żadnych rezultatów.`,
        [ExplorationOutcomeType.HOSTILES]: `Twoja ekipa badawcza na [${details.targetCoords}] została zaatakowana przez lokalną, wrogą formę życia!`,
    };

    return (
        <div className="space-y-4">
            <p>{outcomeText[outcome]}</p>
            {details.resourcesGained && <div className="p-2 bg-gray-700 rounded"><h5 className="font-bold text-cyan-300">Zyskane surowce:</h5><LootDisplay loot={details.resourcesGained} /></div>}
            {details.fleetGained && <div className="p-2 bg-gray-700 rounded"><ReportSection title="Odzyskana flota" data={details.fleetGained} emptyText=""/></div>}
            {details.fleetLost && <div className="p-2 bg-red-900 bg-opacity-30 rounded"><ReportSection title="Poniesione straty" data={details.fleetLost} emptyText=""/></div>}
            {details.foundBoost && <p className="text-green-400 font-bold">Otrzymano bonus: {details.foundBoost.type}. Sprawdź swój inwentarz!</p>}
        </div>
    );
};

const GhostShipDiscoveryDisplay: React.FC<{ message: GhostShipDiscoveryMessage, onGhostShipChoice: (choice: GhostShipChoice) => void }> = ({ message, onGhostShipChoice }) => {
    return (
        <div>
            <p>Twoje czujniki dalekiego zasięgu wykryły potężną anomalię na koordynatach <span className="font-bold text-yellow-300">[{message.locationCoords}]</span>. Identyfikacja wskazuje na wrak <span className="font-bold text-cyan-400">{ALL_SHIP_DATA[message.shipType].name}</span>.</p>
            <p className="mt-2">Wysłanie ekipy badawczej jest ryzykowne, ale może przynieść korzyści. Co robisz?</p>
            <div className="flex gap-4 mt-4">
                <button onClick={() => onGhostShipChoice(GhostShipChoice.INVESTIGATE)} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-white font-bold">Zbadaj wrak</button>
                <button onClick={() => onGhostShipChoice(GhostShipChoice.IGNORE)} className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-white font-bold">Zignoruj</button>
            </div>
        </div>
    )
}

const GhostShipOutcomeDisplay: React.FC<{ message: GhostShipOutcomeMessage }> = ({ message }) => {
    const { outcome } = message;
    return (
        <div>
            <p className="mb-4">{outcome.text}</p>
            {outcome.resourcesGained && <div className="p-2 bg-gray-700 rounded"><h5 className="font-bold text-cyan-300">Zyskane surowce:</h5><LootDisplay loot={outcome.resourcesGained} /></div>}
            {outcome.technologyGained && <p className="text-green-400 font-bold">Otrzymano bonus technologiczny!</p>}
            {outcome.battleReport && <BattleReportDisplay report={outcome.battleReport} />}
        </div>
    );
};


const GalacticGoldRushDisplay: React.FC<{ message: GalacticGoldRushMessage }> = ({ message }) => {
    if (message.status === 'activated') {
        return <p>W całym znanym wszechświecie ogłoszono Galaktyczną Gorączkę Złota! <span className="font-bold text-yellow-300">Przez następne 24 godziny misje ekspedycyjne mają znacznie większą szansę na znalezienie cennych surowców i innych skarbów.</span></p>;
    }
    return <p>Galaktyczna Gorączka Złota dobiegła końca. Szanse na znaleziska w ekspedycjach wróciły do normy.</p>;
};

const StellarAuroraDisplay: React.FC<{ message: StellarAuroraMessage }> = ({ message }) => {
     if (message.status === 'activated') {
        return <p>Niezwykła zorza gwiezdna pojawiła się w Twoim systemie! <span className="font-bold text-cyan-300">Przez następne {message.durationHours} godzin produkcja energii z Elektrowni Słonecznych jest zwiększona o 30%!</span></p>;
    }
    return <p>Zorza Gwiezdna wygasła, a produkcja energii wróciła do normy.</p>;
}


const MessageContent: React.FC<{ message: Message, onDelete: (id: string) => void, onGhostShipChoice: (choice: GhostShipChoice) => void, onAction: (targetCoords: string, missionType: MissionType) => void }> = ({ message, onDelete, onGhostShipChoice, onAction }) => {
    const renderContent = () => {
        switch (message.type) {
            case 'info': return <p>{message.text}</p>;
            case 'spy': return <SpyReportDisplay report={message.report} onAction={onAction} />;
            case 'battle': return <BattleReportDisplay report={message.report} />;
            case 'merchant': return <MerchantInfoDisplay message={message} />;
            case 'espionage_event': return <EspionageEventDisplay message={message} />;
            case 'pirate': return <PirateMessageDisplay message={message} />;
            case 'asteroid_impact': return <AsteroidImpactDisplay message={message} />;
            case 'resource_vein': return <ResourceVeinDisplay message={message} />;
            case 'ancient_artifact': return <AncientArtifactDisplay message={message} />;
            case 'space_plague': return <SpacePlagueDisplay message={message} />;
            case 'solar_flare': return <SolarFlareDisplay message={message} />;
            case 'contraband': return <ContrabandDisplay message={message} />;
            case 'offline_summary': return <OfflineSummaryDisplay message={message} />;
            case 'expedition': return <ExpeditionDisplay message={message} />;
            case 'colonization': return <ColonizationDisplay message={message} />;
            case 'moon_creation': return <MoonCreationDisplay message={message} />;
            case 'exploration': return <ExplorationDisplay message={message} />;
            case 'ghost_ship_discovery': return <GhostShipDiscoveryDisplay message={message} onGhostShipChoice={onGhostShipChoice} />;
            case 'ghost_ship_outcome': return <GhostShipOutcomeDisplay message={message} />;
            case 'galactic_gold_rush': return <GalacticGoldRushDisplay message={message} />;
            case 'stellar_aurora': return <StellarAuroraDisplay message={message} />;
            default: return <p>Nieznany typ wiadomości.</p>;
        }
    };
    
    const isSpyReport = message.type === 'spy';
    const match = isSpyReport ? message.subject.match(/(\[.+?\])/) : null;
    const coordsText = match ? match[1] : null;
    const subjectPrefix = coordsText ? message.subject.split(coordsText)[0] : message.subject;
    const spyTargetCoords = isSpyReport ? (message as SpyMessage).report.targetCoords : null;


    return (
        <div className="bg-gray-900 bg-opacity-50 p-4 rounded-lg h-full flex flex-col">
            <div className="flex justify-between items-center border-b border-gray-700 pb-3 mb-4">
                <div>
                    <h3 className="text-xl font-bold text-white">
                        {subjectPrefix}
                        {coordsText && spyTargetCoords && (
                             <button
                                onClick={() => onAction(spyTargetCoords, MissionType.ATTACK)}
                                className="text-xl font-bold text-cyan-400 hover:text-cyan-300 hover:underline"
                                title={`Atakuj ${coordsText}`}
                            >
                                {coordsText}
                            </button>
                        )}
                    </h3>
                    <p className="text-xs text-gray-500">{new Date(message.timestamp).toLocaleString()}</p>
                </div>
                <button onClick={() => onDelete(message.id)} className="px-3 py-1 bg-red-800 text-xs font-bold rounded hover:bg-red-700">Usuń</button>
            </div>
            <div className="flex-grow overflow-y-auto pr-2 text-gray-300">
                {renderContent()}
            </div>
        </div>
    )
};

const MessageListItem: React.FC<{ message: Message, isSelected: boolean, onSelect: (message: Message) => void }> = ({ message, isSelected, onSelect }) => {
    const bgColor = isSelected ? 'bg-cyan-900 bg-opacity-40' : 'bg-gray-800 hover:bg-gray-700';
    const fontWeight = message.isRead ? 'font-normal' : 'font-bold';

    return (
        <div onClick={() => onSelect(message)} className={`p-3 mb-2 rounded-lg cursor-pointer transition-colors duration-200 border-l-4 ${isSelected ? 'border-cyan-400' : 'border-transparent'}`}>
            <p className={`text-white truncate ${fontWeight}`}>{message.subject}</p>
            <p className="text-xs text-gray-500">{new Date(message.timestamp).toLocaleString()}</p>
        </div>
    )
}

const filterMessages = (messages: Message[], category: MessageCategory): Message[] => {
    switch (category) {
        case 'spy':
            return messages.filter(m => m.type === 'spy' || m.type === 'espionage_event');
        case 'battle':
            return messages.filter(m => m.type === 'battle');
        case 'mission':
            return messages.filter(m => 
                m.type === 'expedition' || 
                m.type === 'exploration' || 
                m.type === 'colonization' ||
                m.type === 'ghost_ship_outcome' ||
                (m.type === 'info' && (
                    m.subject.startsWith('Powrót floty') ||
                    m.subject.startsWith('Zebrano pole zniszczeń') ||
                    m.subject.startsWith('Kontakt z Wyprawą')
                ))
            );
        case 'all':
        default:
            return messages;
    }
};

const MessagesPanel: React.FC<MessagesPanelProps> = ({ messages, onRead, onDelete, onDeleteAll, onGhostShipChoice, onAction }) => {
    const [activeCategory, setActiveCategory] = useState<MessageCategory>('all');
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

    const filteredMessages = useMemo(() => filterMessages(messages, activeCategory), [messages, activeCategory]);
    
    useEffect(() => {
        if (!selectedMessage && filteredMessages.length > 0) {
            setSelectedMessage(filteredMessages[0]);
        } else if (selectedMessage && !filteredMessages.some(m => m.id === selectedMessage.id)) {
            setSelectedMessage(filteredMessages.length > 0 ? filteredMessages[0] : null);
        }
    }, [filteredMessages, selectedMessage]);
    
    useEffect(() => {
        if(selectedMessage && !selectedMessage.isRead) {
            onRead(selectedMessage.id);
        }
    }, [selectedMessage, onRead]);

    const handleSelectMessage = (message: Message) => {
        setSelectedMessage(message);
    };
    
    const messageCounts = useMemo(() => {
        return {
            all: messages.length,
            spy: messages.filter(m => m.type === 'spy' || m.type === 'espionage_event').length,
            battle: messages.filter(m => m.type === 'battle').length,
            mission: messages.filter(m => 
                m.type === 'expedition' || 
                m.type === 'exploration' || 
                m.type === 'colonization' ||
                m.type === 'ghost_ship_outcome' ||
                (m.type === 'info' && (
                    m.subject.startsWith('Powrót floty') ||
                    m.subject.startsWith('Zebrano pole zniszczeń') ||
                    m.subject.startsWith('Kontakt z Wyprawą')
                ))
            ).length,
        };
    }, [messages]);

    const TABS: { id: MessageCategory, label: string, count: number }[] = [
        { id: 'all', label: 'Wszystkie', count: messageCounts.all },
        { id: 'spy', label: 'Raporty Szpiegujące', count: messageCounts.spy },
        { id: 'battle', label: 'Raporty Bojowe', count: messageCounts.battle },
        { id: 'mission', label: 'Raporty z Misji', count: messageCounts.mission },
    ];

    return (
        <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-4 md:p-6">
            <div className="flex justify-between items-center mb-4 border-b-2 border-cyan-800 pb-3">
                <h2 className="text-2xl font-bold text-cyan-300">Skrzynka Odbiorcza</h2>
                <button onClick={() => { if (window.confirm('Czy na pewno chcesz usunąć wszystkie wiadomości?')) onDeleteAll(); }} className="px-3 py-1 bg-red-800 text-xs font-bold rounded hover:bg-red-700">Usuń Wszystkie</button>
            </div>
            
            <div className="flex mb-6 border-b border-gray-600">
                {TABS.map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveCategory(tab.id)}
                        className={`relative px-4 py-2 text-base font-semibold transition-colors duration-200 -mb-px border-b-2
                            ${activeCategory === tab.id
                                ? 'text-cyan-300 border-cyan-400'
                                : 'text-gray-400 border-transparent hover:text-white hover:border-gray-500'
                            }`}
                    >
                        {tab.label}
                        {tab.count > 0 && <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-cyan-100 bg-cyan-800 rounded-full">{tab.count}</span>}
                    </button>
                ))}
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-1/3 border-r border-gray-700 pr-4 max-h-[75vh] overflow-y-auto">
                    {filteredMessages.map(msg => (
                        <MessageListItem key={msg.id} message={msg} isSelected={selectedMessage?.id === msg.id} onSelect={handleSelectMessage} />
                    ))}
                    {filteredMessages.length === 0 && <p className="text-gray-500 italic p-4 text-center">Brak wiadomości w tej kategorii.</p>}
                </div>
                <div className="w-full md:w-2/3">
                    {selectedMessage ? (
                        <MessageContent message={selectedMessage} onDelete={onDelete} onGhostShipChoice={onGhostShipChoice} onAction={onAction} />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            <p>Wybierz wiadomość, aby ją przeczytać.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessagesPanel;