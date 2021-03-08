import { fnv32b, formatPercent, lngLatToMercator } from './utils';
import { Coords, Settings, Telemetry, Tileset } from './types';
import farm from 'worker-farm';
import * as path from 'path';
import * as fs from 'fs';
import {
    simplificationTolerance,
    convolutionRadius,
    rasterSize,
    turdSize,
    minZoom,
    maxZoom,
    minLon,
    maxLat,
    maxLon,
    minLat,
} from './constants';

const distPath = path.join(__dirname, '..', 'dist');
const workers = farm(require.resolve('./generalize'));

run();

async function run(): Promise<void> {
    const settings: Settings = {
        minZoom,
        maxZoom,
        bound: {
            minX: minLon,
            maxX: maxLon,
            minY: minLat,
            maxY: maxLat,
        },

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

    const [minX, minY] = lngLatToMercator([minLon, maxLat]);
    const [maxX, maxY] = lngLatToMercator([maxLon, minLat]);

    const tileList: Coords[] = [];

    for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
        const tileSize = 1 / 2 ** zoom;

        const minXCoord = Math.floor(minX / tileSize);
        const minYCoord = Math.floor(minY / tileSize);
        const maxXCoord = Math.floor(maxX / tileSize);
        const maxYCoord = Math.floor(maxY / tileSize);

        for (let x = minXCoord; x <= maxXCoord; x++) {
            for (let y = minYCoord; y <= maxYCoord; y++) {
                tileList.push([zoom, x, y]);
            }
        }
    }

    const startTime = Date.now();
    let tileCount = 0;
    for (const coords of tileList) {
        workers(coords, outputPath, () => {
            tileCount++;

            const progress = formatPercent((tileCount / tileList.length) * 100);

            console.log(`* [${progress}%] Tile [${coords[0]}, ${coords[1]}, ${coords[2]}] ready.`);

            if (tileCount === tileList.length) {
                const elapsedTime = Date.now() - startTime;
                const timePerTile = Math.round(elapsedTime / tileCount);

                console.log(
                    `\nTile generation successful. Tiles generated: ${tileCount}. Total time: ${elapsedTime /
                        1000}s (~${timePerTile}ms per tile).`,
                );

                farm.end(workers);

                const telemetry: Telemetry = {
                    tileCount: tileList.length,
                    time: Date.now() - startTime,
                };

                const tilesetsPath = path.join(distPath, 'tilesets.json');

                const tilesets: Tileset[] = fs.existsSync(tilesetsPath)
                    ? JSON.parse(fs.readFileSync(tilesetsPath, 'utf8'))
                    : [];

                const newTilesets = tilesets.filter(tileset => tileset.id !== id);

                newTilesets.push({ id, settings, telemetry });

                fs.writeFileSync(tilesetsPath, JSON.stringify(newTilesets, null, 4));
            }
        });
    }
}
