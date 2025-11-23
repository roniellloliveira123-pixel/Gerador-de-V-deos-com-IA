import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Story } from '../types';
import { CloseIcon, PlayIcon, PauseIcon, ReplayIcon, DownloadIcon } from './icons';
import Spinner from './Spinner';

function decodeBase64(base64: string): Uint8Array {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodePcm(
  pcmData: Uint8Array,
  audioContext: AudioContext,
): Promise<AudioBuffer> {
  const sampleRate = 24000;
  const numChannels = 1;
  const dataInt16 = new Int16Array(pcmData.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = audioContext.createBuffer(numChannels, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

function getTextSegments(text: string) {
    if (!text) return [];
    const rawSegments = text.match(/[^.!?,\n]+[.!?,\n]*|[^.!?,\n]+$/g) || [text];
    const totalLength = text.length;
    let currentAccumulatedLength = 0;
    return rawSegments.map(segment => {
        const trimmed = segment.trim();
        if (!trimmed) return null;
        const startRatio = currentAccumulatedLength / totalLength;
        currentAccumulatedLength += segment.length; 
        const endRatio = Math.min(currentAccumulatedLength / totalLength, 1);
        return { text: trimmed, startRatio, endRatio };
    }).filter(Boolean) as { text: string, startRatio: number, endRatio: number }[];
}

interface StoryPlayerProps {
    story: Story;
    images: string[];
    audioData: string[];
    onClose: () => void;
}

const StoryPlayer: React.FC<StoryPlayerProps> = ({ story, images, audioData, onClose }) => {
    const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [subtitle, setSubtitle] = useState("");
    
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);

    const audioContextRef = useRef<AudioContext | null>(null);
    const audioBuffersRef = useRef<AudioBuffer[]>([]);
    const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
    
    const currentIndexRef = useRef(0);
    const isManualPauseRef = useRef(false);
    
    const startedAtRef = useRef<number>(0);
    const pausedAtRef = useRef<number>(0);
    const animationFrameRef = useRef<number | null>(null);

    const updateSubtitle = useCallback(() => {
        if (!isPlaying || !sourceNodeRef.current || !audioContextRef.current) {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
            return;
        }

        const audioContext = audioContextRef.current;
        const buffer = audioBuffersRef.current[currentIndexRef.current];
        if (!buffer) return;

        const elapsedTime = (audioContext.currentTime - startedAtRef.current) + pausedAtRef.current;
        const progress = Math.min(elapsedTime / buffer.duration, 1);
        
        const text = story.paragraphs[currentIndexRef.current];
        const segments = getTextSegments(text);

        let currentSegment = null;
        for (const segment of segments) {
            if (progress >= segment.startRatio && progress <= segment.endRatio + 0.001) {
                currentSegment = segment;
                break;
            }
        }
        
        if (currentSegment) {
            const segmentProgress = (progress - currentSegment.startRatio) / (currentSegment.endRatio - currentSegment.startRatio);
            const charsToShow = Math.floor(currentSegment.text.length * segmentProgress);
            setSubtitle(currentSegment.text.substring(0, charsToShow));
        } else {
            setSubtitle(""); 
        }

        animationFrameRef.current = requestAnimationFrame(updateSubtitle);
    }, [isPlaying, story.paragraphs]);

    const playParagraph = useCallback((index: number, offset: number = 0) => {
        if (index >= audioBuffersRef.current.length) {
            setIsPlaying(false);
            setIsFinished(true);
            setSubtitle("");
            return;
        }
        
        const audioContext = audioContextRef.current;
        if (!audioContext) return;
        
        if (sourceNodeRef.current) {
            sourceNodeRef.current.onended = null;
            try { sourceNodeRef.current.stop(); } catch(e) {}
        }

        currentIndexRef.current = index;
        setCurrentParagraphIndex(index);
        isManualPauseRef.current = false;

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffersRef.current[index];
        source.connect(audioContext.destination);
        source.onended = () => {
            if (!isManualPauseRef.current) {
                pausedAtRef.current = 0; 
                playParagraph(index + 1);
            }
        };
        source.start(0, offset);
        sourceNodeRef.current = source;
        startedAtRef.current = audioContext.currentTime - offset;
        setIsPlaying(true);
        setIsFinished(false);
    }, []);

    const pauseAudio = useCallback(() => {
        const audioContext = audioContextRef.current;
        const sourceNode = sourceNodeRef.current;
        if (!audioContext || !sourceNode) return;
        
        isManualPauseRef.current = true;
        const elapsedTime = audioContext.currentTime - startedAtRef.current;
        pausedAtRef.current = elapsedTime;
        setIsPlaying(false);
        try { sourceNode.stop(); } catch (e) {}
    }, []);
    
    const handleReplay = useCallback(() => {
        setIsFinished(false);
        pausedAtRef.current = 0;
        playParagraph(0);
    }, [playParagraph]);

    const togglePlay = () => {
        if (isPlaying) {
            pauseAudio();
        } else {
            if (isFinished) {
                handleReplay();
            } else {
                if (audioContextRef.current?.state === 'suspended') {
                    audioContextRef.current.resume();
                }
                playParagraph(currentIndexRef.current, pausedAtRef.current);
            }
        }
    };
    
    const handleDownloadVideo = useCallback(async () => {
        setIsDownloading(true);
        setDownloadProgress(0);
        if (isPlaying) pauseAudio();
    
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
    
        const audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        
        const dlAudioBuffers = await Promise.all(audioData.map(b64 => decodePcm(decodeBase64(b64), audioCtx)));
    
        const stream = canvas.captureStream(30);
        const finalStream = new MediaStream([...stream.getTracks(), ...dest.stream.getTracks()]);
        
        let mimeType = 'video/mp4; codecs=avc1.42E01E,mp4a.40.2';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
        
        const recorder = new MediaRecorder(finalStream, { mimeType, videoBitsPerSecond: 8000000 });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
            a.download = `${story.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`;
            a.click();
            URL.revokeObjectURL(url);
            setIsDownloading(false);
            audioCtx.close();
        };
    
        recorder.start();
        
        const loadedImages = await Promise.all(images.map(src => src ? fetch(src).then(r => r.blob()).then(b => createImageBitmap(b)).catch(()=>null) : Promise.resolve(null)));
        
        const animationParams = loadedImages.map(() => ({
            startScale: Math.random() * 0.1 + 1.0, endScale: Math.random() * 0.1 + 1.1,
            startX: (Math.random() - 0.5) * 80, endX: (Math.random() - 0.5) * 80,
            startY: (Math.random() - 0.5) * 40, endY: (Math.random() - 0.5) * 40,
        }));
    
        let accumulatedTime = 0;
        const totalDuration = dlAudioBuffers.reduce((acc, buf) => acc + buf.duration, 0);
    
        for (let i = 0; i < dlAudioBuffers.length; i++) {
            const buffer = dlAudioBuffers[i];
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(dest);
    
            await new Promise<void>(resolve => {
                let animationId: number;
                source.onended = () => { cancelAnimationFrame(animationId); resolve(); };
                source.start(audioCtx.currentTime);
                const startTime = audioCtx.currentTime;
                const duration = buffer.duration;
    
                const renderLoop = () => {
                    const elapsed = audioCtx.currentTime - startTime;
                    if (elapsed > duration) return;
                    const progress = elapsed / duration;
                    
                    ctx.fillStyle = 'black';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
                    const img = loadedImages[i];
                    if (img) {
                        const anim = animationParams[i];
                        const scale = anim.startScale + (anim.endScale - anim.startScale) * progress;
                        const x = anim.startX + (anim.endX - anim.startX) * progress;
                        const y = anim.startY + (anim.endY - anim.startY) * progress;
                        const sW = img.width / scale, sH = img.height / scale;
                        const sX = (img.width - sW) / 2 - x, sY = (img.height - sH) / 2 - y;
                        ctx.drawImage(img, sX, sY, sW, sH, 0, 0, canvas.width, canvas.height);
                    }
                    
                    const text = story.paragraphs[i];
                    const segments = getTextSegments(text);
                    let currentSegment = null;
                    for (const segment of segments) {
                        if (progress >= segment.startRatio && progress <= segment.endRatio + 0.001) { currentSegment = segment; break; }
                    }
    
                    if (currentSegment) {
                        const segmentProgress = (progress - currentSegment.startRatio) / (currentSegment.endRatio - currentSegment.startRatio);
                        const charsToShow = Math.floor(currentSegment.text.length * segmentProgress);
                        const subtitleText = currentSegment.text.substring(0, charsToShow);
    
                        ctx.font = 'bold 52px Poppins, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.lineWidth = 8;
                        ctx.strokeStyle = 'white';
                        ctx.fillStyle = '#FACC15';
                        ctx.strokeText(subtitleText, canvas.width / 2, canvas.height - 80);
                        ctx.fillText(subtitleText, canvas.width / 2, canvas.height - 80);
                    }
    
                    setDownloadProgress(((accumulatedTime + elapsed) / totalDuration) * 100);
                    animationId = requestAnimationFrame(renderLoop);
                };
                renderLoop();
            });
    
            accumulatedTime += buffer.duration;
        }
    
        recorder.stop();
    }, [isPlaying, audioData, images, story, pauseAudio]);

    useEffect(() => {
        if (isPlaying) {
            animationFrameRef.current = requestAnimationFrame(updateSubtitle);
        } else {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        }
        return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current) };
    }, [isPlaying, updateSubtitle]);

    useEffect(() => {
        let isCancelled = false;
        if (!audioContextRef.current) audioContextRef.current = new AudioContext();
        
        const setup = async () => {
            try {
                const audioCtx = audioContextRef.current!;
                const buffers = await Promise.all(audioData.map(b64 => decodePcm(decodeBase64(b64), audioCtx)));
                if (isCancelled) return;
                audioBuffersRef.current = buffers;
                
                setIsReady(true);
                playParagraph(0);
            } catch (error) {
                console.error("Erro ao preparar player:", error);
            }
        };

        setup();

        return () => {
            isCancelled = true;
            pauseAudio();
            audioContextRef.current?.close();
            audioContextRef.current = null;
        };
    }, [audioData, playParagraph, pauseAudio]); 

    if (!isReady) return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"><Spinner /><p className="text-white ml-4">Preparando o filme...</p></div>
    );

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 text-white p-4 animate-fade-in">
            <div className="absolute top-4 right-4 flex gap-4 z-50">
                 <button onClick={handleDownloadVideo} disabled={isDownloading} className="bg-white/20 hover:bg-white/30 rounded-full p-3 transition-colors disabled:opacity-50">
                    {isDownloading ? <Spinner /> : <DownloadIcon/>}
                 </button>
                <button onClick={onClose} className="bg-white/20 hover:bg-white/30 rounded-full p-3 transition-colors"><CloseIcon /></button>
            </div>

            <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/20">
                {images.map((imgSrc, index) => {
                    const isActive = index === currentParagraphIndex;
                    return (
                         <img
                            key={`img-${index}`}
                            src={imgSrc}
                            alt={`Cena ${index + 1}`}
                            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${isActive ? 'opacity-100' : 'opacity-0'}`}
                            style={{ zIndex: isActive ? 10 : 1 }}
                        />
                    )
                })}

                <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 to-transparent z-20 pointer-events-none"></div>
                <div className="absolute bottom-10 left-0 right-0 px-8 text-center z-30 pointer-events-none">
                   <p 
                      key={currentParagraphIndex}
                      className="text-2xl md:text-4xl font-bold animate-fade-in"
                      style={{
                          textShadow: '0 0 10px black, 0 0 10px black, 0 0 15px black',
                          color: '#FACC15', // yellow-400
                      }}
                   >
                       {subtitle}<span className="opacity-70 animate-pulse">|</span>
                   </p>
                </div>
                
                {isDownloading && (
                     <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                        <Spinner />
                        <p className="text-xl font-semibold text-white">Gerando seu vídeo...</p>
                        <div className="w-1/2 bg-gray-600 rounded-full h-2.5">
                            <div className="bg-purple-500 h-2.5 rounded-full" style={{ width: `${downloadProgress}%` }}></div>
                        </div>
                        <p className="text-sm text-gray-300">{Math.round(downloadProgress)}%</p>
                    </div>
                )}
            </div>

            <div className="mt-8 flex gap-6 items-center">
                 <button onClick={togglePlay} className="text-yellow-400 hover:text-yellow-300 transition-transform transform hover:scale-110">
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
                {isFinished && (
                    <button onClick={handleReplay} className="text-white hover:text-gray-300 transition-transform transform hover:scale-110">
                        <ReplayIcon />
                    </button>
                )}
            </div>
        </div>
    );
};

export default StoryPlayer;