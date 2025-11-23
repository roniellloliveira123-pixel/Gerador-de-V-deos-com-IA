
import React from 'react';

interface Voice {
    id: string;
    name: string;
}

interface VoiceSelectorProps {
    voices: Voice[];
    selectedVoice: string;
    onSelectVoice: (voiceId: string) => void;
}

const VoiceSelector: React.FC<VoiceSelectorProps> = ({ voices, selectedVoice, onSelectVoice }) => {
    return (
        <div className="mt-8">
            <h2 className="text-2xl font-semibold text-center mb-6 text-gray-700">3. Escolha a Voz da Narração</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {voices.map((voice) => (
                    <button
                        key={voice.id}
                        onClick={() => onSelectVoice(voice.id)}
                        className={`p-4 rounded-lg text-center font-semibold transition-all duration-200 transform hover:scale-105 shadow-md ${
                            selectedVoice === voice.id
                                ? 'bg-purple-600 text-white ring-4 ring-purple-300'
                                : 'bg-white hover:bg-purple-100 text-gray-700'
                        }`}
                    >
                        {voice.name}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default VoiceSelector;
