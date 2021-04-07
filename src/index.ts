import {
    formatPercent,
    getTileList,
    coordsToKey,
    formatTime,
    getElapsed,
    rightPad,
    fnv32b,
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
    const startTime = Date.now();

    await indexify(inputPath);

    console.log(`\n⣿ Done in ${formatTime(getElapsed(startTime))}.`);

    const bound = JSON.parse(fs.readFileSync(path.join(dataPath, 'bound.json'), 'utf8'));
    const farm = new Workers(require.resolve('./generalize'));

    console.log(`\nStep 2 of 3: rendering tiles for zoom levels ${maxZoom} to ${minZoom}...`);

    for (let zoom = maxZoom; zoom >= minZoom; zoom--) {
        const tileList = getTileList(bound, zoom);

        console.log(`* Starting zoom level ${zoom}:`);
        const startTime = Date.now();

        await farm.run(tileList, count => {
            printProgressMessage('Rendered', startTime, count, tileList.length, 2);
        });

        printCompletionMessage(startTime, tileList.length, 2);
    }

    farm.end();

    console.log(`\nStep 3 of 3: Generating MBtiles file...`);
    const mbTilesStartTime = Date.now();

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

        printProgressMessage('Wrote', mbTilesStartTime, count, total, 0);
    }

    await tileWriter.stopWriting();

    printCompletionMessage(mbTilesStartTime, tileList.length, 0);

    const tilesetsPath = path.join(distPath, 'tilesets.json');

    const tilesets: Tileset[] = fs.existsSync(tilesetsPath)
        ? JSON.parse(fs.readFileSync(tilesetsPath, 'utf8'))
        : [];

    const newTilesets = tilesets.filter(tileset => tileset.id !== id);

    newTilesets.push({ id, settings });

    fs.writeFileSync(tilesetsPath, JSON.stringify(newTilesets, null, 4));

    console.log(`\nDone in ${formatTime(getElapsed(startTime))}.`);
}

function printProgressMessage(
    word: string,
    startTime: number,
    count: number,
    total: number,
    indent: number,
): void {
    const elapsedTime = Date.now() - startTime;
    const totalTime = (elapsedTime / count) * total;
    const remainingTime = totalTime - elapsedTime;

    const spinner =
        count < total
            ? String.fromCharCode(0x2801 + Math.floor(Math.random() * 254))
            : String.fromCharCode(0x28ff);

    const percent = formatPercent(count, total);
    const eta = formatTime(remainingTime);

    const spacing = ' '.repeat(indent);

    const message = `${spacing}${spinner} [${percent}%] ${word} ${count} of ${total}. ETA: ~${eta}.`;

    process.stdout.write(`\r${rightPad(message, process.stdout.columns)}`);
}

function printCompletionMessage(startTime: number, total: number, indent: number): void {
    const timePerTile = Math.round((Date.now() - startTime) / total);
    const spacing = ' '.repeat(indent);

    console.log(
        `\n${spacing}⣿ Done in ${formatTime(getElapsed(startTime))} (~${timePerTile}ms per tile).`,
    );
}
