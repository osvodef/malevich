import { simplificationTolerance, convolutionRadius, rasterSize, extent, tiles } from './constants';
import { coordsToKey, createSvg } from './utils';
import { Feature } from 'mapbox-vector-tile';
import { createGeoJson } from './geojson';
import { simplifyRing } from './simplify';
import { convolute } from './convolution';
import { performance } from 'perf_hooks';
import { sync as mkdirp } from 'mkdirp';
import { createCanvas } from 'canvas';
import { download } from './download';
import { parsePath } from './path';
import { Coords } from './types';
import { trace } from './trace';
import * as path from 'path';
import * as fs from 'fs';

run();

async function run(): Promise<void> {
    for (const coords of tiles) {
        await generalizeTile(coords);
    }

    fs.writeFileSync(path.join(__dirname, '..', 'dist', 'tiles.json'), JSON.stringify(tiles));
}

async function generalizeTile(coords: Coords): Promise<void> {
    const tileKey = coordsToKey(coords);

    console.log(`Processing ${tileKey}...`);

    const outputPath = path.join(__dirname, '..', 'dist', tileKey);

    mkdirp(outputPath);

    const tile = await download(coords);

    const polygons = tile.layers.polygons;
    const woods: Feature[] = [];

    for (let i = 0; i < polygons.length; i++) {
        const feature = polygons.feature(i);

        if (feature.properties.categ === 'forest') {
            woods.push(feature);
        }
    }

    const rasterStartTime = performance.now();

    let inputRingCount = 0;
    let inputVertexCount = 0;
    let outputRingCount = 0;
    let outputVertexCount = 0;

    for (const feature of woods) {
        const geometry = feature.loadGeometry();

        for (const ring of geometry) {
            inputRingCount += 1;
            inputVertexCount += ring.length;
        }
    }

    const canvas = createCanvas(rasterSize, rasterSize);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, rasterSize, rasterSize);

    for (const feature of woods) {
        const geometry = feature.loadGeometry();

        ctx.beginPath();

        for (const ring of geometry) {
            for (let i = 0; i < ring.length; i++) {
                const point = ring[i];
                const x = (point.x / extent) * rasterSize;
                const y = (point.y / extent) * rasterSize;

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

    const rasterTime = performance.now() - rasterStartTime;

    fs.writeFileSync(path.join(outputPath, 'rasterized.png'), canvas.toBuffer());

    const convolutionStartTime = performance.now();

    const imageData = ctx.getImageData(0, 0, rasterSize, rasterSize);

    convolute(imageData, convolutionRadius);

    ctx.putImageData(imageData, 0, 0);

    const convolutionTime = performance.now() - convolutionStartTime;

    fs.writeFileSync(path.join(outputPath, 'convoluted.png'), canvas.toBuffer());

    const tracingStartTime = performance.now();

    const traced = await trace(imageData);
    const rings = parsePath(traced);

    const tracingTime = performance.now() - tracingStartTime;

    const simplificationStartTime = performance.now();
    const simplifiedRings = rings.map(ring => simplifyRing(ring, simplificationTolerance));
    const simplificationTime = performance.now() - simplificationStartTime;

    for (const ring of simplifiedRings) {
        outputRingCount += 1;
        outputVertexCount += ring.length;
    }

    const geojson = createGeoJson(simplifiedRings, coords);

    fs.writeFileSync(
        path.join(outputPath, 'traced.svg'),
        createSvg(traced, rasterSize, rasterSize),
    );
    fs.writeFileSync(path.join(outputPath, 'output.geojson'), JSON.stringify(geojson, null, 4));

    const stats = {
        rasterTime,
        convolutionTime,
        tracingTime,
        simplificationTime,
        inputRingCount,
        inputVertexCount,
        outputRingCount,
        outputVertexCount,
    };

    fs.writeFileSync(path.join(outputPath, 'stats.json'), JSON.stringify(stats, null, 4));

    console.log(`Finished processing ${tileKey}`);
}
