export interface Story {
    title: string;
    paragraphs: string[];
}

export type LoadingStep = 'Escrevendo a história...' | 'Criando a narração...' | 'Desenhando as ilustrações...';