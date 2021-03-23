import { coordsToKey, formatPercent, lngLatToMercator } from './utils';
import { MultiPolygon, Polygon } from 'geojson';
import { createGeoJson } from './geojson';
import { simplifyRing } from './simplify';
import { convolute } from './convolution';
import { fromGeojsonVt } from 'vt-pbf';
import { createCanvas } from 'canvas';
import lineReader from 'line-reader';
import { parsePath } from './path';
import geojsonvt from 'geojson-vt';
import { Coords } from './types';
import { trace } from './trace';
import * as path from 'path';
import * as fs from 'fs';
import {
    simplificationTolerance,
    convolutionRadius,
    rasterSize,
    padding,
    extent,
} from './constants';

export function generalizeTile(coords: Coords, outputPath: string, callback: () => void): void {
    const zoom = coords[0];
    const x = coords[1];
    const y = coords[2];

    const tileKey = coordsToKey(coords);

    const inputPath = path.join(__dirname, '..', '..', '..', 'woods.geojson');

    const canvasPadding = (padding * rasterSize) / extent;
    const canvasSize = rasterSize + 2 * canvasPadding;

    const canvas = createCanvas(canvasSize, canvasSize);
    const ctx = canvas.getContext('2d');

    ctx.antialias = 'none';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    let count = 0;
    const total = 5340958;
    const startTime = Date.now();

    lineReader.eachLine(inputPath, (line, last) => {
        const geometry: Polygon | MultiPolygon = JSON.parse(line);

        if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
            console.log('Bad Geometry', geometry);
            process.exit();
        }

        const ringSets =
            geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];

        ctx.fillStyle = '#ffffff';

        for (const ringSet of ringSets) {
            ctx.beginPath();

            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;

            for (const ring of ringSet) {
                for (let i = 0; i < ring.length; i++) {
                    const mercatorPoint = lngLatToMercator(ring[i]);

                    const x = mercatorPoint[0] * rasterSize;
                    const y = mercatorPoint[1] * rasterSize;

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

                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }

                ctx.closePath();
            }

            if (Math.round(minX) === Math.round(maxX) && Math.round(minY) === Math.round(maxY)) {
                ctx.fillRect(Math.round(minX), Math.round(minY), 1, 1);
            } else {
                ctx.fill();
            }
        }

        count++;

        if (count % 10000 === 0 && count > 0) {
            const progress = formatPercent((count / total) * 100);
            const elapsedTime = Date.now() - startTime;
            const totalTime = (elapsedTime / count) * total;
            const remainingTime = Math.round((totalTime - elapsedTime) / 1000);

            console.log(
                `* [${progress}%] Processed ${count} geometries. Estimated time left: ${remainingTime}s`,
            );
        }

        if (last) {
            const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);

            fs.writeFileSync(path.join(outputPath, `${tileKey}_rasterized.png`), canvas.toBuffer());

            convolute(imageData, convolutionRadius);

            ctx.putImageData(imageData, 0, 0);

            fs.writeFileSync(path.join(outputPath, `${tileKey}_convoluted.png`), canvas.toBuffer());

            trace(imageData).then(traced => {
                const rings = parsePath(traced);

                const simplifiedRings = rings.map(ring =>
                    simplifyRing(ring, simplificationTolerance),
                );

                const geojson = createGeoJson(simplifiedRings, coords);
                const tileIndex = geojsonvt(geojson, {
                    maxZoom: zoom,
                    tolerance: 0,
                });

                const tile = tileIndex.getTile(zoom, x, y);
                const buffer = fromGeojsonVt({ polygons: tile });

                fs.writeFile(path.join(outputPath, `${tileKey}.pbf`), buffer, callback);
            });

            return false;
        }
    });
}
