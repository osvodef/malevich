import { Bound, Coords, Point } from './types';

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

    const [minX, minY] = mercatorToLngLat([x * tileSize, (y + 1) * tileSize]);
    const [maxX, maxY] = mercatorToLngLat([(x + 1) * tileSize, y * tileSize]);

    return { minX, minY, maxX, maxY };
}

export function coordsToInteger(coords: Coords): number {
    return coords[0] * 2 ** 32 + coords[1] * 2 ** 16 + coords[2];
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

export function formatPercent(value: number): string {
    value = Math.round(value * 10) / 10;

    const string = value.toFixed(1);

    return value < 10 ? ` ${string}` : string;
}

export function getTileList(bound: Bound, zoom: number): Coords[] {
    const [minX, minY] = lngLatToMercator([bound.minX, bound.maxY]);
    const [maxX, maxY] = lngLatToMercator([bound.maxX, bound.minY]);

    const tileList: Coords[] = [];

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

    return tileList;
}
