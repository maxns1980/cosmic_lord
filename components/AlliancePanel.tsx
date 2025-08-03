
import React from 'react';

interface AlliancePanelProps {
    alliance: { id: string; name: string } | null;
}

const AlliancePanel: React.FC<AlliancePanelProps> = ({ alliance }) => {
    return (
        <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-4 md:p-6">
            <h2 className="text-2xl font-bold text-cyan-300 mb-4 border-b-2 border-cyan-800 pb-3 flex items-center gap-3">
                <span className="text-3xl">🤝</span>
                Sojusz
            </h2>
            <div className="text-center py-10">
                <p className="text-gray-300 text-lg">
                    Funkcja sojuszy jest w trakcie rozwoju.
                </p>
                <p className="text-gray-400 mt-2">
                    Wkrótce będziesz mógł tworzyć sojusze lub dołączać do istniejących, aby wspólnie dominować w galaktyce!
                </p>
            </div>
        </div>
    );
};

export default AlliancePanel;
