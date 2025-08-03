import React, { useState } from 'react';
import { Alliance } from '../types';

interface AlliancePanelProps {
    alliance: Alliance | null;
    onCreate: (name: string, tag: string) => void;
    onLeave: () => void;
}

const AllianceCreation: React.FC<{ onCreate: (name: string, tag: string) => void }> = ({ onCreate }) => {
    const [name, setName] = useState('');
    const [tag, setTag] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && tag.trim()) {
            onCreate(name.trim(), tag.trim());
        }
    };

    return (
        <div className="text-center py-10">
            <p className="text-gray-300 text-lg mb-6">
                Nie należysz do żadnego sojuszu. Stwórz własny lub dołącz do istniejącego.
            </p>
            <div className="max-w-md mx-auto bg-gray-900 p-6 rounded-lg">
                <h3 className="text-xl font-bold text-cyan-300 mb-4">Stwórz Nowy Sojusz</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="alliance-name" className="block text-sm font-medium text-gray-300 text-left mb-1">Nazwa Sojuszu (3-30 znaków)</label>
                        <input
                            id="alliance-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            minLength={3}
                            maxLength={30}
                            required
                            className="w-full bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 focus:ring-cyan-500 focus:border-cyan-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="alliance-tag" className="block text-sm font-medium text-gray-300 text-left mb-1">Tag Sojuszu (2-5 znaków)</label>
                        <input
                            id="alliance-tag"
                            type="text"
                            value={tag}
                            onChange={(e) => setTag(e.target.value)}
                            minLength={2}
                            maxLength={5}
                            required
                            className="w-full bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 focus:ring-cyan-500 focus:border-cyan-500"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full px-6 py-2 text-base font-bold text-white rounded-md shadow-md transition-all duration-300 transform bg-green-600 hover:bg-green-500 focus:ring-4 focus:ring-green-400 focus:ring-opacity-50 hover:scale-105"
                    >
                        Załóż Sojusz
                    </button>
                </form>
            </div>
             <p className="text-gray-500 mt-8 text-sm">
                Funkcja dołączania do istniejących sojuszy zostanie dodana w przyszłości.
            </p>
        </div>
    );
};

const AllianceDashboard: React.FC<{ alliance: Alliance, onLeave: () => void }> = ({ alliance, onLeave }) => {
    return (
        <div>
             <div className="text-center mb-6">
                <h2 className="text-4xl font-bold text-cyan-300">{alliance.name}</h2>
                <p className="text-2xl font-semibold text-gray-400">[{alliance.tag}]</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-gray-900 p-4 rounded-lg">
                    <h3 className="text-lg font-bold text-white mb-2">Członkowie (1)</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-xs text-gray-400 uppercase">
                                    <th className="p-2">Gracz</th>
                                    <th className="p-2">Ranga</th>
                                    <th className="p-2">Punkty</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-t border-gray-700">
                                    <td className="p-2 font-semibold">Dowódca</td>
                                    <td className="p-2 text-yellow-400">Założyciel</td>
                                    <td className="p-2">B/D</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-gray-900 p-4 rounded-lg">
                     <h3 className="text-lg font-bold text-white mb-2">Zarządzanie</h3>
                     <p className="text-sm text-gray-400 mb-4">Ustawienia i opcje sojuszu.</p>
                     <button 
                        onClick={onLeave}
                        className="w-full px-6 py-2 text-base font-bold text-white rounded-md shadow-md transition-all duration-300 transform bg-red-700 hover:bg-red-600 focus:ring-4 focus:ring-red-500 focus:ring-opacity-50 hover:scale-105"
                    >
                        Opuść Sojusz
                    </button>
                </div>
            </div>
        </div>
    );
};


const AlliancePanel: React.FC<AlliancePanelProps> = ({ alliance, onCreate, onLeave }) => {
    return (
        <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-4 md:p-6">
            <h2 className="text-2xl font-bold text-cyan-300 mb-4 border-b-2 border-cyan-800 pb-3 flex items-center gap-3">
                <span className="text-3xl">🤝</span>
                Sojusz
            </h2>
            
            {alliance ? (
                <AllianceDashboard alliance={alliance} onLeave={onLeave} />
            ) : (
                <AllianceCreation onCreate={onCreate} />
            )}
        </div>
    );
};

export default AlliancePanel;