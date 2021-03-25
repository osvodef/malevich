import { fnv32b, formatPercent, lngLatToMercator } from './utils';
import { Coords, Settings, Telemetry, Tileset } from './types';
import farm from 'worker-farm';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
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

const distPath = path.join(__dirname, '..', 'dist');
const workers = farm(require.resolve('./generalize'));

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

    const db = await open({
        filename: path.join(__dirname, '..', '..', '..', 'woods.db'),
        driver: sqlite3.Database,
    });

    const minLng: number = (await db.get('SELECT MIN(minLng) AS value FROM woods')).value;
    const minLat: number = (await db.get('SELECT MIN(minLat) AS value FROM woods')).value;
    const maxLng: number = (await db.get('SELECT MAX(maxLng) AS value FROM woods')).value;
    const maxLat: number = (await db.get('SELECT MAX(maxLat) AS value FROM woods')).value;

    await db.close();

    const [minX, minY] = lngLatToMercator([minLng, maxLat]);
    const [maxX, maxY] = lngLatToMercator([maxLng, minLat]);

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
        workers(coords, outputPath, times => {
            farm.end(workers);

            tileCount++;

            const progress = formatPercent((tileCount / tileList.length) * 100);

            let timeString = `db=${times[1] - times[0]}; `;

            if (times.length > 2) {
                timeString += `r=${times[2] - times[1]}; conv=${times[3] -
                    times[2]}; tr=${times[4] - times[3]}; fin=${times[5] - times[4]}`;
            }

            console.log(
                `* [${progress}%] Tile [${coords[0]}, ${coords[1]}, ${coords[2]}] ready. ${timeString}`,
            );

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
