
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { Story } from '../types';

let ai: GoogleGenAI | null = null;

// Inicialização "preguiçosa" para evitar que o app quebre no carregamento
// se a chave de API não estiver disponível imediatamente.
const getAI = () => {
    if (!ai) {
        const API_KEY = process.env.API_KEY;
        if (!API_KEY) {
            throw new Error("API_KEY environment variable is not set");
        }
        ai = new GoogleGenAI({ apiKey: API_KEY });
    }
    return ai;
}

export async function checkApiStatus(): Promise<{ status: 'ready' | 'busy' }> {
    try {
        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: "Responda apenas com a palavra 'ok'.",
            config: { temperature: 0 }
        });

        if (response.text.trim().toLowerCase() === 'ok') {
            return { status: 'ready' };
        }
        return { status: 'ready' };

    } catch (error: any) {
        if (error.message && (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('rate limit'))) {
            return { status: 'busy' };
        }
        console.error("API Status Check Error:", error);
        throw new Error("Erro desconhecido ao verificar a API.");
    }
}


const storySchema = {
    type: Type.OBJECT,
    properties: {
        title: {
            type: Type.STRING,
            description: "O título do vídeo em Português do Brasil."
        },
        paragraphs: {
            type: Type.ARRAY,
            items: {
                type: Type.STRING,
                description: "Uma cena curta do roteiro em Português do Brasil."
            },
            description: "O roteiro dividido em cenas. Deve ter exatamente 8 cenas."
        }
    },
    required: ["title", "paragraphs"]
};

