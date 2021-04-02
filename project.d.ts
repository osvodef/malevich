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

declare module 'geojson-vt' {
    interface TileIndex {
        getTile: (zoom: number, x: number, y: number) => VectorTile;
    }

    interface Params {
        maxZoom: number;
        tolerance: number;
    }

    export default function geojsonvt(geojson: Feature<MultiPolygon>, params: Params): TileIndex;
}

declare module 'vt-pbf' {
    export function fromGeojsonVt(mapping: { [layer: string]: VectorTile }): Buffer;
}

declare module '@mapbox/mbtiles' {
    type Callback = (err?: Error) => void;

    export interface Handle {
        startWriting: (callback: Callback) => void;
        stopWriting: (callback: Callback) => void;
        putTile: (z: number, x: number, y: number, buffer: Buffer, callback: Callback) => void;
    }

    export default class {
        constructor(path: string, callback: (err?: Error, mbtiles: Handle) => void);
    }
}
