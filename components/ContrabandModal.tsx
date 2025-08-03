
import React, { useState, useEffect } from 'react';
import { ContrabandState, ContrabandOfferType, Resources, NPCStates } from '../types';
import { ALL_SHIP_DATA } from '../constants';

interface ContrabandModalProps {
    contrabandState: ContrabandState;
    resources: Resources;
    credits: number;
    npcStates: NPCStates;
    onDeal: (accepted: boolean) => void;
}

const formatNumber = (num: number) => Math.floor(num).toLocaleString('pl-PL');

const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

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
}


const ContrabandModal: React.FC<ContrabandModalProps> = ({ contrabandState, resources, credits, npcStates, onDeal }) => {
    const { offer, departureTime } = contrabandState;

    if (!offer) return null;

    const canAfford = credits >= offer.cost.credits && resources.deuterium >= offer.cost.deuterium;

    const getOfferDetails = () => {
        switch (offer.type) {
            case ContrabandOfferType.SHIP_UPGRADE:
                if (!offer.shipType) return null;
                const shipName = ALL_SHIP_DATA[offer.shipType].name;
                return (
                    <>
                        <h3 className="font-bold text-lg text-cyan-300">Nielegalna Modyfikacja Statku</h3>
                        <p className="text-sm text-gray-400 mt-1">Moi ludzie mogą zainstalować eksperymentalne ulepszenie na jednym z twoich statków. Gwarantuję natychmiastowy wzrost mocy.</p>
                        <p className="text-lg font-semibold text-white mt-2">Oferta: +1 Poziom Ulepszenia dla <span className="text-cyan-400">{shipName}</span></p>
                    </>
                );
            case ContrabandOfferType.PROTOTYPE_SHIP:
                 if (!offer.shipType) return null;
                const protoShipName = ALL_SHIP_DATA[offer.shipType].name;
                return (
                    <>
                        <h3 className="font-bold text-lg text-green-300">Prototypowy Statek</h3>
                        <p className="text-sm text-gray-400 mt-1">Z pewnego źródła "wypadł" mi z transportu prototypowy okręt. Nigdzie indziej takiego nie znajdziesz. Jest twój... za odpowiednią cenę.</p>
                        <p className="text-lg font-semibold text-white mt-2">Oferta: 1x <span className="text-green-400">{protoShipName}</span></p>
                    </>
                );
            case ContrabandOfferType.SPY_DATA:
                if (!offer.npcId) return null;
                const npcName = npcStates[offer.npcId]?.name || "Nieznany Cel";
                 return (
                    <>
                        <h3 className="font-bold text-lg text-yellow-300">Sfałszowane Dane Wywiadowcze</h3>
                        <p className="text-sm text-gray-400 mt-1">Mamy wtyki wszędzie. Możemy dostarczyć Ci pełne dane wywiadowcze na temat jednego z twoich sąsiadów. Bez ryzyka, bez wykrycia.</p>
                        <p className="text-lg font-semibold text-white mt-2">Oferta: Pełny raport szpiegowski na <span className="text-yellow-400">{npcName} [{offer.npcId}]</span></p>
                    </>
                );
            default:
                return null;
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
            <div className="bg-gray-800 border-2 border-red-500 rounded-2xl shadow-2xl max-w-2xl w-full p-8 text-center transform transition-all animate-pulse">
                <div className="absolute top-4 right-4">
                    <Countdown targetTime={departureTime} onEnd={() => onDeal(false)} />
                </div>
                <span className="text-6xl mb-4 block" role="img" aria-label="Contraband">💼</span>
                <h2 className="text-3xl font-bold text-red-400 mb-2">Oferta z Głębokiej Przestrzeni</h2>
                <p className="text-gray-300 mb-6">
                    Odebrano zaszyfrowaną transmisję. Syndykat przemytników ma dla Ciebie jednorazową ofertę. Decyduj szybko, nie będą czekać wiecznie.
                </p>
                
                <div className="bg-gray-900 p-4 rounded-lg text-left mb-6">
                    {getOfferDetails()}
                    <div className="mt-4 pt-3 border-t border-gray-700">
                        <h4 className="font-bold text-lg text-white">Koszt Operacji:</h4>
                        <div className="flex justify-center items-center gap-6 mt-1">
                            <span className={`text-lg font-mono ${credits >= offer.cost.credits ? 'text-yellow-300' : 'text-red-500'}`}>💰 {formatNumber(offer.cost.credits)}</span>
                            <span className={`text-lg font-mono ${resources.deuterium >= offer.cost.deuterium ? 'text-purple-300' : 'text-red-500'}`}>💧 {formatNumber(offer.cost.deuterium)}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button 
                        onClick={() => onDeal(false)}
                        className="flex-1 px-6 py-3 text-base font-bold text-white rounded-md shadow-md transition-colors duration-300 bg-gray-600 hover:bg-gray-500 focus:ring-4 focus:ring-gray-400 focus:ring-opacity-50"
                    >
                        Odrzuć
                    </button>
                    <button 
                        onClick={() => onDeal(true)}
                        disabled={!canAfford}
                        className="flex-1 px-6 py-3 text-base font-bold text-white rounded-md shadow-md transition-colors duration-300 bg-red-600 hover:bg-red-500 focus:ring-4 focus:ring-red-400 focus:ring-opacity-50 disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                        {canAfford ? 'Akceptuj' : 'Brak środków'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ContrabandModal;