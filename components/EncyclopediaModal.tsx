import React, { useState } from 'react';
import {
    BUILDING_DATA,
    RESEARCH_DATA,
    SHIPYARD_DATA,
    DEFENSE_DATA,
    ALL_GAME_OBJECTS,
} from '../constants';
import { BuildingType, ResearchType, ShipType, DefenseType, Resources, BuildingLevels, ResearchLevels } from '../types';

interface EncyclopediaModalProps {
    onClose: () => void;
}

type EncyclopediaTab = 'buildings' | 'research' | 'ships' | 'defense' | 'missions' | 'events';

const formatNumber = (num: number): string => {
    return Math.floor(num).toLocaleString('pl-PL');
};

const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

const CostDisplay: React.FC<{ cost: Resources }> = ({ cost }) => {
    const costs = [];
    if (cost.metal > 0) costs.push(<span key="m" className="flex items-center text-sm">🔩<span className="ml-1.5 text-gray-400">Metal:</span><span className="ml-2 font-mono text-white">{formatNumber(cost.metal)}</span></span>);
    if (cost.crystal > 0) costs.push(<span key="c" className="flex items-center text-sm">💎<span className="ml-1.5 text-gray-400">Kryształ:</span><span className="ml-2 font-mono text-white">{formatNumber(cost.crystal)}</span></span>);
    if (cost.deuterium > 0) costs.push(<span key="d" className="flex items-center text-sm">💧<span className="ml-1.5 text-gray-400">Deuter:</span><span className="ml-2 font-mono text-white">{formatNumber(cost.deuterium)}</span></span>);
    return <div className="space-y-1 mt-1">{costs}</div>;
};

const RequirementsDisplay: React.FC<{ requirements?: Partial<BuildingLevels & ResearchLevels> }> = ({ requirements }) => {
    if (!requirements || Object.keys(requirements).length === 0) return null;
    
    return (
        <div className="mt-2">
            <h4 className="font-semibold text-gray-300">Wymagania</h4>
            <div className="text-sm text-amber-400 space-y-1">
                {Object.entries(requirements).map(([reqId, reqLevel]) => {
                    const reqInfo = ALL_GAME_OBJECTS[reqId as keyof typeof ALL_GAME_OBJECTS];
                    if (!reqInfo) return null;
                    return <div key={reqId}>- {reqInfo.name} (poz. {reqLevel})</div>;
                })}
            </div>
        </div>
    );
}

const ItemCard: React.FC<{ itemData: any }> = ({ itemData }) => {
    const cost = itemData.cost(1);
    const buildTime = itemData.buildTime(1);
    
    return (
        <div className="bg-gray-900 bg-opacity-70 p-4 rounded-lg border border-gray-700 flex flex-col md:flex-row gap-4">
            <div className="flex-shrink-0 w-full md:w-24 text-center">
                {itemData.image && <img src={itemData.image} alt={itemData.name} className="w-24 h-24 object-cover rounded-md mx-auto" />}
                {!itemData.image && itemData.icon && <span className="text-6xl">{itemData.icon}</span>}
            </div>
            <div className="flex-1">
                <h3 className="text-xl font-bold text-white">{itemData.name}</h3>
                <p className="text-gray-400 mt-1 text-sm">{itemData.description}</p>
                
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <h4 className="font-semibold text-gray-300">Koszt (poz. 1 / 1 szt.)</h4>
                        <CostDisplay cost={cost} />
                        <p className="mt-1"><span className="text-gray-400">Czas budowy:</span> <span className="font-mono text-white">{formatTime(buildTime)}</span></p>
                    </div>
                     <div>
                        <RequirementsDisplay requirements={itemData.requirements} />
                    </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-700">
                    <h4 className="font-semibold text-gray-300 mb-1">Statystyki</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-sm">
                        {itemData.production && <span>Produkcja: <span className="text-green-400 font-mono">+{formatNumber(itemData.production(1))}/h</span></span>}
                        {itemData.energyConsumption && <span>Pobór energii: <span className="text-red-400 font-mono">{formatNumber(itemData.energyConsumption(1))}</span></span>}
                        {itemData.capacity && <span>Pojemność: <span className="text-cyan-400 font-mono">{formatNumber(itemData.capacity(1))}</span></span>}
                        {itemData.attack && <span>Atak: <span className="text-red-400 font-mono">{formatNumber(itemData.attack)}</span></span>}
                        {itemData.shield && <span>Tarcza: <span className="text-blue-400 font-mono">{formatNumber(itemData.shield)}</span></span>}
                        {itemData.structuralIntegrity && <span>Struktura: <span className="text-gray-400 font-mono">{formatNumber(itemData.structuralIntegrity)}</span></span>}
                        {itemData.cargoCapacity > 0 && <span>Ładowność: <span className="text-yellow-400 font-mono">{formatNumber(itemData.cargoCapacity)}</span></span>}
                        {itemData.speed && <span>Prędkość: <span className="text-white font-mono">{formatNumber(itemData.speed)}</span></span>}
                        {itemData.drive && <span>Napęd: <span className="text-white font-mono">{RESEARCH_DATA[itemData.drive as ResearchType].name}</span></span>}
                        {itemData.requiredEnergy && <span>Wymagana energia: <span className="text-yellow-400 font-mono">{formatNumber(itemData.requiredEnergy)}</span></span>}
                    </div>
                </div>
            </div>
        </div>
    );
};

