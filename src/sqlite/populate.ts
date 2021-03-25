import { MultiPolygon, Polygon } from 'geojson';
import { formatPercent } from '../utils';
import lineReader from 'line-reader';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';

run();

async function run(): Promise<void> {
    const dbPath = path.join(__dirname, '..', '..', 'dist', 'woods.db');

    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
    });

    await db.exec(`
        PRAGMA synchronous = OFF;
        PRAGMA journal_mode = OFF;
        PRAGMA locking_mode = EXCLUSIVE;

        CREATE TABLE woods (
            geometry TEXT NOT NULL,
            minLng REAL NOT NULL,
            maxLng REAL NOT NULL,
            minLat REAL NOT NULL,
            maxLat REAL NOT NULL
        );

        CREATE INDEX idxBbox ON woods(minLat, maxLat, minLng, maxLng);
    `);

    const inputPath = path.join(__dirname, '..', '..', '..', '..', 'woods.geojson');

    let count = 0;
    const total = 5340958;
    const startTime = Date.now();
    const spinners = '◰◳◲◱';

    await db.exec('BEGIN TRANSACTION');

    lineReader.eachLine(inputPath, (line, last, callback) => {
        const geometry: Polygon | MultiPolygon = JSON.parse(line);
        const ringSets =
            geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const ringSet of ringSets) {
            for (const ring of ringSet) {
                for (let i = 0; i < ring.length; i++) {
                    const x = ring[i][0];
                    const y = ring[i][1];

                    if (x < minX) {
                        minX = x;
                    }

                    if (x > maxX) {
                        maxX = x;
                    }

                    if (y < minY) {
                        minY = y;
                    }

                    if (y > maxY) {
                        maxY = y;
                    }
                }
            }
        }

        const query = `
            INSERT INTO woods (geometry, minLng, maxLng, minLat, maxLat)
            VALUES('${line}', ${minX}, ${maxX}, ${minY}, ${maxY});
        `;

        db.exec(query).then(() => {
            count++;

            if (count % 10 === 0) {
                const progress = formatPercent((count / total) * 100);
                const elapsedTime = Date.now() - startTime;
                const totalTime = (elapsedTime / count) * total;
                const remainingTime = Math.round((totalTime - elapsedTime) / 1000);

                if (count > 1) {
                    process.stdout.write('\r');
                }

                const spinner = spinners[(count / 10) % spinners.length];

                process.stdout.write(
                    `${spinner} [${progress}%] Processed ${count} geometries. Estimated time left: ${remainingTime}s`,
                );
            }

            if (last) {
                process.stdout.write('\n');

                db.exec('COMMIT').then(() => {
                    (callback as Function)(false);
                });
            } else {
                (callback as Function)();
            }
        });
    });
}
