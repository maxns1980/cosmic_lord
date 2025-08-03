
import React from 'react';
import { AncientArtifactChoice } from '../types';

interface AncientArtifactModalProps {
    onChoice: (choice: AncientArtifactChoice) => void;
}

const formatNumber = (num: number) => num.toLocaleString('pl-PL');

const AncientArtifactModal: React.FC<AncientArtifactModalProps> = ({ onChoice }) => {
    const STUDY_COST = { money: 5000, crystal: 2000 };
    const SELL_GAIN = 10000;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
            <div className="bg-gray-800 border-2 border-purple-500 rounded-2xl shadow-2xl max-w-2xl w-full p-8 text-center transform transition-all">
                <span className="text-6xl mb-4 block" role="img" aria-label="Alien Artifact">👽</span>
                <h2 className="text-3xl font-bold text-purple-300 mb-2">Odkryto Starożytny Artefakt!</h2>
                <p className="text-gray-300 mb-6">
                    Twoi koloniści podczas rutynowych prac wykopaliskowych natrafili na tajemniczy obiekt nieznanego pochodzenia. Emanuje z niego dziwna energia. Co chcesz z nim zrobić?
                </p>
                
                <div className="space-y-4">
                    {/* Study Option */}
                    <div className="bg-gray-900 p-4 rounded-lg text-left">
                        <h3 className="font-bold text-lg text-cyan-300">Zbadaj go</h3>
                        <p className="text-sm text-gray-400 mb-2">Poświęć zasoby, aby spróbować odkryć jego sekrety. Istnieje szansa na wielki przełom technologiczny... lub na całkowitą porażkę.</p>
                        <p className="text-sm font-semibold mb-3">Koszt: <span className="text-yellow-400">{formatNumber(STUDY_COST.money)}💰</span> i <span className="text-blue-400">{formatNumber(STUDY_COST.crystal)}💎</span></p>
                        <button 
                            onClick={() => onChoice(AncientArtifactChoice.STUDY)}
                            className="w-full px-6 py-2 text-base font-bold text-white rounded-md shadow-md transition-colors duration-300 bg-cyan-600 hover:bg-cyan-500 focus:ring-4 focus:ring-cyan-400 focus:ring-opacity-50"
                        >
                            Podejmij ryzyko
                        </button>
                    </div>

                    {/* Sell Option */}
                     <div className="bg-gray-900 p-4 rounded-lg text-left">
                        <h3 className="font-bold text-lg text-green-300">Sprzedaj go</h3>
                        <p className="text-sm text-gray-400 mb-2">Znajdź kolekcjonera na czarnym rynku, który zapłaci fortunę za tak rzadki przedmiot. Szybki i pewny zysk.</p>
                        <p className="text-sm font-semibold mb-3">Zysk: <span className="text-yellow-400">{formatNumber(SELL_GAIN)}💰</span></p>
                        <button 
                            onClick={() => onChoice(AncientArtifactChoice.SELL)}
                            className="w-full px-6 py-2 text-base font-bold text-white rounded-md shadow-md transition-colors duration-300 bg-green-600 hover:bg-green-500 focus:ring-4 focus:ring-green-400 focus:ring-opacity-50"
                        >
                           Zgarnij gotówkę
                        </button>
                    </div>

                    {/* Ignore Option */}
                     <div className="bg-gray-900 p-4 rounded-lg text-left">
                        <h3 className="font-bold text-lg text-gray-300">Zignoruj go</h3>
                        <p className="text-sm text-gray-400 mb-2">Niektóre rzeczy lepiej zostawić w spokoju. Zakop artefakt i zapomnij o całej sprawie.</p>
                        <button 
                            onClick={() => onChoice(AncientArtifactChoice.IGNORE)}
                            className="w-full px-6 py-2 text-base font-bold text-white rounded-md shadow-md transition-colors duration-300 bg-gray-600 hover:bg-gray-500 focus:ring-4 focus:ring-gray-400 focus:ring-opacity-50"
                        >
                           Zostaw go w spokoju
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AncientArtifactModal;
