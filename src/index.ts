import { fnv32b, formatPercent, getElapsed, getTileList, rightPad, toSeconds } from './utils';
import { Settings, Tileset } from './types';
import { indexify } from './indexify';
import { Workers } from './workers';
import * as path from 'path';
import * as fs from 'fs';
import {
    simplificationTolerance,
    convolutionRadius,
    rasterSize,
    threshold,
    turdSize,
    minZoom,
    maxZoom,
} from './constants';

const inputPath = path.join(__dirname, '..', '..', '..', 'woods100000.geojson');
const distPath = path.join(__dirname, '..', 'dist');
const tmpPath = path.join(__dirname, '..', 'tmp');

run();

async function run(): Promise<void> {
    const settings: Settings = {
        minZoom,
        maxZoom,
        turdSize,
        threshold,
        rasterSize,
        convolutionRadius,
        simplificationTolerance,
    };

    const id = fnv32b(JSON.stringify(settings));
    const outputPath = path.join(distPath, id);

    if (fs.existsSync(outputPath)) {
        fs.rmdirSync(outputPath, { recursive: true });
    }
    fs.mkdirSync(outputPath);

    console.log('Step 1 of 2: indexing input data...');
    const startTime = Date.now();

    await indexify(inputPath);

    console.log(`\n⣿ Done in ${getElapsed(startTime)}s.`);

    const bound = JSON.parse(fs.readFileSync(path.join(tmpPath, 'bound.json'), 'utf8'));
    const farm = new Workers(require.resolve('./generalize'));

    console.log(`\nStep 2 of 2: rendering tiles for zoom levels ${maxZoom} to ${minZoom}...`);

    for (let zoom = maxZoom; zoom >= minZoom; zoom--) {
        const tileList = getTileList(bound, zoom);
        const total = tileList.length;
        const args = tileList.map(coords => ({ coords, id }));

        console.log(`* Starting zoom level ${zoom}:`);
        const startTime = Date.now();

        await farm.run(args, count => {
            const elapsedTime = Date.now() - startTime;
            const totalTime = (elapsedTime / count) * total;
            const remainingTime = totalTime - elapsedTime;

            const spinner =
                count < total
                    ? String.fromCharCode(0x2801 + Math.floor(Math.random() * 254))
                    : String.fromCharCode(0x28ff);

            const percent = formatPercent(count, total);
            const eta = toSeconds(remainingTime);

            const message = `${spinner} [${percent}%] Rendered ${count} of ${total}. ETA: ~${eta}s.`;

            process.stdout.write(`\r${rightPad(message, process.stdout.columns)}`);
        });

        const timePerTile = Math.round((Date.now() - startTime) / total);
        console.log(`\n⣿ Done in ${getElapsed(startTime)}s (~${timePerTile}ms per tile).`);
    }

    farm.end();

    const tilesetsPath = path.join(distPath, 'tilesets.json');

    const tilesets: Tileset[] = fs.existsSync(tilesetsPath)
        ? JSON.parse(fs.readFileSync(tilesetsPath, 'utf8'))
        : [];

    const newTilesets = tilesets.filter(tileset => tileset.id !== id);

    newTilesets.push({ id, settings });

    fs.writeFileSync(tilesetsPath, JSON.stringify(newTilesets, null, 4));

    console.log('\nDone.');
}
