import { coordsToBound, coordsToKey, lngLatToMercator } from './utils';
import { MultiPolygon, Polygon } from 'geojson';
import { createGeoJson } from './geojson';
import { simplifyRing } from './simplify';
import { convolute } from './convolution';
import { fromGeojsonVt } from 'vt-pbf';
import { createCanvas } from 'canvas';
import { parsePath } from './path';
import geojsonvt from 'geojson-vt';
import { Coords, DbRow } from './types';
import { trace } from './trace';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import {
    simplificationTolerance,
    convolutionRadius,
    rasterSize,
    padding,
    extent,
} from './constants';

const dbPromise = open({
    filename: path.join(__dirname, '..', '..', '..', 'woods.db'),
    driver: sqlite3.Database,
});

module.exports = async function generalizeTile(
    coords: Coords,
    outputPath: string,
    callback: () => void,
): Promise<void> {
    const zoom = coords[0];
    const x = coords[1];
    const y = coords[2];

    const tileKey = coordsToKey(coords);
    const tileSize = 1 / 2 ** zoom;

    const canvasPadding = (padding * rasterSize) / extent;
    const canvasSize = rasterSize + 2 * canvasPadding;

    const canvas = createCanvas(canvasSize, canvasSize);
    const ctx = canvas.getContext('2d');

    ctx.antialias = 'none';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    const db = await dbPromise;

    const bound = coordsToBound(coords);

    const times: number[] = [];

    times.push(Date.now());

    const rows: DbRow[] = await db.all(`
        SELECT
            geometry FROM woods
        WHERE
            minLng < ${bound.maxX} AND
            maxLng > ${bound.minX} AND
            minLat < ${bound.maxY} AND
            maxLat > ${bound.minY};
    `);

    times.push(Date.now());

    if (rows.length === 0) {
        callback(times);
        return;
    }

    for (let i = 0; i < rows.length; i++) {
        const geometry: Polygon | MultiPolygon = JSON.parse(rows[i].geometry);

        const ringSets =
            geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];

        ctx.fillStyle = '#ffffff';

        for (const ringSet of ringSets) {
            ctx.beginPath();

            for (const ring of ringSet) {
                for (let j = 0; j < ring.length; j++) {
                    const mercatorPoint = lngLatToMercator(ring[j]);

                    const canvasX = ((mercatorPoint[0] - x * tileSize) / tileSize) * canvasSize;
                    const canvasY = ((mercatorPoint[1] - y * tileSize) / tileSize) * canvasSize;

                    if (j === 0) {
                        ctx.moveTo(canvasX, canvasY);
                    } else {
                        ctx.lineTo(canvasX, canvasY);
                    }
                }

                ctx.closePath();
            }

            ctx.fill();
        }
    }

    times.push(Date.now());

    const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
    convolute(imageData, convolutionRadius);
    ctx.putImageData(imageData, 0, 0);

    times.push(Date.now());

    const traced = await trace(imageData);
    times.push(Date.now());
    const rings = parsePath(traced);

    const simplifiedRings = rings.map(ring => simplifyRing(ring, simplificationTolerance));

    const geojson = createGeoJson(simplifiedRings, coords);

    const tileIndex = geojsonvt(geojson, {
        maxZoom: zoom,
        tolerance: 0,
    });

    const tile = tileIndex.getTile(zoom, x, y);
    const buffer = fromGeojsonVt({ polygons: tile });

    times.push(Date.now());

    fs.writeFile(path.join(outputPath, `${tileKey}.pbf`), buffer, () => {
        callback(times);
    });
};
