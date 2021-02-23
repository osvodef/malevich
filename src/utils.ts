import { Feature, Polygon } from 'geojson';
import { Bound, Point } from './types';

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

export function getBound(polygons: Array<Feature<Polygon>>): Bound {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const polygon of polygons) {
        const rings = polygon.geometry.coordinates;

        for (const ring of rings) {
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
