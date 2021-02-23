declare module 'potrace' {
    interface Params {
        alphaMax: number;
        optCurve: boolean;
        turdSize: number;
        blackOnWhite: boolean;
        threshold: number;
    }

    export class Potrace {
        loadImage(image: NodeCanvasImageData, callback: () => void): void;
        setParameters(params: Params): void;
        getPathTag(): string;
        getSVG(): string;
    }
}

declare module 'parse-svg-path' {
    type ControlPoint = [string, number, number];
    type ParsedPath = ControlPoint[];

    export default function parse(path: string): ParsedPath;
}
