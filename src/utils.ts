import zlib from 'zlib';
import { promisify } from 'util';
import { extent, padding } from './constants';
import { Bound, Coords, Point } from './types';

export const inflate = promisify(zlib.inflate);
export const deflate = promisify(zlib.deflate);

export function lngLatToMercator(lngLat: Point): Point {
    const lng = lngLat[0];
    const lat = lngLat[1];

    return [
        (180 + lng) / 360,
        (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360,
    ];
}

export function mercatorToLngLat(point: Point): Point {
    const x = point[0];
    const y = point[1];

    const y2 = 180 - y * 360;

    return [x * 360 - 180, (360 / Math.PI) * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90];
}

export function coordsToKey(coords: Coords): string {
    return `${coords[0]}_${coords[1]}_${coords[2]}`;
}

export function coordsToBound(coords: Coords): Bound {
    const [zoom, x, y] = coords;
    const tileSize = 1 / 2 ** zoom;
    const paddingSize = (tileSize * padding) / extent;

    const [minX, minY] = mercatorToLngLat([
        x * tileSize - paddingSize,
        (y + 1) * tileSize + paddingSize,
    ]);
    const [maxX, maxY] = mercatorToLngLat([
        (x + 1) * tileSize + paddingSize,
        y * tileSize - paddingSize,
    ]);

    return { minX, minY, maxX, maxY };
}

export function fnv32b(str: string): string {
    const FNV1_32A_INIT = 0x811c9dc5;

    let hash = str
        .split('')
        .map(x => x.charCodeAt(0))
        .reduce((sum, val) => {
            sum ^= val;

            return sum + (sum << 1) + (sum << 4) + (sum << 7) + (sum << 8) + (sum << 24);
        }, FNV1_32A_INIT);

    // Avalanche
    hash ^= hash << 3;
    hash += hash >> 5;
    hash ^= hash << 4;
    hash += hash >> 17;
    hash ^= hash << 25;
    hash += hash >> 6;

    return `0000000${(hash >>> 0).toString(16)}`.substr(-8);
}

export function formatPercent(count: number, total: number): string {
    const value = (count / total) * 100;
    const string = value.toFixed(1);

    return value < 10 ? ` ${string}` : string;
}

export function getTileList(bound: Bound, minZoom: number, maxZoom?: number): Coords[] {
    if (maxZoom === undefined) {
        maxZoom = minZoom;
    }

    const [minX, minY] = lngLatToMercator([bound.minX, bound.maxY]);
    const [maxX, maxY] = lngLatToMercator([bound.maxX, bound.minY]);

    const tileList: Coords[] = [];

    for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
        const tileSize = 1 / 2 ** zoom;
        const minXCoord = Math.floor(minX / tileSize);
        const minYCoord = Math.floor(minY / tileSize);
        const maxXCoord = Math.floor(maxX / tileSize);
        const maxYCoord = Math.floor(maxY / tileSize);

        for (let x = minXCoord; x <= maxXCoord; x++) {
            for (let y = minYCoord; y <= maxYCoord; y++) {
                tileList.push([zoom, x, y]);
            }
        }
    }

    return tileList;
}

export function getChildren(coords: Coords): Coords[] {
    const zoom = coords[0] + 1;
    const baseX = coords[1] * 2;
    const baseY = coords[2] * 2;

    const result: Coords[] = [];

    for (let y = baseY - 1; y <= baseY + 2; y++) {
        for (let x = baseX - 1; x <= baseX + 2; x++) {
            result.push([zoom, x, y]);
        }
    }

    return result;
}

export function getElapsed(startTime: number): number {
    return toSeconds(Date.now() - startTime);
}

export function toSeconds(ms: number): number {
    return Math.round(ms / 1000);
}

export function rightPad(string: string, length: number): string {
    return string + ' '.repeat(Math.max(0, length - string.length));
}
