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

export function monochromize(color: number): number {
    return color > 127 ? 255 : 0;
}
