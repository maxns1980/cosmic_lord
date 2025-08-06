import React, { useState, useEffect } from 'react';
import { PirateMercenaryState, ShipType, PirateMercenaryStatus } from '../types';
import { ALL_SHIP_DATA } from '../constants';

interface PirateMercenaryModalProps {
    pirateState: PirateMercenaryState;
    credits: number;
    onDeal: (accepted: boolean) => void;
    onClose: () => void;
}

const formatNumber = (num: number) => Math.floor(num).toLocaleString('pl-PL');

const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
};

const Countdown: React.FC<{ targetTime: number, onEnd?: () => void }> = ({ targetTime, onEnd }) => {
    const [remaining, setRemaining] = useState(targetTime - Date.now());

    useEffect(() => {
        const timer = setInterval(() => {
            const newRemaining = targetTime - Date.now();
            if (newRemaining <= 0) {
                clearInterval(timer);
                if (onEnd) onEnd();
            }
            setRemaining(newRemaining);
        }, 1000);
        return () => clearInterval(timer);
    }, [targetTime, onEnd]);

    return <span className="font-mono text-2xl text-yellow-300">{formatTime(remaining / 1000)}</span>;
};

const PirateMercenaryModal: React.FC<PirateMercenaryModalProps> = ({ pirateState, credits, onDeal, onClose }) => {
    const { fleet, hireCost, departureTime } = pirateState;
    const canAfford = credits >= hireCost;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
            <div className="bg-gray-800 border-2 border-yellow-500 rounded-2xl shadow-2xl max-w-2xl w-full p-8 text-center transform transition-all" onClick={e => e.stopPropagation()}>
                <div className="absolute top-4 right-4">
                    <Countdown targetTime={departureTime} onEnd={onClose} />
                </div>
                 <button 
                    onClick={onClose} 
                    className="absolute top-2 left-4 text-gray-400 hover:text-white text-3xl font-bold"
                    aria-label="Zamknij"
                >
                    &times;
                </button>
                <span className="text-6xl mb-4 block" role="img" aria-label="Pirate Flag">🏴‍☠️</span>
                <h2 className="text-3xl font-bold text-yellow-300 mb-2">Oferta Piratów-Najemników</h2>
                <p className="text-gray-300 mb-6">
                    Słyszeliśmy, że szukasz dodatkowej siły ognia. Mamy tu kilka statków, które chętnie dołączą do Twojej sprawy... za odpowiednią cenę.
                </p>
                
                <div className="bg-gray-900 p-4 rounded-lg text-left mb-6">
                    <h3 className="font-bold text-lg text-cyan-300">Flota do wynajęcia:</h3>
                    <ul className="list-disc list-inside text-gray-300 mt-2">
                        {Object.entries(fleet).map(([type, count]) => (
                            <li key={type}>{ALL_SHIP_DATA[type as ShipType].name}: <span className="font-bold">{count}</span></li>
                        ))}
                    </ul>
                     <div className="mt-4 pt-3 border-t border-gray-700">
                        <h4 className="font-bold text-lg text-white">Koszt Operacji:</h4>
                        <div className="flex justify-center items-center gap-6 mt-1">
                            <span className={`text-lg font-mono ${canAfford ? 'text-yellow-300' : 'text-red-500'}`}>
                                💰 {formatNumber(hireCost)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button 
                        onClick={() => onDeal(false)}
                        className="flex-1 px-6 py-3 text-base font-bold text-white rounded-md shadow-md transition-colors duration-300 bg-red-700 hover:bg-red-600 focus:ring-4 focus:ring-red-500 focus:ring-opacity-50"
                    >
                        Odrzuć
                    </button>
                    <button 
                        onClick={() => onDeal(true)}
                        disabled={!canAfford}
                        className="flex-1 px-6 py-3 text-base font-bold text-white rounded-md shadow-md transition-colors duration-300 bg-green-600 hover:bg-green-500 focus:ring-4 focus:ring-green-400 focus:ring-opacity-50 disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                        {canAfford ? 'Wynajmij' : 'Brak środków'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PirateMercenaryModal;
