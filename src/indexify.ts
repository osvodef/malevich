import { MultiPolygon, Polygon } from 'geojson';
import { GeometriesMetadata } from './types';
import { createInterface } from 'readline';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import { Bound } from './bound';
import { once } from 'events';
import * as path from 'path';

type Pointer = [number, number];

const tmpPath = path.join(__dirname, '..', 'tmp');

export async function indexify(inputPath: string): Promise<GeometriesMetadata> {
    const dataFile = await fs.open(path.join(tmpPath, 'geometries.bin'), 'w');

    const globalBound = new Bound();

    const bounds: Bound[] = [];
    const pointers: Pointer[] = [];

    let index = 0;
    let position = 0;

    const liner = createInterface({
        input: createReadStream(inputPath),
        crlfDelay: Infinity,
    });

    liner.on('line', async (line: string) => {
        const geometry: Polygon | MultiPolygon = JSON.parse(line);
        const ringSets =
            geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];

        const bound = new Bound();

        for (const ringSet of ringSets) {
            for (const ring of ringSet) {
                for (const point of ring) {
                    bound.extend(point);
                    globalBound.extend(point);
                }
            }
        }

        const { bytesWritten } = await dataFile.write(Buffer.from(line));

        bounds.push(bound);
        pointers.push([position, bytesWritten]);

        index++;
        position += bytesWritten;

        if (index % 100 === 0) {
            const spinner = String.fromCharCode(0x2800 + Math.floor(Math.random() * 256));

            process.stdout.write(`\r${spinner} Processed ${index} geometries.`);
        }
    });

    await once(liner, 'close');
    await dataFile.close();

    return {
        globalBound,
        bounds,
        pointers,
    };
}