const EVENT_DESCRIPTIONS = {
  SOLAR_FLARE: {
    icon: '☀️',
    name: 'Rozbłysk Słoneczny',
    description: 'Nagłe, intensywne promieniowanie z gwiazdy centralnej systemu. Może mieć pozytywne lub negatywne skutki. Może zwiększyć produkcję energii z elektrowni słonecznych, ale także zakłócić działanie tarcz i systemów szpiegowskich.',
  },
  PIRATE_MERCENARY: {
    icon: '🏴‍☠️',
    name: 'Piraci-Najemnicy',
    description: 'Grupa najemników oferuje swoje usługi za opłatą. Możesz wynająć ich flotę, aby wzmocnić swoje siły, ale ich oferta jest ograniczona czasowo i kosztowna.',
  },
  CONTRABAND: {
    icon: '💼',
    name: 'Przemytnicy Kontrabandy',
    description: 'Tajemniczy syndykat oferuje unikalne, nielegalne towary. Możesz zdobyć prototypowe statki, zaawansowane ulepszenia lub cenne dane wywiadowcze, ale wiąże się to z ryzykiem i wysoką ceną.',
  },
  ANCIENT_ARTIFACT: {
    icon: '👽',
    name: 'Starożytny Artefakt',
    description: 'Na jednej z twoich planet odkryto tajemniczy obiekt obcego pochodzenia. Możesz go zbadać (ryzykując zasoby na potencjalny przełom technologiczny), sprzedać na czarnym rynku (pewny zysk) lub zignorować.',
  },
  ASTEROID_IMPACT: {
    icon: '☄️',
    name: 'Uderzenie Asteroidy',
    description: 'Rój asteroid wchodzi w kolizję z twoją planetą. Może to spowodować uszkodzenie jednego z budynków, ale niektóre meteoryty mogą być bogate w cenne surowce, przynosząc nieoczekiwany bonus.',
  },
  RESOURCE_VEIN: {
    icon: '✨',
    name: 'Bogata Żyła Surowców',
    description: 'Twoi górnicy natrafili na niezwykle bogate złoże metalu lub kryształu. Przez określony czas produkcja tego surowca jest znacznie zwiększona.',
  },
  SPACE_PLAGUE: {
    icon: '🦠',
    name: 'Kosmiczna Zaraza',
    description: 'W twojej flocie rozprzestrzenia się wirus, który infekuje określony typ statków. Zainfekowane jednostki mają obniżoną siłę ataku, dopóki zaraza nie zostanie zwalczona.',
  },
  GHOST_SHIP: {
    icon: '👻',
    name: 'Statek Widmo',
    description: 'Czujniki wykryły dryfujący wrak potężnego okrętu w niezbadanym sektorze. Możesz wysłać ekspedycję, aby go zbadać, co może przynieść skarby, technologię lub niebezpieczną pułapkę.',
  },
  GALACTIC_GOLD_RUSH: {
    icon: '💰',
    name: 'Galaktyczna Gorączka Złota',
    description: 'W całej galaktyce ogłoszono gorączkę złota! W trakcie tego wydarzenia misje ekspedycyjne mają znacznie większą szansę na znalezienie cennych surowców i innych skarbów.',
  },
  STELLAR_AURORA: {
    icon: '🌌',
    name: 'Zorza Gwiezdna',
    description: 'Niezwykłe zjawisko kosmiczne pojawia się w twoim systemie. Zorza zwiększa wydajność paneli słonecznych, zapewniając bonus do produkcji energii na czas jej trwania.',
  }
};

