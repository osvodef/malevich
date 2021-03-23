import { fnv32b, formatPercent } from './utils';
import { Coords, Settings, Telemetry, Tileset } from './types';
import { generalizeTile } from './generalize';
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

    const tileList: Coords[] = [];

    for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
        const tileCount = 2 ** zoom;

        for (let x = 0; x < tileCount; x++) {
            for (let y = 0; y < tileCount; y++) {
                tileList.push([zoom, x, y]);
            }
        }
    }

    const startTime = Date.now();
    let tileCount = 0;

    for (const coords of tileList) {
        generalizeTile(coords, outputPath, () => {
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
