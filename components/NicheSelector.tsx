
import React from 'react';

interface Niche {
    id: string;
    name: string;
}

interface NicheSelectorProps {
    niches: Niche[];
    selectedNiche: string;
    onSelectNiche: (nicheId: string) => void;
}

const NicheSelector: React.FC<NicheSelectorProps> = ({ niches, selectedNiche, onSelectNiche }) => {
    return (
        <div className="mb-8">
            <h2 className="text-2xl font-semibold text-center mb-6 text-gray-700">1. Escolha o Nicho do Canal</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {niches.map((niche) => (
                    <button
                        key={niche.id}
                        onClick={() => onSelectNiche(niche.id)}
                        className={`p-4 rounded-lg text-center font-semibold transition-all duration-200 transform hover:scale-105 shadow-md ${
                            selectedNiche === niche.id
                                ? 'bg-purple-600 text-white ring-4 ring-purple-300'
                                : 'bg-white hover:bg-purple-100 text-gray-700'
                        }`}
                    >
                        {niche.name}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default NicheSelector;