export async function generateStoryText(userInput: string, nicheId: string): Promise<Story> {
        const prompts: { [key: string]: { context: string; rules: string } } = {
        biblical: {
            context: `CONTEXTO: O usuário deseja uma história bíblica infantil baseada na entrada: "${userInput}".`,
            rules: `
1. Se o usuário digitou um título (ex: "Arca de Noé"), conte essa história.
2. Se o usuário digitou um VALOR ou LIÇÃO (ex: "Fé"), escolha AUTOMATICAMENTE uma história bíblica que exemplifique esse tema.
3. A história deve ser EXCLUSIVAMENTE em Português do Brasil (pt-BR), com linguagem simples e educativa.
4. A resposta JSON deve ter EXATAMENTE 8 itens no array 'paragraphs'.
5. Cada parágrafo deve ser curto (2-3 frases).
6. O título deve ser o nome da História Bíblica.
7. A última (8ª) cena DEVE ser uma despedida amigável do narrador, terminando com "Tchauuuu!".`
        },
        finance: {
            context: `CONTEXTO: O usuário deseja um roteiro de vídeo para YouTube sobre Finanças e Investimentos, baseado no tópico: "${userInput}".`,
            rules: `
1. Crie um roteiro claro, didático e em Português do Brasil (pt-BR) para um público iniciante.
2. O tom deve ser confiável, objetivo e encorajador.
3. A resposta JSON deve ter EXATAMENTE 8 itens no array 'paragraphs'.
4. Cada parágrafo deve ser uma dica, um passo ou um ponto chave do tópico.
5. O título deve ser chamativo e otimizado para busca (SEO friendly), como "5 Dicas para..." ou "O Guia Definitivo de...".
6. A última (8ª) cena DEVE ser um "call-to-action" claro, como "Gostou do vídeo? Deixe seu like e se inscreva para mais dicas financeiras!".`
        },
        personal_dev: {
            context: `CONTEXTO: O usuário deseja um roteiro de vídeo motivacional sobre Desenvolvimento Pessoal, baseado no tema: "${userInput}".`,
            rules: `
1. Elabore um roteiro inspirador e prático, em Português do Brasil (pt-BR).
2. Use uma linguagem poderosa e positiva. Pode citar filosofias como Estoicismo ou Budismo se aplicável.
3. A resposta JSON deve ter EXATAMENTE 8 itens no array 'paragraphs'.
4. Cada parágrafo deve explorar uma faceta do tema, oferecendo reflexão ou uma ação prática.
5. O título deve ser forte e despertar curiosidade.
6. A última (8ª) cena DEVE ser uma mensagem de encorajamento final e um convite para o espectador compartilhar suas experiências nos comentários.`
        },
        tech: {
            context: `CONTEXTO: O usuário deseja um roteiro para um vídeo de review ou guia sobre Tecnologia, focado em: "${userInput}".`,
            rules: `
1. Crie um roteiro informativo e direto, em Português do Brasil (pt-BR), explicando características, prós e contras.
2. O tom deve ser de um especialista acessível.
3. A resposta JSON deve ter EXATAMENTE 8 itens no array 'paragraphs'.
4. Estruture o roteiro de forma lógica: introdução, principais características, pontos positivos, pontos negativos, conclusão.
5. O título deve ser claro e específico (ex: "Review Completo do [Produto]").
6. A última (8ª) cena DEVE ser um resumo e uma recomendação final, perguntando a opinião do público nos comentários.`
        },
        curiosities: {
            context: `CONTEXTO: O usuário deseja um roteiro para um vídeo de curiosidades ou fatos desconhecidos sobre: "${userInput}". O objetivo é ser viral.`,
            rules: `
1. Crie um roteiro rápido, surpreendente e cativante em Português do Brasil (pt-BR).
2. Use frases de impacto e "ganchos" para manter o espectador interessado.
3. A resposta JSON deve ter EXATAMENTE 8 itens no array 'paragraphs', onde cada um é um fato ou uma parte de um mistério.
4. O título deve ser uma "clickbait" do bem, gerando muita curiosidade (ex: "Você não vai acreditar no que...").
5. A última (8ª) cena DEVE ser uma pergunta para o público, incentivando o engajamento, como "Qual dessas curiosidades mais te chocou? Comente abaixo!".`
        },
        spirituality: {
            context: `CONTEXTO: O usuário deseja um roteiro para um vídeo de Oração ou Espiritualidade sobre: "${userInput}".`,
            rules: `
1. Elabore um texto sereno e reconfortante, em Português do Brasil (pt-BR), adequado para meditação ou oração guiada.
2. O tom deve ser calmo, respeitoso e pacífico.
3. A resposta JSON deve ter EXATAMENTE 8 itens no array 'paragraphs'.
4. Os parágrafos devem fluir suavemente, construindo uma atmosfera de paz.
5. O título deve ser simples e direto, como "Oração da Manhã para Gratidão" ou "Meditação para Acalmar a Mente".
6. A última (8ª) cena DEVE ser uma mensagem final de paz e bênçãos, como "Que a paz esteja com você. Amém.".`
        }
    };

    const selectedPrompt = prompts[nicheId] || prompts['curiosities'];
    const prompt = `${selectedPrompt.context}\n\nREGRAS DE GERAÇÃO:\n${selectedPrompt.rules}`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: storySchema,
            temperature: 0.8
        },
    });

    const jsonText = response.text.trim();
    try {
        const parsedStory = JSON.parse(jsonText) as Story;
        if (!parsedStory.title || !Array.isArray(parsedStory.paragraphs) || parsedStory.paragraphs.length !== 8) {
            throw new Error("Formato da história inválido ou com número incorreto de cenas.");
        }
        return parsedStory;
    } catch (e) {
        console.error("Failed to parse story JSON:", jsonText, e);
        throw new Error("Não foi possível processar a história recebida.");
    }
}

