
import React from 'react';

const PhalanxPanel: React.FC = () => {
    return (
        <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-4 md:p-6">
            <h2 className="text-2xl font-bold text-cyan-300 mb-4 border-b-2 border-cyan-800 pb-3">Falanga Czujników</h2>
            <div className="text-center py-10">
                <p className="text-gray-400">System Falangi Czujników jest w budowie.</p>
                <p className="text-gray-500 mt-2">Wkrótce będziesz mógł skanować stąd ruchy wrogich flot.</p>
            </div>
        </div>
    );
};

export default PhalanxPanel;
