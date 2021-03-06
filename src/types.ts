export type Coords = [number, number, number];
export type Point = number[];
export type Ring = Point[];

export interface Bound {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

export interface Settings {
    bound: Bound;
    minZoom: number;
    maxZoom: number;

    rasterSize: number;
    convolutionRadius: number;
    turdSize: number;
    simplificationTolerance: number;
}

export interface Telemetry {
    tileCount: number;
    time: number;
}

export interface Tileset {
    id: string;
    settings: Settings;
    telemetry: Telemetry;
}
