import { Coords, Point, Ring } from './types';
import { mercatorToLngLat } from './utils';
import { Feature, MultiPolygon, Polygon } from 'geojson';
import { rasterSize } from './constants';
import * as turf from '@turf/turf';

export function createGeoJson(input: Ring[], coords: Coords): Feature<MultiPolygon> {
    input = input.filter(ring => ring.length > 3);

    const rings = input.map(ring => new RingDescriptor(ring));

    for (const ring of rings) {
        ring.findParent(rings);
    }

    for (const ring of rings) {
        if (ring.getDepth() % 2 === 0) {
            ring.parent = undefined;
        }
    }

    for (const ring of rings) {
        if (ring.parent !== undefined) {
            ring.parent.children.push(ring);
        }
    }

    const coordinates: Point[][][] = [];

    for (const ring of rings) {
        if (ring.parent !== undefined) {
            continue;
        }

        const ringSet: Ring[] = [];

        ringSet.push(ring.ring.map(point => unproject(point, coords)));

        for (const child of ring.children) {
            ringSet.push(child.ring.map(point => unproject(point, coords)).reverse());
        }

        coordinates.push(ringSet);
    }

    return {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'MultiPolygon',
            coordinates,
        },
    };
}

function unproject(point: Point, coords: Coords): Point {
    const [zoom, x, y] = coords;
    const tileSize = 1 / 2 ** zoom;

    return mercatorToLngLat([
        (x + point[0] / rasterSize) * tileSize,
        (y + point[1] / rasterSize) * tileSize,
    ]);
}

class RingDescriptor {
    public ring: Ring;
    public geometry: Feature<Polygon>;
    public parent: RingDescriptor | undefined;

    public children: RingDescriptor[];

    constructor(ring: Ring) {
        this.ring = ring;
        this.geometry = turf.polygon([ring]);
        this.children = [];
    }

    public findParent(candidates: RingDescriptor[]): void {
        candidates = candidates.filter(candidate => {
            return candidate !== this && turf.booleanWithin(this.geometry, candidate.geometry);
        });

        let bestCandidate: RingDescriptor | undefined;
        let bestArea = Infinity;

        for (const candidate of candidates) {
            const area = turf.area(candidate.geometry);

            if (area < bestArea) {
                bestArea = area;
                bestCandidate = candidate;
            }
        }

        this.parent = bestCandidate;
    }

    public getDepth(): number {
        let depth = 0;
        let node: RingDescriptor | undefined = this;

        while (node.parent !== undefined) {
            node = node.parent;
            depth++;
        }

        return depth;
    }

    public findChildren(candidates: RingDescriptor[]): void {
        this.children = candidates.filter(candidate => candidate.parent === this);
    }
}
