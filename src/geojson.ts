import { Feature, Polygon, Position } from 'geojson';
import parse from 'parse-svg-path';

export function createGeoJson(path: string): Feature<Polygon> {
    const parsed = parse(path);

    const rings: Position[][] = [];
    let ring: Position[] = [];

    for (const controlPoint of parsed) {
        const command = controlPoint[0];
        const x = controlPoint[1];
        const y = controlPoint[2];

        if (command === 'M') {
            if (ring.length > 0) {
                rings.push(ring);
            }

            ring = [];
        }

        ring.push([x, y]);
    }

    return {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Polygon',
            coordinates: rings,
        },
    };
}
