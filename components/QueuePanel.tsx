

import React, { useState, useEffect } from 'react';
import { QueueItem, ShipType, BuildingType, ResearchType, DefenseType } from '../types';
import { ALL_GAME_OBJECTS, SHIPYARD_DATA, BUILDING_DATA, RESEARCH_DATA, DEFENSE_DATA, ALL_SHIP_DATA, SHIP_UPGRADE_DATA } from '../constants';

interface QueuePanelProps {
    buildingQueue: QueueItem[];
    shipyardQueue: QueueItem[];
    buildingQueueCapacity: number;
    shipyardQueueCapacity: number;
}

const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

const getItemInfo = (item: QueueItem | undefined) => {
    if (!item) return null;
    switch(item.type) {
        case 'building': return BUILDING_DATA[item.id as BuildingType];
        case 'research': return RESEARCH_DATA[item.id as ResearchType];
        case 'ship': return ALL_SHIP_DATA[item.id as ShipType];
        case 'defense': return DEFENSE_DATA[item.id as DefenseType];
        case 'ship_upgrade': {
            const upgradeData = SHIP_UPGRADE_DATA[item.id as ShipType];
            const shipData = ALL_SHIP_DATA[item.id as ShipType];
            return { ...upgradeData, icon: shipData.icon };
        }
        default: return null;
    }
}

const QueuePanel: React.FC<QueuePanelProps> = ({ buildingQueue, shipyardQueue, buildingQueueCapacity, shipyardQueueCapacity }) => {
    const [currentTime, setCurrentTime] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (buildingQueue.length === 0 && shipyardQueue.length === 0) {
        return null;
    }

    const renderQueue = (title: string, currentQueue: QueueItem[], capacity: number) => {
        if (currentQueue.length === 0) return null;

        const currentItem = currentQueue[0];
        const itemInfo = getItemInfo(currentItem);

        if (!itemInfo) {
            return null;
        }

        const remainingTime = (currentItem.endTime - currentTime) / 1000;
        const progress = Math.min(100, ((currentItem.buildTime - remainingTime) / currentItem.buildTime) * 100);

        const icon = (itemInfo as any).icon || '❓';
        const label = currentItem.type === 'ship' || currentItem.type === 'defense' ? 'Ilość' : 'Poziom';

        return (
             <div className="bg-gray-900 bg-opacity-80 border border-cyan-800 rounded-lg p-4 my-4 shadow-lg">
                <h3 className="text-lg font-semibold text-cyan-300 mb-2">{title} ({currentQueue.length}/{capacity})</h3>
                <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{icon} {itemInfo.name} ({label} {currentItem.levelOrAmount})</span>
                    <span className="font-mono text-xl text-green-400">{formatTime(remainingTime)}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2">
                    <div className="bg-cyan-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
        )
    }

    return (
       <>
        {renderQueue("Kolejka Budowy/Badań", buildingQueue, buildingQueueCapacity)}
        {renderQueue("Kolejka Stoczni", shipyardQueue, shipyardQueueCapacity)}
       </>
    )
}

export default QueuePanel;