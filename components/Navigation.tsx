


import React, { useState, useEffect } from 'react';
import { View, MerchantState, MerchantStatus, TestableEventType } from '../types';

interface NavigationProps {
    activeView: View;
    setActiveView: (view: View) => void;
    unreadMessagesCount: number;
    merchantState: MerchantState;
    hasPhalanx: boolean;
    hasAlliance: boolean;
    onTriggerEvent: (eventType: TestableEventType) => void;
    username: string;
}

const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

const Countdown: React.FC<{ targetTime: number }> = ({ targetTime }) => {
    const [remaining, setRemaining] = useState(targetTime - Date.now());

    useEffect(() => {
        const timer = setInterval(() => {
            const newRemaining = targetTime - Date.now();
            if (newRemaining <= 0) {
                clearInterval(timer);
            }
            setRemaining(newRemaining);
        }, 1000);
        return () => clearInterval(timer);
    }, [targetTime]);

    return <span className="ml-2 text-xs font-mono">({formatTime(remaining / 1000)})</span>;
}

const NavButton: React.FC<{ label: string, view: View, activeView: View, onClick: (view: View) => void, icon: string, badgeCount?: number, countdownTime?: number }> = 
({ label, view, activeView, onClick, icon, badgeCount, countdownTime }) => (
    <button
        onClick={() => onClick(view)}
        className={`relative w-full flex items-center justify-start px-4 py-3 text-sm md:text-base font-bold transition-all duration-300 rounded-lg text-left
        ${activeView === view 
            ? 'bg-gray-700 text-white' 
            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        }`}
    >
       <span className="text-xl mr-3 w-8 text-center">{icon}</span>
       <span>{label}</span>
       {badgeCount !== undefined && badgeCount > 0 && (
           <span className="absolute top-1/2 -translate-y-1/2 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white ring-2 ring-gray-700">{badgeCount > 9 ? '9+' : badgeCount}</span>
       )}
       {countdownTime !== undefined && countdownTime > Date.now() && <Countdown targetTime={countdownTime} />}
    </button>
);

const Navigation: React.FC<NavigationProps> = ({ activeView, setActiveView, unreadMessagesCount, merchantState, hasPhalanx, hasAlliance, onTriggerEvent, username }) => {
    const [isTestMenuOpen, setIsTestMenuOpen] = useState(false);
    let merchantCountdown: number | undefined;
    let merchantLabel = 'Kupiec';

    if (merchantState.status === MerchantStatus.INCOMING) {
        merchantCountdown = merchantState.arrivalTime;
        merchantLabel = 'Kupiec w drodze';
    } else if (merchantState.status === MerchantStatus.ACTIVE) {
        merchantCountdown = merchantState.departureTime;
    }

    const testEvents = [
        { type: TestableEventType.SOLAR_FLARE, name: 'Rozbłysk Słoneczny' },
        { type: TestableEventType.PIRATE_MERCENARY, name: 'Piraci-Najemnicy' },
        { type: TestableEventType.CONTRABAND, name: 'Kontrabanda' },
        { type: TestableEventType.ANCIENT_ARTIFACT, name: 'Starożytny Artefakt' },
        { type: TestableEventType.ASTEROID_IMPACT, name: 'Uderzenie Asteroidy' },
        { type: TestableEventType.RESOURCE_VEIN, name: 'Żyła Surowców' },
        { type: TestableEventType.SPACE_PLAGUE, name: 'Kosmiczna Zaraza' },
        { type: TestableEventType.GHOST_SHIP, name: 'Statek Widmo' },
        { type: TestableEventType.GALACTIC_GOLD_RUSH, name: 'Gorączka Złota' },
        { type: TestableEventType.STELLAR_AURORA, name: 'Zorza Gwiezdna' },
    ];

    const handleTestEventClick = (eventType: TestableEventType) => {
        onTriggerEvent(eventType);
        setIsTestMenuOpen(false);
    };

    return (
        <nav className="flex flex-col gap-2 w-56 flex-shrink-0 sticky top-48 xl:top-32 self-start max-h-[calc(100vh-13rem)] xl:max-h-[calc(100vh-9rem)] overflow-y-auto">
            <NavButton label="Podgląd" view="overview" activeView={activeView} onClick={setActiveView} icon="📊" />
            <NavButton label="Budynki" view="buildings" activeView={activeView} onClick={setActiveView} icon="🏢" />
            <NavButton label="Badania" view="research" activeView={activeView} onClick={setActiveView} icon="🔬" />
            <NavButton label="Ulepszenia" view="fleet_upgrades" activeView={activeView} onClick={setActiveView} icon="⬆️" />
            <NavButton label="Stocznia" view="shipyard" activeView={activeView} onClick={setActiveView} icon="🛠️" />
            <NavButton label="Obrona" view="defense" activeView={activeView} onClick={setActiveView} icon="🛡️" />
            <NavButton label="Flota" view="fleet" activeView={activeView} onClick={setActiveView} icon="🚀" />
            {hasPhalanx && (
                <NavButton label="Falanga" view="phalanx" activeView={activeView} onClick={setActiveView} icon="📡" />
            )}
            <NavButton label="Galaktyka" view="galaxy" activeView={activeView} onClick={setActiveView} icon="🪐" />
            <NavButton label="Sojusz" view="alliance" activeView={activeView} onClick={setActiveView} icon="🤝" />
            <NavButton label="Wiadomości" view="messages" activeView={activeView} onClick={setActiveView} icon="✉️" badgeCount={unreadMessagesCount} />
            
            {username === 'maxns1980' && (
                <div className="relative">
                    <button
                        onClick={() => setIsTestMenuOpen(!isTestMenuOpen)}
                        className="w-full flex items-center justify-start px-4 py-3 text-sm md:text-base font-bold transition-all duration-300 rounded-lg text-left text-gray-400 hover:bg-gray-800 hover:text-white"
                    >
                        <span className="text-xl mr-3 w-8 text-center">🧪</span>
                        <span>Test Wydarzeń</span>
                        <span className={`ml-auto transition-transform ${isTestMenuOpen ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {isTestMenuOpen && (
                        <div className="absolute left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 overflow-hidden">
                            {testEvents.map(event => (
                                <button
                                    key={event.type}
                                    onClick={() => handleTestEventClick(event.type)}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                                >
                                    {event.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            {merchantState.status !== MerchantStatus.INACTIVE && (
                 <NavButton label={merchantLabel} view="merchant" activeView={activeView} onClick={setActiveView} icon="💰" countdownTime={merchantCountdown} />
            )}
        </nav>
    );
}

export default Navigation;