export async function generateStoryImage(paragraph: string, isLastScene: boolean = false, nicheId: string): Promise<string> {
    const imageStyles: { [key: string]: { style: string; farewell: string } } = {
        biblical: {
            style: `Crie uma ilustração digital estilo Disney/Pixar, suave e colorida para uma história bíblica infantil. A cena deve corresponder EXATAMENTE a este texto: "${paragraph}". Estilo: Renderização 3D suave, iluminação mágica, cores vibrantes mas gentis.`,
            farewell: `Crie uma ilustração digital estilo Disney/Pixar, suave e colorida, com uma criança feliz ou um personagem bíblico amigável (como um anjinho) acenando 'tchau'. A imagem deve ser acolhedora e fofa.`
        },
        finance: {
            style: `Crie uma imagem limpa e moderna, estilo infográfico 3D, para um vídeo de finanças. A cena deve ilustrar o conceito de "${paragraph}". Use ícones de finanças (cifrões, gráficos, cofrinhos) e uma paleta de cores com azul, verde e branco.`,
            farewell: `Crie uma imagem limpa e moderna para a tela final de um vídeo de finanças, com ícones grandes e claros de "Like" (polegar para cima) e "Subscribe" (sino de notificação) e um gráfico de crescimento ao fundo.`
        },
        personal_dev: {
            style: `Crie uma imagem simbólica e inspiradora para um vídeo de desenvolvimento pessoal sobre "${paragraph}". Use metáforas visuais (uma pessoa subindo uma montanha, uma semente brotando, um cérebro com engrenagens). Estilo de arte conceitual, com iluminação dramática.`,
            farewell: `Crie uma imagem inspiradora com uma citação motivacional em uma tipografia elegante sobre um fundo sereno (pôr do sol, montanha). O texto na imagem deve ser: "Continue crescendo".`
        },
        tech: {
            style: `Crie uma imagem de alta qualidade, realista e com visual tecnológico (techy) para ilustrar: "${paragraph}". Pode ser um close-up de um gadget, uma pessoa usando o dispositivo ou uma representação abstrata de um software. Fundo limpo, iluminação de estúdio.`,
            farewell: `Crie uma imagem de "tela final" para um canal de tecnologia, mostrando o produto analisado em destaque e ícones de redes sociais (YouTube, Instagram, Twitter) com o texto "Siga-nos para mais reviews!".`
        },
        curiosities: {
            style: `Crie uma imagem vibrante e intrigante que ilustre o fato: "${paragraph}". O estilo pode ser uma colagem digital, fotorrealismo ou arte conceitual que desperte a curiosidade do espectador. Use cores fortes e composições dinâmicas.`,
            farewell: `Crie uma imagem com um grande ponto de interrogação no centro, cercado por vários ícones relacionados a mistério e ciência (lupa, DNA, pirâmide, planeta). O texto na imagem deve ser "O que você quer descobrir agora?".`
        },
        spirituality: {
            style: `Crie uma imagem serena e etérea para acompanhar uma oração ou meditação sobre "${paragraph}". Use elementos como luz suave, raios de sol, velas, natureza tranquila (água calma, céu estrelado). O estilo deve ser suave, quase um sonho.`,
            farewell: `Crie uma imagem com um símbolo de paz (pomba, mãos em oração, flor de lótus) emitindo uma luz suave sobre um fundo celestial. A imagem deve transmitir calma e serenidade.`
        }
    };
    
    const selectedStyle = imageStyles[nicheId] || imageStyles['curiosities'];
    let prompt: string;
    
    if (isLastScene) {
        prompt = selectedStyle.farewell;
    } else {
        prompt = selectedStyle.style;
    }
    
    const finalPrompt = `${prompt} REGRAS: NÃO inclua NENHUM texto na imagem, a menos que explicitamente solicitado. Formato wide 16:9. Alta qualidade.`;

    const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [{ text: finalPrompt }]
        },
        config: {
            imageConfig: {
                aspectRatio: "16:9"
            }
        }
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }
    }

    throw new Error("Nenhuma imagem foi gerada.");
}

export async function generateStoryAudio(storyText: string, voiceId: string): Promise<string> {
    const prompt = `Narre o seguinte texto de forma clara e com a entonação apropriada. Tom de voz: amigável e confiante. Texto: "${storyText}"`;

    const response = await getAI().models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceId },
                },
            },
        },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
        throw new Error("Nenhum áudio foi gerado.");
    }
    return audioData;
}
