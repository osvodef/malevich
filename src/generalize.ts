import { coordsToKey } from './utils';
import { Coords } from './types';
import { Feature } from 'mapbox-vector-tile';
import { createGeoJson } from './geojson';
import { simplifyRing } from './simplify';
import { convolute } from './convolution';
import { fromGeojsonVt } from 'vt-pbf';
import { createCanvas } from 'canvas';
import { download } from './download';
import { parsePath } from './path';
import geojsonvt from 'geojson-vt';
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

module.exports = function generalizeTile(
    coords: Coords,
    outputPath: string,
    callback: () => void,
): void {
    const zoom = coords[0];
    const x = coords[1];
    const y = coords[2];

    const tileKey = coordsToKey(coords);

    download(coords)
        .then(input => {
            const polygons = input.layers.polygons;
            const woods: Feature[] = [];

            for (let i = 0; i < polygons.length; i++) {
                const feature = polygons.feature(i);

                if (feature.properties.categ === 'forest') {
                    woods.push(feature);
                }
            }

            const canvasPadding = (padding * rasterSize) / extent;
            const canvasSize = rasterSize + 2 * canvasPadding;

            const canvas = createCanvas(canvasSize, canvasSize);
            const ctx = canvas.getContext('2d');

            ctx.antialias = 'none';
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvasSize, canvasSize);

            for (const feature of woods) {
                const geometry = feature.loadGeometry();

                ctx.beginPath();

                for (const ring of geometry) {
                    for (let i = 0; i < ring.length; i++) {
                        const point = ring[i];
                        const x = ((point.x + padding) / extent) * rasterSize;
                        const y = ((point.y + padding) / extent) * rasterSize;

                        if (i === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                    }

                    ctx.closePath();
                }

                ctx.fillStyle = '#ffffff';
                ctx.fill();
            }

            const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);

            convolute(imageData, convolutionRadius);

            ctx.putImageData(imageData, 0, 0);

            return trace(imageData);
        })
        .then(traced => {
            const rings = parsePath(traced);

            const simplifiedRings = rings.map(ring => simplifyRing(ring, simplificationTolerance));

            const geojson = createGeoJson(simplifiedRings, coords);
            const tileIndex = geojsonvt(geojson, {
                maxZoom: zoom,
                tolerance: 0,
            });

            const tile = tileIndex.getTile(zoom, x, y);
            const buffer = fromGeojsonVt({ polygons: tile });

            fs.writeFile(path.join(outputPath, `${tileKey}.pbf`), buffer, callback);
        });
};
