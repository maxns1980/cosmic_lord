

import React, { useState, useEffect } from 'react';
import { PirateMercenaryState, PirateMercenaryStatus, ShipType } from '../types';
import { SHIPYARD_DATA } from '../constants';

const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const formatNumber = (num: number) => Math.floor(num).toLocaleString('pl-PL');

const Countdown: React.FC<{ targetTime: number, text: string }> = ({ targetTime, text }) => {
    const [remaining, setRemaining] = useState(targetTime - Date.now());

    useEffect(() => {
        const timer = setInterval(() => {
            const newRemaining = targetTime - Date.now();
            if (newRemaining <= 0) clearInterval(timer);
            setRemaining(newRemaining);
        }, 1000);
        return () => clearInterval(timer);
    }, [targetTime]);

    return (
        <span className="font-semibold">{text} <span className="font-mono text-lg text-yellow-300">{formatTime(remaining / 1000)}</span></span>
    );
};

interface PirateMercenaryPanelProps {
    pirateState: PirateMercenaryState;
    credits: number;
    onHire: () => void;
    onDecline: () => void;
}

const PirateMercenaryPanel: React.FC<PirateMercenaryPanelProps> = ({ pirateState, credits, onHire, onDecline }) => {
    if (pirateState.status === PirateMercenaryStatus.INACTIVE || pirateState.status === PirateMercenaryStatus.DEPARTED) {
        return null;
    }

    const { status, arrivalTime, departureTime, fleet, hireCost } = pirateState;
    const canAfford = credits >= hireCost;

    let content;

    if (status === PirateMercenaryStatus.INCOMING) {
        content = (
            <div className="flex items-center text-yellow-200">
                <span className="text-3xl mr-4 animate-pulse">🏴‍☠️</span>
                <Countdown targetTime={arrivalTime} text="Piraci-najemnicy w drodze! Czas do przybycia:" />
            </div>
        );
    } else if (status === PirateMercenaryStatus.AVAILABLE) {
        content = (
            <>
                <div className="flex-grow">
                    <div className="flex items-center mb-2">
                        <span className="text-3xl mr-4">🏴‍☠️</span>
                        <h3 className="text-xl font-bold text-white">Oferta Najemników</h3>
                    </div>
                    <p className="text-sm text-gray-200">
                        Flota do wynajęcia: 
                        {Object.entries(fleet).map(([type, count]) => ` ${count}x ${SHIPYARD_DATA[type as ShipType].name}`).join(',')}.
                    </p>
                    <p className="text-sm text-gray-200">
                        Koszt: <span className="font-bold text-yellow-300">{formatNumber(hireCost)} 💰</span>
                    </p>
                </div>
                <div className="flex flex-col items-center md:items-end gap-2">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={onDecline}
                            className="px-6 py-2 text-base font-bold text-white rounded-md shadow-md transition-all duration-300 transform bg-red-700 hover:bg-red-600 focus:ring-4 focus:ring-red-500 focus:ring-opacity-50 hover:scale-105"
                        >
                            Odrzuć
                        </button>
                        <button 
                            onClick={onHire} 
                            disabled={!canAfford}
                            className="px-6 py-2 text-base font-bold text-white rounded-md shadow-md transition-all duration-300 transform bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-70 focus:ring-4 focus:ring-green-400 focus:ring-opacity-50 hover:scale-105"
                        >
                            Wynajmij
                        </button>
                    </div>
                    <Countdown targetTime={departureTime} text="Oferta wygasa za:" />
                </div>
            </>
        );
    }

    return (
        <div className="container mx-auto px-4 md:px-8 mt-4">
            <div className="bg-yellow-900 bg-opacity-80 backdrop-blur-sm border border-yellow-600 text-white p-4 rounded-lg shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
                {content}
            </div>
        </div>
    );
};

export default PirateMercenaryPanel;