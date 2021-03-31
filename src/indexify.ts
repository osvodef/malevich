import { createWriteStream, existsSync } from 'fs';
import { MultiPolygon, Polygon } from 'geojson';
import { createInterface } from 'readline';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import { rightPad } from './utils';
import Flatbush from 'flatbush';
import { Bound } from './bound';
import * as path from 'path';

const tmpPath = path.join(__dirname, '..', 'tmp');

export async function indexify(inputPath: string): Promise<void> {
    const indexExists =
        existsSync(path.join(tmpPath, 'geometries.bin')) &&
        existsSync(path.join(tmpPath, 'pointers.bin')) &&
        existsSync(path.join(tmpPath, 'tree.bin')) &&
        existsSync(path.join(tmpPath, 'bound.json'));

    if (indexExists) {
        process.stdout.write('⣿ Using existing index from ./tmp');

        return;
    }

    const dataFile = createWriteStream(path.join(tmpPath, 'geometries.bin'));

    const globalBound = new Bound();

    const bounds: Bound[] = [];
    const pointers: number[] = [];

    let index = 0;
    let position = 0;
    let total = 0;

    const liner = createInterface({
        input: createReadStream(inputPath),
        crlfDelay: Infinity,
    });

    await new Promise<void>(resolve => {
        liner.on('line', async (line: string) => {
            total++;

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

            const buffer = Buffer.from(line);

            dataFile.write(buffer);

            bounds.push(bound);
            pointers.push(position, buffer.byteLength);

            if (index % 1000 === 0 && index > 0) {
                printProgress(index, false);
            }

            index++;
            position += buffer.byteLength;
        });

        liner.on('close', () => {
            dataFile.end();
        });

        dataFile.on('finish', () => {
            resolve();
        });
    });

    printProgress(total, true);

    await dataFile.close();

    const tree = new Flatbush(total);

    for (const bound of bounds) {
        tree.add(bound.minX, bound.minY, bound.maxX, bound.maxY);
    }

    tree.finish();

    const pointersArray = new Float64Array(pointers);

    await fs.writeFile(path.join(tmpPath, 'pointers.bin'), Buffer.from(pointersArray.buffer));
    await fs.writeFile(path.join(tmpPath, 'tree.bin'), Buffer.from(tree.data));
    await fs.writeFile(path.join(tmpPath, 'bound.json'), JSON.stringify(globalBound));
}

function printProgress(index: number, finished: boolean): void {
    const spinner = !finished
        ? String.fromCharCode(0x2801 + Math.floor(Math.random() * 254))
        : String.fromCharCode(0x28ff);

    const message = `${spinner} Indexed ${index} geometries.`;

    process.stdout.write(`\r${rightPad(message, process.stdout.columns)}`);
}