const MISSION_DESCRIPTIONS = {
  EXPLORATION: {
    icon: '🧭',
    name: 'Eksploracja Planet',
    description: [
      { type: 'paragraph', content: 'Eksploracja to specjalny rodzaj misji, który pozwala Ci odkrywać cenne zasoby, bonusy, a nawet porzucone statki na niezamieszkanych planetach. Jest to misja obarczona ryzykiem, ale potencjalne nagrody są tego warte.' },
      { type: 'header', content: 'Jak przeprowadzić eksplorację krok po kroku:' },
      { type: 'list', items: [
        'Zbuduj Okręt Badawczy: To jest kluczowy statek wymagany do tej misji. Musisz go najpierw odblokować i zbudować w stoczni.',
        'Przejdź do panelu "Flota": Wybierz co najmniej jeden Okręt Badawczy, który chcesz wysłać.',
        'Dodaj eskortę (zalecane): Okręty Badawcze są bardzo słabe i praktycznie bezbronne. Zdecydowanie zaleca się wysłanie razem z nią silnej floty bojowej jako ochrony.',
        'Wybierz cel: W panelu "Galaktyka" znajdź niezamieszkaną pozycję (puste miejsce, np. [1:50:12]). Wpisz te koordynaty jako cel swojej floty.',
        'Wybierz misję "Eksploruj": Z dostępnych opcji misji wybierz "Eksploruj".',
        'Wyślij flotę: Po potwierdzeniu, Twoja flota wyruszy w drogę.',
      ]},
      { type: 'header', content: 'Fazy misji eksploracyjnej:' },
      { type: 'list', items: [
        'Lot do celu: Twoja flota podróżuje do wybranych koordynatów.',
        'Właściwa eksploracja: Po dotarciu na miejsce, Okręt Badawczy rozpoczyna skanowanie planety. Ta faza trwa kilka godzin i jest najbardziej niebezpiecznym momentem misji.',
        'Lot powrotny: Po zakończeniu eksploracji, Twoja flota automatycznie wraca do planety, z której została wysłana, przywożąc wszelkie znaleziska.',
      ]},
      { type: 'header', content: 'Możliwe wyniki eksploracji:' },
      { type: 'list', items: [
        'Znalezienie surowców: Najczęstszy wynik. Twoja flota odkrywa złoża metalu lub kryształu.',
        'Odnalezienie wraku statku: Natrafiasz na wrak, z którego udaje się odzyskać kilka sprawnych statków.',
        'Odnalezienie Bonusu: Najrzadszy i najcenniejszy wynik. Możesz znaleźć specjalny przedmiot.',
        'Napotkanie wrogów: Twoja ekipa badawcza zostaje zaatakowana, co może skutkować utratą części wysłanej floty.',
        'Nic: Czasami planeta jest jałowa i flota wraca z pustymi rękami.',
      ]},
    ]
  },
  EXPEDITION: {
    icon: '🌌',
    name: 'Wyprawa (Ekspedycja)',
    description: [
      { type: 'paragraph', content: 'Wyprawa (Ekspedycja) to jedna z najbardziej ekscytujących i nieprzewidywalnych misji w grze. Zamiast lecieć na konkretną planetę, wysyłasz swoją flotę w nieznaną, niezbadaną przestrzeń kosmiczną, co symbolizuje pozycja 16 w dowolnym układzie słonecznym.' },
      { type: 'paragraph', content: 'To misja typu "wysokie ryzyko, wysoka nagroda". Nigdy nie wiesz, co Twoja flota znajdzie, a wyniki mogą być zarówno fantastyczne, jak i tragiczne.' },
      { type: 'header', content: 'Jak przeprowadzić Wyprawę?' },
      { type: 'list', items: [
        'Odblokuj Astrofizykę: Kluczową technologią jest Astrofizyka. Każdy jej poziom pozwala Ci na jednoczesne prowadzenie jednej dodatkowej wyprawy.',
        'Przygotuj flotę: Wybierz statki, które chcesz wysłać. Misja wymaga co najmniej jednego Okrętu Badawczego. Skład floty ma znaczenie – im większa i bardziej zróżnicowana, tym większe szanse na pozytywne wyniki. Wysłanie większej liczby Okrętów Badawczych znacząco zwiększa szansę na znalezienie cennych skarbów.',
        'Wybierz cel: W panelu "Flota" jako cel wpisz dowolne koordynaty, ale zawsze z pozycją 16, na przykład [1:42:16].',
        'Wybierz misję "Wyprawa": Z dostępnych opcji misji wybierz "Wyprawa".',
        'Określ czas trwania: Możesz zdecydować, jak długo Twoja flota ma pozostać w nieznanej przestrzeni (zazwyczaj od 1 do kilku godzin). Dłuższe wyprawy zwiększają szanse na lepsze znaleziska, ale również na większe niebezpieczeństwo.',
        'Wyślij flotę: Po zatwierdzeniu, flota wyruszy w nieznane.',
      ]},
      { type: 'header', content: 'Możliwe wyniki Wyprawy:' },
      { type: 'list', items: [
        'Znalezienie surowców: Najczęstszy pozytywny wynik. Twoja flota natrafia na pole asteroid lub wrak i przywozi dużą ilość Metalu, Kryształu lub Deuteru.',
        'Znalezienie kredytów: Natrafiasz na starożytny skarbiec lub wrak statku handlowego z kredytami.',
        'Znalezienie porzuconej floty: Odkrywasz dryfujące w przestrzeni, w pełni sprawne statki, które dołączają do Twojej floty. Możesz znaleźć wszystko, od myśliwców po okręty wojenne!',
        'Nic: Czasem po prostu nic się nie dzieje. Twoja flota wraca bezpiecznie, ale z pustymi ładowniami, zużywając jedynie deuter na podróż.',
        'Opóźnienie powrotu: Flota wpada w anomalię czasoprzestrzenną lub burzę kosmiczną, co opóźnia jej powrót o pewien czas.',
        'Atak piratów: Twoja flota zostaje zaatakowana przez kosmicznych piratów. Dochodzi do walki, w której możesz ponieść straty.',
        'Atak obcych: Znacznie groźniejszy wariant. Napotykasz wrogą, zaawansowaną rasę obcych. Walka jest nieunikniona i zazwyczaj kończy się ciężkimi stratami.',
        'Całkowita utrata floty: Najgorszy możliwy scenariusz. Twoja flota wpada w czarną dziurę lub zostaje zniszczona przez nieznaną siłę. Tracisz wszystkie wysłane statki.',
      ]},
       { type: 'paragraph', content: 'Podsumowując, wyprawy to fantastyczny sposób na zdobycie darmowych surowców i statków, ale zawsze wiążą się z ryzykiem. Kluczem jest balansowanie wielkości wysyłanej floty – nie wysyłaj wszystkiego, czego nie jesteś gotów stracić.' }
    ]
  }
};

