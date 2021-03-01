export type Point = number[];
export interface Bound {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}
export interface BoundInfo {
    widthPx: number;
    heightPx: number;
    widthM: number;
    heightM: number;
    widthTiles: number;
    heightTiles: number;
}
