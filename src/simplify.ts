import { Position } from 'geojson';
import simplify from 'simplify-js';

export function simplifyRing(ring: Position[], tolerance: number): Position[] {
    const ringXY = ring.map(point => {
        return { x: point[0], y: point[1] };
    });

    return simplify(ringXY, tolerance, true).map(point => {
        return [point.x, point.y];
    });
}
