import { Settings, SomeObject, Telemetry, Tileset } from './types';
import { fnv32b, getTileList } from './utils';
import { indexify } from './indexify';
import { Workers } from './workers';
import * as path from 'path';
import * as fs from 'fs';
import {
    simplificationTolerance,
    convolutionRadius,
    rasterSize,
    turdSize,
    minZoom,
    maxZoom,
} from './constants';

const inputPath = path.join(__dirname, '..', '..', '..', 'woods.geojson');
const distPath = path.join(__dirname, '..', 'dist');
const tmpPath = path.join(__dirname, '..', 'tmp');
const generalizationFarm = new Workers(require.resolve('./generalize'));

run();

async function run(): Promise<void> {
    const settings: Settings = {
        minZoom,
        maxZoom,
        turdSize,
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

    console.log('Step 1: indexing input data...');

    const metadata = await indexify(inputPath);

    const bound = metadata.globalBound;

    process.exit();

    console.log(`\nStep 2: rendering tiles for zooms ${maxZoom} to ${minZoom}...`);

    for (let zoom = maxZoom; zoom >= minZoom; zoom--) {
        const tileList = getTileList(bound, zoom);
        const args = tileList.map(coords => ({ coords, id }));

        console.log(`Rendering zoom level ${zoom}...`);

        await generalizationFarm.run(args, (stats: SomeObject) => {
            const { arg } = stats;

            const coords = `${arg.coords[0]}, ${arg.coords[1]}, ${arg.coords[2]}`;

            const message = `* Tile [${coords}] ready.`;
            const padding = ' '.repeat(Math.max(0, 100 - message.length));

            process.stdout.write(`\r${message}${padding}`);
        });
    }

    generalizationFarm.end();

    console.log('\nTile generation successful.');

    const telemetry: Telemetry = {
        tileCount: 1,
        time: 1,
    };

    const tilesetsPath = path.join(distPath, 'tilesets.json');

    const tilesets: Tileset[] = fs.existsSync(tilesetsPath)
        ? JSON.parse(fs.readFileSync(tilesetsPath, 'utf8'))
        : [];

    const newTilesets = tilesets.filter(tileset => tileset.id !== id);

    newTilesets.push({ id, settings, telemetry });

    fs.writeFileSync(tilesetsPath, JSON.stringify(newTilesets, null, 4));
}
