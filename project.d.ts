declare module 'potrace' {
    interface Params {
        alphaMax: number;
        optCurve: boolean;
        turdSize: number;
        blackOnWhite: boolean;
        threshold: number;
    }

    export class Potrace {
        loadImage(url: string, callback: () => void): void;
        setParameters(params: Params): void;
        getPathTag(): string;
    }
}

declare module 'parse-svg-path' {
    interface ParsedPath {}

    export default function parse(path: string): ParsedPath;
}
