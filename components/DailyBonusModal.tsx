
import React from 'react';
import { Resources } from '../types';

interface DailyBonusModalProps {
    onClose: () => void;
    onClaim: () => void;
    rewards: Partial<Resources & { credits: number }>;
}

const formatNumber = (num: number) => Math.floor(num).toLocaleString('pl-PL');

const DailyBonusModal: React.FC<DailyBonusModalProps> = ({ onClose, onClaim, rewards }) => {
    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
            aria-modal="true" 
            role="dialog"
            onClick={onClose}
        >
            <div 
                className="relative bg-gray-800 border-2 border-yellow-400 rounded-2xl shadow-2xl max-w-md w-full text-center p-8 transform transition-all animate-fade-in-up"
                onClick={e => e.stopPropagation()}
            >
                 <button 
                    onClick={onClose} 
                    className="absolute top-2 right-4 text-gray-400 hover:text-white text-3xl font-bold"
                    aria-label="Zamknij"
                >
                    &times;
                </button>
                <span className="text-6xl mb-4 block" role="img" aria-label="Gift">🎁</span>
                <h2 className="text-3xl font-bold text-yellow-300 mb-2">Codzienna Nagroda!</h2>
                <p className="text-gray-300 mb-6">
                    Witaj z powrotem, Władco! Oto Twoja nagroda za dzisiejsze logowanie.
                </p>
                
                <div className="bg-gray-900 p-4 rounded-lg mb-6 text-left space-y-2">
                    {rewards.metal && (
                        <p className="text-lg flex items-center"><span className="text-2xl mr-3">🔩</span> Metal: <span className="ml-auto font-bold text-green-400">+{formatNumber(rewards.metal)}</span></p>
                    )}
                    {rewards.crystal && (
                         <p className="text-lg flex items-center"><span className="text-2xl mr-3">💎</span> Kryształ: <span className="ml-auto font-bold text-green-400">+{formatNumber(rewards.crystal)}</span></p>
                    )}
                     {rewards.credits && (
                         <p className="text-lg flex items-center"><span className="text-2xl mr-3">💰</span> Kredyty: <span className="ml-auto font-bold text-green-400">+{formatNumber(rewards.credits)}</span></p>
                    )}
                </div>

                <button 
                    onClick={onClaim}
                    className="w-full px-6 py-3 text-lg font-bold text-gray-900 rounded-md shadow-lg transition-all duration-300 bg-yellow-400 hover:bg-yellow-300 focus:ring-4 focus:ring-yellow-400 focus:ring-opacity-50 transform hover:scale-105"
                >
                    Odbierz Nagrodę
                </button>
            </div>
            
            <style>{`
                @keyframes fade-in-up {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.4s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default DailyBonusModal;