const EventCard: React.FC<{ eventData: { icon: string; name: string; description: string; } }> = ({ eventData }) => {
    return (
        <div className="bg-gray-900 bg-opacity-70 p-4 rounded-lg border border-gray-700 flex items-start gap-4">
            <div className="text-4xl mt-1">
                {eventData.icon}
            </div>
            <div className="flex-1">
                <h3 className="text-xl font-bold text-white">{eventData.name}</h3>
                <p className="text-gray-400 mt-1 text-sm">{eventData.description}</p>
            </div>
        </div>
    );
};

const MissionCard: React.FC<{ missionData: { icon: string; name: string; description: any[] } }> = ({ missionData }) => {
    return (
        <div className="bg-gray-900 bg-opacity-70 p-4 rounded-lg border border-gray-700 flex items-start gap-4">
            <div className="text-4xl mt-1">
                {missionData.icon}
            </div>
            <div className="flex-1">
                <h3 className="text-xl font-bold text-white">{missionData.name}</h3>
                <div className="text-gray-400 mt-2 text-sm space-y-3">
                    {missionData.description.map((item, index) => {
                        if (item.type === 'paragraph') {
                            return <p key={index}>{item.content}</p>;
                        }
                        if (item.type === 'header') {
                            return <h4 key={index} className="font-semibold text-gray-200 text-base pt-2">{item.content}</h4>;
                        }
                        if (item.type === 'list') {
                            return (
                                <ul key={index} className="list-disc list-inside space-y-1 pl-2">
                                    {item.items.map((li: string, i: number) => <li key={i}>{li}</li>)}
                                </ul>
                            );
                        }
                        return null;
                    })}
                </div>
            </div>
        </div>
    );
};


