import { coordsToInteger, coordsToKey, lngLatToMercator } from './utils';
import { MultiPolygon, Polygon } from 'geojson';
import { createGeoJson } from './geojson';
import { simplifyRing } from './simplify';
import { convolute } from './convolution';
import { Coords, DbRow, SomeObject } from './types';
import { fromGeojsonVt } from 'vt-pbf';
import { createCanvas, CanvasRenderingContext2D, createImageData } from 'canvas';
import { parsePath } from './path';
import geojsonvt from 'geojson-vt';
import { trace } from './trace';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import { promises as fs } from 'fs';
import {
    simplificationTolerance,
    convolutionRadius,
    rasterSize,
    padding,
    extent,
    maxZoom,
} from './constants';
import { deflate, fromRgba, inflate, squash, toRgba } from './raster';

const tmpPath = path.join(__dirname, '..', 'tmp');
const distPath = path.join(__dirname, '..', 'dist');

const dbPromise = open({
    filename: path.join(tmpPath, 'woods.db'),
    driver: sqlite3.Database,
});

module.exports = async function generalizeTile(
    args: SomeObject,
    callback: () => void,
): Promise<void> {
    const { id, coords } = args;

    const zoom = coords[0];
    const x = coords[1];
    const y = coords[2];

    const tileKey = coordsToKey(coords);

    const canvasPadding = (padding * rasterSize) / extent;
    const canvasSize = rasterSize + 2 * canvasPadding;

    const canvas = createCanvas(canvasSize, canvasSize);
    const ctx = canvas.getContext('2d');

    if (zoom === maxZoom) {
        await drawInitial(ctx, coords);
    } else {
        await drawDownscaled(ctx, coords);
    }

    const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);

    await fs.writeFile(
        path.join(tmpPath, 'rasters', `${tileKey}.bin`),
        await deflate(fromRgba(imageData.data)),
    );

    convolute(imageData, convolutionRadius);
    ctx.putImageData(imageData, 0, 0);

    const traced = await trace(imageData);
    const rings = parsePath(traced);

    const simplifiedRings = rings.map(ring => simplifyRing(ring, simplificationTolerance));

    const geojson = createGeoJson(simplifiedRings, coords);

    const tileIndex = geojsonvt(geojson, {
        maxZoom: zoom,
        tolerance: 0,
    });

    const tile = tileIndex.getTile(zoom, x, y);
    const buffer = fromGeojsonVt({ polygons: tile });

    await fs.writeFile(path.join(distPath, id, `${tileKey}.pbf`), buffer);

    callback();
};

async function drawInitial(ctx: CanvasRenderingContext2D, coords: Coords): Promise<void> {
    const zoom = coords[0];
    const x = coords[1];
    const y = coords[2];
    const integer = coordsToInteger(coords);

    const tileSize = 1 / 2 ** zoom;

    ctx.antialias = 'none';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, rasterSize, rasterSize);

    const db = await dbPromise;

    const rows: DbRow[] = await db.all(`
        SELECT geometry FROM woods INNER JOIN woods2tiles ON woods.id = woods2tiles.woodId WHERE woods2tiles.tileId = ${integer};
    `);

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

                    const canvasX = ((mercatorPoint[0] - x * tileSize) / tileSize) * rasterSize;
                    const canvasY = ((mercatorPoint[1] - y * tileSize) / tileSize) * rasterSize;

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
}

async function drawDownscaled(ctx: CanvasRenderingContext2D, coords: Coords): Promise<void> {
    const [zoom, x, y] = coords;

    const leftTop = await loadRaster([zoom + 1, x * 2, y * 2]);
    const rightTop = await loadRaster([zoom + 1, x * 2 + 1, y * 2]);
    const leftBottom = await loadRaster([zoom + 1, x * 2, y * 2 + 1]);
    const rightBottom = await loadRaster([zoom + 1, x * 2 + 1, y * 2 + 1]);

    if (
        leftTop === undefined &&
        rightTop === undefined &&
        leftBottom === undefined &&
        rightBottom === undefined
    ) {
        return;
    }

    const pixels = squash(leftTop, rightTop, leftBottom, rightBottom);

    await fs.writeFile(
        path.join(tmpPath, 'rasters', `${coordsToKey(coords)}.bin`),
        await deflate(pixels),
    );

    ctx.putImageData(createImageData(toRgba(pixels), rasterSize, rasterSize), 0, 0);
}

async function loadRaster(coords: Coords): Promise<Uint8ClampedArray | undefined> {
    try {
        const buffer = await fs.readFile(
            path.join(tmpPath, 'rasters', `${coordsToKey(coords)}.bin`),
        );

        const array = new Uint8ClampedArray(await inflate(buffer));

        return array;
    } catch (e) {
        return undefined;
    }
}
