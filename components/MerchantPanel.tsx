import React, { useState, useEffect } from 'react';
import { MerchantState, Resources, ShipType, MerchantStatus } from '../types';
import { ALL_SHIP_DATA } from '../constants';

interface MerchantPanelProps {
    merchantState: MerchantState;
    resources: Resources;
    credits: number;
    maxResources: Resources;
    onTrade: (resource: keyof Omit<Resources, 'energy'>, amount: number, tradeType: 'buy' | 'sell') => void;
    onBuyShip: (shipType: ShipType, amount: number) => void;
}

const formatNumber = (num: number) => Math.floor(num).toLocaleString('pl-PL');

const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

const Countdown: React.FC<{ targetTime: number, onEnd?: () => void, text: string }> = ({ targetTime, onEnd, text }) => {
    const [remaining, setRemaining] = useState(targetTime - Date.now());

    useEffect(() => {
        const timer = setInterval(() => {
            const newRemaining = targetTime - Date.now();
            if (newRemaining < 0) {
                clearInterval(timer);
                if (onEnd) onEnd();
            }
            setRemaining(newRemaining);
        }, 1000);
        return () => clearInterval(timer);
    }, [targetTime, onEnd]);

    return (
        <div className="text-center md:text-right mt-2 md:mt-0">
            <p className="text-gray-400">{text}:</p>
            <p className="text-xl font-bold font-mono text-yellow-400">{formatTime(remaining / 1000)}</p>
        </div>
    );
};

const TradeRow: React.FC<{
    resKey: keyof Omit<Resources, 'energy'>,
    icon: string,
    rates: { buy: number; sell: number },
    onTrade: MerchantPanelProps['onTrade'],
    currentAmount: number,
    currentCredits: number,
    maxAmount: number,
}> = ({ resKey, icon, rates, onTrade, currentAmount, currentCredits, maxAmount }) => {
    const [buyAmount, setBuyAmount] = useState('');
    const [sellAmount, setSellAmount] = useState('');

    const buyCost = Math.floor(parseInt(buyAmount, 10) * rates.buy) || 0;
    const sellGain = Math.floor(parseInt(sellAmount, 10) * rates.sell) || 0;

    const canBuy = parseInt(buyAmount, 10) > 0 && currentCredits >= buyCost && currentAmount + parseInt(buyAmount, 10) <= maxAmount;
    const canSell = parseInt(sellAmount, 10) > 0 && currentAmount >= parseInt(sellAmount, 10);
    
    const handleBuy = () => {
        onTrade(resKey, parseInt(buyAmount, 10), 'buy');
        setBuyAmount('');
    }
    
    const handleSell = () => {
        onTrade(resKey, parseInt(sellAmount, 10), 'sell');
        setSellAmount('');
    }
    
    return (
        <tr className="border-b border-gray-700 bg-gray-900 bg-opacity-40 hover:bg-opacity-60">
            <td className="p-4 font-semibold text-lg">{icon} {resKey.charAt(0).toUpperCase() + resKey.slice(1)}</td>
            <td className="p-4 text-center">{formatNumber(currentAmount)} / {formatNumber(maxAmount)}</td>
            <td className="p-4">
                <div className="flex items-center space-x-2">
                    <input type="number" value={buyAmount} onChange={e => setBuyAmount(e.target.value)} min="0" className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1" placeholder="Ilość"/>
                    <button onClick={handleBuy} disabled={!canBuy} className="px-4 py-1 bg-green-600 rounded text-white font-bold disabled:bg-gray-600 disabled:cursor-not-allowed whitespace-nowrap">
                        Kup ({formatNumber(buyCost)}$)
                    </button>
                </div>
            </td>
            <td className="p-4">
                <div className="flex items-center space-x-2">
                    <input type="number" value={sellAmount} onChange={e => setSellAmount(e.target.value)} min="0" className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1" placeholder="Ilość"/>
                    <button onClick={handleSell} disabled={!canSell} className="px-4 py-1 bg-red-600 rounded text-white font-bold disabled:bg-gray-600 disabled:cursor-not-allowed whitespace-nowrap">
                        Sprzedaj ({formatNumber(sellGain)}$)
                    </button>
                </div>
            </td>
        </tr>
    );
};

