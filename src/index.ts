import {
    coordsToKey,
    fnv32b,
    formatPercent,
    getElapsed,
    getTileList,
    rightPad,
    toSeconds,
} from './utils';
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
import { TileWriter } from './mbtiles';

const inputPath = path.join(__dirname, '..', '..', '..', 'woods.geojson');
const distPath = path.join(__dirname, '..', 'dist');
const dataPath = path.join(__dirname, '..', 'data');
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

    console.log('Step 1 of 3: indexing input data...');
    let startTime = Date.now();

    await indexify(inputPath);

    console.log(`\n⣿ Done in ${getElapsed(startTime)}s.`);

    const bound = JSON.parse(fs.readFileSync(path.join(dataPath, 'bound.json'), 'utf8'));
    const farm = new Workers(require.resolve('./generalize'));

    console.log(`\nStep 2 of 3: rendering tiles for zoom levels ${maxZoom} to ${minZoom}...`);

    for (let zoom = maxZoom; zoom >= minZoom; zoom--) {
        const tileList = getTileList(bound, zoom);

        console.log(`* Starting zoom level ${zoom}:`);
        const startTime = Date.now();

        await farm.run(tileList, count => {
            printProgressMessage('Rendered', startTime, count, tileList.length);
        });

        printCompletionMessage(startTime, tileList.length);
    }

    farm.end();

    console.log(`\nStep 3 of 3: Generating MBtiles file...`);
    startTime = Date.now();

    const mbtilesPath = path.join(distPath, `${id}.mbtiles`);

    if (fs.existsSync(mbtilesPath)) {
        fs.unlinkSync(mbtilesPath);
    }

    const tileWriter = new TileWriter(path.join(distPath, `${id}.mbtiles`));
    const tileList = getTileList(bound, minZoom, maxZoom);

    await tileWriter.startWriting();

    for (let i = 0; i < tileList.length; i++) {
        const coords = tileList[i];
        const count = i + 1;
        const total = tileList.length;

        try {
            const buffer = await fs.promises.readFile(
                path.join(tmpPath, `${coordsToKey(coords)}.pbf`),
            );
            await tileWriter.putTile(coords, buffer);
        } catch (e) {}

        printProgressMessage('Wrote', startTime, count, total);
    }

    await tileWriter.stopWriting();

    printCompletionMessage(startTime, tileList.length);

    const tilesetsPath = path.join(distPath, 'tilesets.json');

    const tilesets: Tileset[] = fs.existsSync(tilesetsPath)
        ? JSON.parse(fs.readFileSync(tilesetsPath, 'utf8'))
        : [];

    const newTilesets = tilesets.filter(tileset => tileset.id !== id);

    newTilesets.push({ id, settings });

    fs.writeFileSync(tilesetsPath, JSON.stringify(newTilesets, null, 4));

    console.log('\nDone.');
}

function printProgressMessage(word: string, startTime: number, count: number, total: number): void {
    const elapsedTime = Date.now() - startTime;
    const totalTime = (elapsedTime / count) * total;
    const remainingTime = totalTime - elapsedTime;

    const spinner =
        count < total
            ? String.fromCharCode(0x2801 + Math.floor(Math.random() * 254))
            : String.fromCharCode(0x28ff);

    const percent = formatPercent(count, total);
    const eta = toSeconds(remainingTime);

    const message = `${spinner} [${percent}%] ${word} ${count} of ${total}. ETA: ~${eta}s.`;

    process.stdout.write(`\r${rightPad(message, process.stdout.columns)}`);
}

function printCompletionMessage(startTime: number, total: number): void {
    const timePerTile = Math.round((Date.now() - startTime) / total);
    console.log(`\n⣿ Done in ${getElapsed(startTime)}s (~${timePerTile}ms per tile).`);
}