const EncyclopediaModal: React.FC<EncyclopediaModalProps> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<EncyclopediaTab>('buildings');

    const TABS: { id: EncyclopediaTab, label: string, icon: string, data: any }[] = [
        { id: 'buildings', label: 'Budynki', icon: '🏢', data: BUILDING_DATA },
        { id: 'research', label: 'Badania', icon: '🔬', data: RESEARCH_DATA },
        { id: 'ships', label: 'Statki', icon: '🚀', data: SHIPYARD_DATA },
        { id: 'defense', label: 'Obrona', icon: '🛡️', data: DEFENSE_DATA },
        { id: 'missions', label: 'Misje', icon: '🗺️', data: MISSION_DESCRIPTIONS },
        { id: 'events', label: 'Wydarzenia', icon: '🎲', data: EVENT_DESCRIPTIONS },
    ];
    
    const activeTabData = TABS.find(t => t.id === activeTab)?.data || {};

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
            aria-modal="true" 
            role="dialog"
            onClick={onClose}
        >
            <div 
                className="bg-gray-800 border-2 border-cyan-500 rounded-2xl shadow-2xl max-w-5xl w-full text-left transform transition-all relative flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b border-cyan-700">
                     <button 
                        onClick={onClose} 
                        className="absolute top-4 right-4 text-gray-400 hover:text-white text-3xl font-bold"
                        aria-label="Zamknij"
                    >
                        &times;
                    </button>
                    <h2 className="text-3xl font-bold text-cyan-300">Encyklopedia</h2>
                </div>

                <div className="flex border-b border-gray-600 px-4 overflow-x-auto">
                    {TABS.map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-shrink-0 flex items-center px-4 py-3 text-base font-semibold transition-colors duration-200 -mb-px border-b-2
                                ${activeTab === tab.id
                                    ? 'text-cyan-300 border-cyan-400'
                                    : 'text-gray-400 border-transparent hover:text-white hover:border-gray-500'
                                }`}
                        >
                            <span className="text-xl mr-2">{tab.icon}</span> {tab.label}
                        </button>
                    ))}
                </div>
                
                <div className="max-h-[70vh] overflow-y-auto p-6 space-y-4">
                    {Object.keys(activeTabData).map(itemId => {
                        if (activeTab === 'events') {
                            return <EventCard key={itemId} eventData={activeTabData[itemId]} />;
                        }
                        if (activeTab === 'missions') {
                            return <MissionCard key={itemId} missionData={activeTabData[itemId]} />;
                        }
                        return <ItemCard key={itemId} itemData={activeTabData[itemId]} />;
                    })}
                </div>
            </div>
        </div>
    );
};

export default EncyclopediaModal;