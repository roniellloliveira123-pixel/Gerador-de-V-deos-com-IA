
import React from 'react';

interface ThemeSelectorProps {
    themes: string[];
    selectedTheme: string;
    onSelectTheme: (theme: string) => void;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ themes, selectedTheme, onSelectTheme }) => {
    // Verifica se o tema selecionado está na lista pré-definida
    const isCustomTheme = selectedTheme && !themes.includes(selectedTheme);

    return (
        <div>
            <h2 className="text-2xl font-semibold text-center mb-6 text-gray-700">2. Defina o Tópico do Vídeo</h2>
            
            {/* Botões Pré-definidos */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {themes.map((theme) => (
                    <button
                        key={theme}
                        onClick={() => onSelectTheme(theme)}
                        className={`p-4 rounded-lg text-center font-semibold transition-all duration-200 transform hover:scale-105 shadow-md ${
                            selectedTheme === theme
                                ? 'bg-purple-600 text-white ring-4 ring-purple-300'
                                : 'bg-white hover:bg-purple-100 text-gray-700'
                        }`}
                    >
                        {theme}
                    </button>
                ))}
            </div>

            {/* Divisor */}
            <div className="relative flex py-5 items-center">
                <div className="flex-grow border-t border-gray-300"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 font-semibold">OU DIGITE O SEU</span>
                <div className="flex-grow border-t border-gray-300"></div>
            </div>

            {/* Campo Personalizado */}
            <div className="relative">
                <input
                    type="text"
                    value={isCustomTheme ? selectedTheme : ''}
                    onChange={(e) => onSelectTheme(e.target.value)}
                    placeholder="Ex: Arca de Noé, O que é inflação, O poder do hábito..."
                    className={`w-full p-4 rounded-lg border-2 outline-none transition-all shadow-sm text-lg ${
                        isCustomTheme 
                            ? 'border-purple-500 bg-purple-50 text-purple-900 ring-2 ring-purple-200' 
                            : 'border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200'
                    }`}
                />
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                    ✍️
                </div>
            </div>
            <p className="text-sm text-gray-500 mt-2 text-center">
                Digite um tema e a IA criará um roteiro de vídeo sobre ele.
            </p>
        </div>
    );
};

export default ThemeSelector;