const ShipTradeRow: React.FC<{
    shipType: ShipType;
    offer: { price: number; stock: number; };
    credits: number;
    onBuyShip: (shipType: ShipType, amount: number) => void;
}> = ({ shipType, offer, credits, onBuyShip }) => {
    const [amount, setAmount] = useState('');
    const data = ALL_SHIP_DATA[shipType];
    const numAmount = parseInt(amount, 10) || 0;
    const totalCost = numAmount * offer.price;
    const canAfford = credits >= totalCost;
    const hasStock = offer.stock >= numAmount;
    const canBuy = numAmount > 0 && canAfford && hasStock;

    const handleBuy = () => {
        onBuyShip(shipType, numAmount);
        setAmount('');
    }

    return (
        <tr className="border-b border-gray-700 bg-gray-900 bg-opacity-40 hover:bg-opacity-60">
            <td className="p-4 font-semibold text-lg flex items-center gap-3">
                <span className="text-2xl">{data.icon}</span>
                {data.name}
            </td>
            <td className="p-4 text-center font-mono text-yellow-300">{formatNumber(offer.price)} 💰</td>
            <td className="p-4 text-center font-mono">{formatNumber(offer.stock)}</td>
            <td className="p-4" style={{width: '300px'}}>
                <div className="flex items-center space-x-2">
                    <input 
                        type="number" 
                        value={amount} 
                        onChange={e => setAmount(e.target.value)} 
                        min="0" 
                        max={offer.stock} 
                        className="w-24 bg-gray-800 border border-gray-600 rounded px-2 py-1" 
                        placeholder="Ilość"
                    />
                    <button 
                        onClick={handleBuy} 
                        disabled={!canBuy} 
                        className="flex-1 px-4 py-1 bg-green-600 rounded text-white font-bold disabled:bg-gray-600 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        Kup ({formatNumber(totalCost)} 💰)
                    </button>
                </div>
            </td>
        </tr>
    );
}

export const MerchantPanel: React.FC<MerchantPanelProps> = ({ merchantState, resources, credits, maxResources, onTrade, onBuyShip }) => {
    const { status, arrivalTime, departureTime, shipOffers } = merchantState;

    if (status === MerchantStatus.INCOMING) {
        return (
            <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-4 md:p-6">
                <div className="flex flex-col md:flex-row justify-between items-center mb-4 border-b-2 border-cyan-800 pb-3">
                    <h2 className="text-2xl font-bold text-cyan-300">Wędrowny Kupiec</h2>
                    <Countdown targetTime={arrivalTime} text="Przybędzie za" />
                </div>
                <div className="text-center py-10">
                    <p className="text-gray-300">Handlarz jest w drodze do Twojej planety. Handel będzie dostępny po jego przybyciu.</p>
                </div>
            </div>
        );
    }
    
    if (status !== MerchantStatus.ACTIVE) {
        // Fallback for any other state, though navigation should prevent this.
        return null;
    }

    const hasShipOffers = shipOffers && (Object.keys(shipOffers).length > 0) && Object.values(shipOffers).some(o => o && o.stock > 0);

    return (
        <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl p-4 md:p-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 border-b-2 border-cyan-800 pb-3">
                <h2 className="text-2xl font-bold text-cyan-300">Wędrowny Kupiec</h2>
                <Countdown targetTime={departureTime} text="Kupiec odleci za" />
            </div>
            
            <p className="mb-6 text-gray-300">Witaj, podróżniku! Mam najlepsze towary w tym sektorze. Rzuć okiem, a na pewno znajdziesz coś dla siebie. Pamiętaj, czas to pieniądz... a ja nie mam go za wiele.</p>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-gray-300">
                    <thead className="text-xs uppercase bg-gray-700 bg-opacity-50 text-gray-400">
                        <tr>
                            <th className="p-4">Surowiec</th>
                            <th className="p-4 text-center">Posiadane / Magazyn</th>
                            <th className="p-4">Kup</th>
                            <th className="p-4">Sprzedaj</th>
                        </tr>
                    </thead>
                    <tbody>
                        <TradeRow 
                            resKey="metal" 
                            icon="🔩" 
                            rates={merchantState.rates.metal}
                            onTrade={onTrade}
                            currentAmount={resources.metal}
                            currentCredits={credits}
                            maxAmount={maxResources.metal}
                        />
                         <TradeRow 
                            resKey="crystal" 
                            icon="💎" 
                            rates={merchantState.rates.crystal}
                            onTrade={onTrade}
                            currentAmount={resources.crystal}
                            currentCredits={credits}
                            maxAmount={maxResources.crystal}
                        />
                         <TradeRow 
                            resKey="deuterium" 
                            icon="💧" 
                            rates={merchantState.rates.deuterium}
                            onTrade={onTrade}
                            currentAmount={resources.deuterium}
                            currentCredits={credits}
                            maxAmount={maxResources.deuterium}
                        />
                    </tbody>
                </table>
            </div>
            
            {hasShipOffers && (
                <div className="mt-8">
                    <h3 className="text-xl font-bold text-cyan-300 mb-4 border-b border-cyan-700 pb-2">Statki na sprzedaż</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-gray-300">
                            <thead className="text-xs uppercase bg-gray-700 bg-opacity-50 text-gray-400">
                                <tr>
                                    <th className="p-4">Statek</th>
                                    <th className="p-4 text-center">Cena/szt.</th>
                                    <th className="p-4 text-center">Na stanie</th>
                                    <th className="p-4">Akcja</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(shipOffers).map(([shipType, offer]) => {
                                    if (!offer || offer.stock <= 0) return null;
                                    return (
                                        <ShipTradeRow 
                                            key={shipType}
                                            shipType={shipType as ShipType}
                                            offer={offer}
                                            credits={credits}
                                            onBuyShip={onBuyShip}
                                        />
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </div>
    );
};