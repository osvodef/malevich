import { coordsToInteger, getTileList } from './utils';
import { MultiPolygon, Polygon } from 'geojson';
import { maxZoom, minZoom } from './constants';
import lineReader from 'line-reader';
import { Bound } from './bound';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';

run();

async function run(): Promise<void> {
    const dbPath = path.join(__dirname, '..', 'tmp', 'woods.db');

    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
    });

    await db.exec(`
        PRAGMA synchronous = OFF;
        PRAGMA journal_mode = OFF;
        PRAGMA locking_mode = EXCLUSIVE;

        CREATE TABLE woods (
            id INTEGER NOT NULL PRIMARY KEY, 
            minLng REAL NOT NULL,
            minLat REAL NOT NULL,
            maxLng REAL NOT NULL,
            maxLat REAL NOT NULL,
            geometry TEXT NOT NULL
        );

        CREATE TABLE woods2tiles (
            woodId INTEGER NOT NULL,            
            tileId INTEGER NOT NULL 
        );

        CREATE TABLE metadata (
            minLng REAL NOT NULL,
            minLat REAL NOT NULL,
            maxLng REAL NOT NULL,
            maxLat REAL NOT NULL
        );

        CREATE INDEX idxWoodId ON woods2tiles(woodId);
        CREATE INDEX idxTileId ON woods2tiles(tileId);
    `);

    const inputPath = path.join(__dirname, '..', '..', '..', 'woods.geojson');

    await db.exec('BEGIN TRANSACTION');

    let index = 0;
    const globalBound = new Bound();

    lineReader.eachLine(inputPath, async (line, last, callback) => {
        callback = callback as Function;

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

        await db.exec(`
            INSERT INTO woods (id, geometry, minLng, minLat, maxLng, maxLat)
            VALUES(${index}, '${line}', ${bound.minX}, ${bound.minY}, ${bound.maxX}, ${bound.maxY})
        `);

        for (const coords of getTileList(bound, minZoom, maxZoom)) {
            const integer = coordsToInteger(coords);

            await db.exec(`INSERT INTO woods2tiles (woodId, tileId) VALUES(${index}, ${integer})`);
        }

        index++;

        if (index % 100 === 0) {
            const spinner = String.fromCharCode(0x2800 + Math.floor(Math.random() * 256));

            process.stdout.write(`\r${spinner} Processed ${index} geometries.`);
        }

        if (last) {
            await db.exec(`
                INSERT INTO metadata (minLng, minLat, maxLng, maxLat)
                VALUES (${globalBound.minX}, ${globalBound.minY}, ${globalBound.maxX}, ${globalBound.maxY})
            `);
            await db.exec('COMMIT');
            await db.close();

            process.stdout.write('\n');

            callback(false);
        } else {
            callback();
        }
    });
}
