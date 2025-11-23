
import React, { useState, useCallback } from 'react';
import { NICHES, THEME_EXAMPLES, VOICES } from './constants';
import type { Story } from './types';
import { generateStoryText, generateStoryImage, generateStoryAudio, checkApiStatus } from './services/geminiService';
import NicheSelector from './components/NicheSelector';
import ThemeSelector from './components/ThemeSelector';
import VoiceSelector from './components/VoiceSelector';
import StoryPlayer from './components/StoryPlayer';
import Spinner from './components/Spinner';
import { LogoIcon, ShieldCheckIcon, ClockIcon, CheckCircleIcon, AlertTriangleIcon } from './components/icons';

// Função auxiliar para esperar um tempo (delay)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type ApiStatus = 'idle' | 'checking' | 'ready' | 'busy';

const App: React.FC = () => {
    const [selectedNiche, setSelectedNiche] = useState<string>(NICHES[0].id);
    const [selectedTheme, setSelectedTheme] = useState<string>('');
    const [selectedVoice, setSelectedVoice] = useState<string>(VOICES[0].id);
    const [story, setStory] = useState<Story | null>(null);
    const [images, setImages] = useState<string[]>([]);
    const [audioData, setAudioData] = useState<string[] | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadingStep, setLoadingStep] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [showPlayer, setShowPlayer] = useState<boolean>(false);
    const [apiStatus, setApiStatus] = useState<ApiStatus>('idle');

    const handleCheckApi = useCallback(async () => {
        setApiStatus('checking');
        setError(null);
        try {
            const result = await checkApiStatus();
            setApiStatus(result.status);
        } catch (err: any) {
            setError(err.message || 'Falha ao verificar a disponibilidade da IA.');
            setApiStatus('idle'); // Reset on unknown error
        }
    }, []);

    const handleGenerateStory = useCallback(async () => {
        if (!selectedTheme) {
            setError('Por favor, defina um tema para a história.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setStory(null);
        setImages([]);
        setAudioData(null);

        try {
            // 1. Generate Story Text
            setLoadingStep('Escrevendo o roteiro...');
            const generatedStory = await generateStoryText(selectedTheme, selectedNiche);
            setStory(generatedStory);
            
            const totalScenes = generatedStory.paragraphs.length;
            const newImages: string[] = [];
            const newAudios: string[] = [];

            // Geração Sequencial de Imagens e Áudios
            for (let i = 0; i < totalScenes; i++) {
                const paragraph = generatedStory.paragraphs[i];
                
                setLoadingStep(`Produzindo cena ${i + 1} de ${totalScenes}...`);

                try {
                    // Gera Áudio
                    const audio = await generateStoryAudio(paragraph, selectedVoice);
                    newAudios.push(audio);
                    
                    await delay(1000); 

                    // Gera Imagem
                    const isLastScene = i === totalScenes - 1;
                    const imageUrl = await generateStoryImage(paragraph, isLastScene, selectedNiche);
                    newImages.push(imageUrl);
                    
                    await delay(1000);

                } catch (stepError) {
                    console.error(`Erro na cena ${i + 1}`, stepError);
                    throw new Error(`Falha ao gerar a cena ${i + 1}. A rede pode estar ocupada.`);
                }
            }
            
            setAudioData(newAudios);
            setImages(newImages);

        } catch (err: any) {
            console.error(err);
            let msg = 'Ocorreu um erro ao gerar a história.';
            if (err.message.includes('429') || err.message.includes('quota')) {
                msg = 'Muitas pessoas estão usando a IA agora. Por favor, aguarde e tente novamente.';
            } else {
                msg = err.message || msg;
            }
            setError(msg);
        } finally {
            setIsLoading(false);
            setLoadingStep('');
        }
    }, [selectedTheme, selectedVoice, selectedNiche]);
    
    const handleReset = () => {
        setSelectedNiche(NICHES[0].id);
        setSelectedTheme('');
        setSelectedVoice(VOICES[0].id);
        setStory(null);
        setImages([]);
        setAudioData(null);
        setError(null);
        setShowPlayer(false);
        setApiStatus('idle');
    };
    
    const otherScenesCount = story ? story.paragraphs.length - 4 : 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-yellow-100 text-gray-800">
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <header className="text-center mb-10">
                    <div className="flex items-center justify-center gap-4 mb-4">
                       <LogoIcon />
                       <h1 className="text-3xl md:text-4xl font-bold text-purple-700">Gerador de Vídeos com IA</h1>
                    </div>
                    <p className="text-lg text-gray-600">Crie vídeos curtos para seu canal em minutos.</p>
                </header>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
                        <strong className="font-bold">Erro: </strong>
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}
                
                {!story && !isLoading && (
                    <div className="bg-white/70 backdrop-blur-sm p-8 rounded-2xl shadow-lg">
                        <NicheSelector
                            niches={NICHES}
                            selectedNiche={selectedNiche}
                            onSelectNiche={(niche) => {
                                setSelectedNiche(niche);
                                setSelectedTheme(''); // Reset theme when niche changes
                            }}
                        />
                        <ThemeSelector
                            themes={THEME_EXAMPLES[selectedNiche] || []}
                            selectedTheme={selectedTheme}
                            onSelectTheme={setSelectedTheme}
                        />
                         <VoiceSelector
                            voices={VOICES}
                            selectedVoice={selectedVoice}
                            onSelectVoice={setSelectedVoice}
                        />

                        <div className="text-center mt-8 border-t pt-8 border-gray-200">
                            <h2 className="text-2xl font-semibold text-center mb-4 text-gray-700">4. Verifique a Disponibilidade</h2>
                            <p className="text-gray-500 mb-4 text-sm max-w-md mx-auto">Para evitar falhas, verifique se a IA não está sobrecarregada antes de começar a gerar.</p>
                            
                            <button
                                onClick={handleCheckApi}
                                disabled={apiStatus === 'checking'}
                                className="inline-flex items-center justify-center gap-3 bg-white text-gray-700 font-bold py-3 px-8 rounded-full border-2 border-gray-300 hover:bg-gray-100 disabled:bg-gray-200 transition-all duration-300 shadow-sm"
                            >
                                {apiStatus === 'checking' ? <ClockIcon /> : <ShieldCheckIcon />}
                                Verificar Status da IA
                            </button>
                            
                            {apiStatus === 'checking' && (
                                <div className="mt-4 flex items-center justify-center gap-2 text-gray-500 animate-pulse">
                                    <Spinner /> Verificando...
                                </div>
                            )}

                            {apiStatus === 'ready' && (
                                <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-lg flex items-center justify-center gap-2 animate-fade-in">
                                    <CheckCircleIcon />
                                    <span>A IA está pronta! Você já pode gerar seu vídeo.</span>
                                </div>
                            )}

                            {apiStatus === 'busy' && (
                                <div className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded-lg flex items-center justify-center gap-2 animate-fade-in">
                                    <AlertTriangleIcon />
                                    <span>A IA está ocupada. Por favor, aguarde um minuto e verifique novamente.</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="text-center mt-8">
                            <button
                                onClick={handleGenerateStory}
                                disabled={!selectedTheme || isLoading || apiStatus !== 'ready'}
                                className="bg-purple-600 text-white font-bold py-3 px-10 rounded-full hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg"
                            >
                                Gerar Vídeo
                            </button>
                        </div>
                    </div>
                )}

                {isLoading && (
                    <div className="flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm p-8 rounded-2xl shadow-lg min-h-[300px]">
                        <Spinner />
                        <p className="text-purple-700 font-semibold text-xl mt-6 animate-pulse text-center px-4">
                            {loadingStep}
                        </p>
                        <p className="text-gray-500 text-sm mt-2">Isso pode levar alguns minutos...</p>
                    </div>
                )}

                {story && !isLoading && !showPlayer && (
                     <div className="bg-white/70 backdrop-blur-sm p-8 rounded-2xl shadow-lg animate-fade-in">
                        <h2 className="text-3xl font-bold text-center text-purple-800 mb-6">{story.title}</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           {images.slice(0, 4).map((img, idx) => (
                                <div key={`img-${idx}`} className="relative group overflow-hidden rounded-xl shadow-md aspect-video">
                                    <img src={img} alt="Preview" className="w-full h-full object-cover" />
                                </div>
                            ))}
                            {otherScenesCount > 0 && (
                                <div className="flex items-center justify-center bg-purple-50 rounded-xl aspect-video border-2 border-dashed border-purple-300 text-purple-400">
                                    + {otherScenesCount} outras cenas...
                                </div>
                            )}
                        </div>

                         <div className="text-center mt-10 space-x-4 flex flex-col md:flex-row justify-center gap-4">
                              <button
                                onClick={() => setShowPlayer(true)}
                                className="bg-yellow-400 text-gray-900 font-bold py-4 px-12 rounded-full hover:bg-yellow-500 transition-all duration-300 transform hover:scale-105 shadow-xl flex items-center justify-center gap-2 text-lg"
                            >
                                <span className="text-2xl">▶</span> Assistir e Baixar Vídeo
                            </button>
                             <button
                                onClick={handleReset}
                                className="bg-gray-200 text-gray-700 font-bold py-4 px-10 rounded-full hover:bg-gray-300 transition-all duration-300"
                            >
                                Criar Novo Vídeo
                            </button>
                         </div>
                    </div>
                )}

                {showPlayer && story && audioData && (
                    <StoryPlayer
                        story={story}
                        images={images}
                        audioData={audioData}
                        onClose={() => setShowPlayer(false)}
                    />
                )}
            </div>
        </div>
    );
};

export default App;
