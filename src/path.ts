import parse from 'parse-svg-path';
import { Ring } from './types';

export function parsePath(path: string): Ring[] {
    const parsed = parse(path);

    const rings: Ring[] = [];
    let ring: Ring = [];

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

    return rings;
}
