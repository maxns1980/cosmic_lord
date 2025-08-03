
import React from 'react';

interface InfoModalProps {
    onClose: () => void;
    onResetGame: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ onClose, onResetGame }) => {
    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
            aria-modal="true" 
            role="dialog"
            onClick={onClose}
        >
            <div 
                className="bg-gray-800 border-2 border-cyan-500 rounded-2xl shadow-2xl max-w-3xl w-full text-left transform transition-all relative"
                onClick={e => e.stopPropagation()} // Prevent closing when clicking inside the modal
            >
                <div className="p-8">
                    <button 
                        onClick={onClose} 
                        className="absolute top-4 right-4 text-gray-400 hover:text-white text-3xl font-bold"
                        aria-label="Zamknij"
                    >
                        &times;
                    </button>
                    <h2 className="text-3xl font-bold text-cyan-300 mb-6 border-b border-cyan-700 pb-3">Informacje o Grze</h2>
                    
                    <div className="max-h-[70vh] overflow-y-auto pr-4 space-y-6">
                        <section>
                            <h3 className="text-xl font-bold text-white mb-2">Cel Gry</h3>
                            <p className="text-gray-300">
                                Witaj w "Kosmicznym Władcy"! Twoim celem jest stanie się dominującą siłą w galaktyce. Zaczynasz z małą, nierozwiniętą planetą, a Twoim zadaniem jest rozwój ekonomiczny i technologiczny, budowa potężnej floty i obrony, oraz interakcja z innymi mieszkańcami kosmosu. Zarządzaj surowcami, prowadź badania, kolonizuj, walcz i handluj, aby Twoje imię było znane w całym wszechświecie. Pamiętaj, że gra toczy się dalej, nawet gdy jesteś offline!
                            </p>
                        </section>
                        
                        <section>
                            <h3 className="text-xl font-bold text-white mb-2">Kluczowe Możliwości</h3>
                            <ul className="list-disc list-inside text-gray-300 space-y-2">
                                <li><strong>Rozwój Planety:</strong> Buduj kopalnie, elektrownie i fabryki, aby zwiększyć produkcję i odblokować nowe technologie.</li>
                                <li><strong>Badania:</strong> Rozwijaj technologie, aby ulepszać swoje statki, obronę i zdolności produkcyjne.</li>
                                <li><strong>Stocznia:</strong> Konstruuj różnorodne statki, od szybkich myśliwców po potężne Gwiazdy Śmierci.</li>
                                <li><strong>Obrona:</strong> Zabezpiecz swoją planetę przed atakami wrogów za pomocą dział laserowych, wieżyczek plazmowych i innych struktur obronnych.</li>
                                <li><strong>Misje Floty:</strong> Wysyłaj floty na misje bojowe, szpiegowskie, kolonizacyjne, ekspedycje i inne.</li>
                                <li><strong>Wydarzenia Losowe:</strong> Zmierz się z nieoczekiwanymi wydarzeniami, takimi jak uderzenia asteroid, ataki piratów czy odkrycia starożytnych artefaktów.</li>
                                <li><strong>Postęp Offline:</strong> Twoje imperium rozwija się nawet wtedy, gdy nie grasz. Po powrocie otrzymasz podsumowanie tego, co się wydarzyło.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-white mb-2">Porady dla Początkujących</h3>
                             <ul className="list-disc list-inside text-gray-300 space-y-2">
                                <li>Skup się na produkcji surowców na początku. Kopalnie Metalu i Kryształu to podstawa.</li>
                                <li>Nie zapominaj o energii! Niska produkcja energii spowolni Twoje kopalnie.</li>
                                <li>Buduj magazyny, aby nie tracić surowców, gdy produkcja przekroczy pojemność.</li>
                                <li>Czytaj raporty bojowe i szpiegowskie, aby uczyć się o sile przeciwników.</li>
                                <li>Używaj Encyklopedii (ikona książki), aby poznać szczegóły dotyczące budynków, statków i badań.</li>
                             </ul>
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-red-500 mb-2">Strefa Niebezpieczna</h3>
                            <p className="text-gray-400 mb-4">
                                Poniższa akcja jest nieodwracalna. Używaj z rozwagą.
                            </p>
                            <button
                                onClick={onResetGame}
                                className="w-full px-6 py-2 text-base font-bold text-white rounded-md shadow-md transition-colors duration-300 bg-red-700 hover:bg-red-600 focus:ring-4 focus:ring-red-500 focus:ring-opacity-50"
                            >
                                Zresetuj Grę (Usuń Zapis)
                            </button>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InfoModal;