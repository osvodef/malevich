import { Feature, MultiPolygon, Polygon } from 'geojson';
import { Bound, Coords, Point } from './types';

export function mercatorToTileCount(mercator: number, zoom: number) {
    return mercator * 2 ** zoom;
}

export function projectPoint(
    point: Point,
    bound: Bound,
    canvasWidth: number,
    canvasHeight: number,
): Point {
    const width = bound.maxX - bound.minX;
    const height = bound.maxY - bound.minY;

    return [
        ((point[0] - bound.minX) / width) * canvasWidth,
        ((point[1] - bound.minY) / height) * canvasHeight,
    ];
}

export function unprojectPoint(
    point: Point,
    bound: Bound,
    canvasWidth: number,
    canvasHeight: number,
): Point {
    const width = bound.maxX - bound.minX;
    const height = bound.maxY - bound.minY;

    return [
        (point[0] / canvasWidth) * width + bound.minX,
        (point[1] / canvasHeight) * height + bound.minY,
    ];
}

export function getBound(polygons: Array<Feature<Polygon | MultiPolygon>>): Bound {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const polygon of polygons) {
        const { geometry } = polygon;

        const ringSets =
            geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

        for (const ringSet of ringSets) {
            for (const ring of ringSet) {
                for (const point of ring) {
                    if (point[0] < minX) {
                        minX = point[0];
                    }

                    if (point[0] > maxX) {
                        maxX = point[0];
                    }

                    if (point[1] < minY) {
                        minY = point[1];
                    }

                    if (point[1] > maxY) {
                        maxY = point[1];
                    }
                }
            }
        }
    }

    return { minX, maxX, minY, maxY };
}

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

export function createSvg(path: string, width: number, height: number): string {
    return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" version="1.1">
            <rect width="${width}" height="${height}" fill="black" />
            <path d="${path}" stroke="none" fill="white" fill-rule="evenodd" />
        </svg>
    `;
}

export function toPrecision(point: Point, precision: number): Point {
    const factor = 10 ** precision;

    return [Math.round(point[0] * factor) / factor, Math.round(point[1] * factor) / factor];
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

export function leftPad(string: string, length: number): string {
    if (string.length >= length) {
        return string;
    }

    return '0'.repeat(length - string.length) + string;
}

export function formatPercent(value: number): string {
    value = Math.round(value * 10) / 10;

    const string = value.toFixed(1);

    return value < 10 ? ` ${string}` : string;
}
