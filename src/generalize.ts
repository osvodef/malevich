import { createCanvas, createImageData, CanvasRenderingContext2D } from 'canvas';
import { fromRgba, squash, toRgba } from './rasters';
import { MultiPolygon, Polygon } from 'geojson';
import { createGeoJson } from './geojson';
import { simplifyRing } from './simplify';
import { convolute } from './convolute';
import { fromGeojsonVt } from 'vt-pbf';
import { promises as fs } from 'fs';
import { parsePath } from './path';
import geojsonvt from 'geojson-vt';
import { readFileSync } from 'fs';
import { Coords } from './types';
import { trace } from './trace';
import Flatbush from 'flatbush';
import * as path from 'path';
import {
    simplificationTolerance,
    convolutionRadius,
    canvasPadding,
    rasterSize,
    canvasSize,
    maxZoom,
    savePng,
} from './constants';
import {
    lngLatToMercator,
    coordsToBound,
    coordsToKey,
    getChildren,
    deflate,
    inflate,
} from './utils';

const tmpPath = path.join(__dirname, '..', 'tmp');
const dataPath = path.join(__dirname, '..', 'data');
const distPath = path.join(__dirname, '..', 'dist');

const tree = Flatbush.from(readFileSync(path.join(dataPath, 'tree.bin')).buffer);
const pointers = new Float64Array(readFileSync(path.join(dataPath, 'pointers.bin')).buffer);
const dataPromise = fs.open(path.join(dataPath, 'geometries.bin'), 'r');

interface Pointer {
    offset: number;
    length: number;
}

module.exports = async function generalizeTile(
    args: { coords: Coords; id: string },
    callback: () => void,
): Promise<void> {
    const { coords, id } = args;

    const zoom = coords[0];
    const x = coords[1];
    const y = coords[2];

    const tileKey = coordsToKey(coords);

    const canvas = createCanvas(canvasSize, canvasSize);
    const ctx = canvas.getContext('2d');

    const hasContent =
        zoom === maxZoom ? await drawInitial(ctx, coords) : await drawDownscaled(ctx, coords);

    if (!hasContent) {
        return callback();
    }

    const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);

    await fs.writeFile(
        path.join(tmpPath, `${tileKey}.bin`),
        await deflate(fromRgba(imageData.data)),
    );

    if (savePng) {
        await fs.writeFile(path.join(distPath, id, `${tileKey}.png`), canvas.toBuffer());
        return callback();
    }

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

    if (!tile) {
        return callback();
    }

    const buffer = fromGeojsonVt({ polygons: tile });

    await fs.writeFile(path.join(distPath, id, `${tileKey}.pbf`), buffer);

    callback();
};

async function drawInitial(ctx: CanvasRenderingContext2D, coords: Coords): Promise<boolean> {
    const zoom = coords[0];
    const x = coords[1];
    const y = coords[2];

    const tileSize = 1 / 2 ** zoom;

    ctx.antialias = 'none';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    const { minX, minY, maxX, maxY } = coordsToBound(coords);

    const indices = tree.search(minX, minY, maxX, maxY);

    if (indices.length === 0) {
        return false;
    }

    const data = await dataPromise;

    const promises = indices.map(async index => {
        const { offset, length } = getPointer(index);
        const buffer = Buffer.alloc(length);

        await data.read(buffer, 0, length, offset);

        const geometry: Polygon | MultiPolygon = JSON.parse(buffer.toString());

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
                        ctx.moveTo(canvasX + canvasPadding, canvasY + canvasPadding);
                    } else {
                        ctx.lineTo(canvasX + canvasPadding, canvasY + canvasPadding);
                    }
                }

                ctx.closePath();
            }

            ctx.fill();
        }
    });

    await Promise.all(promises);

    return true;
}

async function drawDownscaled(ctx: CanvasRenderingContext2D, coords: Coords): Promise<boolean> {
    const rasterPromises = getChildren(coords).map(child => loadRaster(child));
    const rasters = await Promise.all(rasterPromises);

    if (rasters.every(raster => raster === undefined)) {
        return false;
    }

    const pixels = squash(rasters);

    await fs.writeFile(path.join(tmpPath, `${coordsToKey(coords)}.bin`), await deflate(pixels));

    ctx.putImageData(createImageData(toRgba(pixels), canvasSize, canvasSize), 0, 0);

    return true;
}

async function loadRaster(coords: Coords): Promise<Uint8ClampedArray | undefined> {
    try {
        const buffer = await fs.readFile(path.join(tmpPath, `${coordsToKey(coords)}.bin`));

        const array = new Uint8ClampedArray(await inflate(buffer));

        return array;
    } catch (e) {
        return undefined;
    }
}

function getPointer(index: number): Pointer {
    return {
        offset: pointers[index * 2],
        length: pointers[index * 2 + 1],
    };
}
