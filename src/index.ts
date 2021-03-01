import { convolutionRadius, targetZoom, tileRasterSize } from './constants';
import { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { convolute } from './convolution';
import { createGeoJson } from './geojson';
import { performance } from 'perf_hooks';
import { createCanvas } from 'canvas';
import { trace } from './trace';
import * as path from 'path';
import * as fs from 'fs';
import {
    mercatorToTileCount,
    lngLatToMercator,
    mercatorToLngLat,
    unprojectPoint,
    projectPoint,
    toPrecision,
    createSvg,
    getBound,
    getBoundInfo,
} from './utils';

run();

async function run() {
    const inputPath = path.join(__dirname, '..', 'assets');
    const outputPath = path.join(__dirname, '..', 'dist');

    const geojson: FeatureCollection<Polygon | MultiPolygon> = JSON.parse(
        fs.readFileSync(path.join(inputPath, 'woods.geojson'), 'utf8'),
    );

    const polygons = geojson.features.filter(feature => {
        const { type } = feature.geometry;

        return type === 'Polygon' || type === 'MultiPolygon';
    });

    const rasterStartTime = performance.now();

    let inputRingCount = 0;
    let inputVertexCount = 0;

    for (const polygon of polygons) {
        const { geometry } = polygon;

        const ringSets =
            geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

        for (const ringSet of ringSets) {
            for (const ring of ringSet) {
                inputRingCount++;
                for (let i = 0; i < ring.length; i++) {
                    inputVertexCount++;
                    ring[i] = lngLatToMercator(ring[i]);
                }
            }
        }
    }

    const bound = getBound(polygons);

    const width = bound.maxX - bound.minX;
    const height = bound.maxY - bound.minY;

    const canvasWidth = Math.ceil(tileRasterSize * mercatorToTileCount(width, targetZoom));
    const canvasHeight = Math.ceil(tileRasterSize * mercatorToTileCount(height, targetZoom));

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    for (const polygon of polygons) {
        const { geometry } = polygon;

        const ringSets =
            geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

        ctx.beginPath();

        for (const ringSet of ringSets) {
            for (const ring of ringSet) {
                for (let i = 0; i < ring.length; i++) {
                    const point = ring[i];
                    const canvasPoint = projectPoint(point, bound, canvasWidth, canvasHeight);

                    if (i === 0) {
                        ctx.moveTo(canvasPoint[0], canvasPoint[1]);
                    } else {
                        ctx.lineTo(canvasPoint[0], canvasPoint[1]);
                    }
                }

                ctx.closePath();
            }
        }

        ctx.fillStyle = '#ffffff';
        ctx.fill();
    }

    const rasterTime = performance.now() - rasterStartTime;

    fs.writeFileSync(path.join(outputPath, 'rasterized.png'), canvas.toBuffer());

    const convolutionStartTime = performance.now();

    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

    convolute(imageData, convolutionRadius);

    ctx.putImageData(imageData, 0, 0);

    const convolutionTime = performance.now() - convolutionStartTime;

    fs.writeFileSync(path.join(outputPath, 'convoluted.png'), canvas.toBuffer());

    const tracingStartTime = performance.now();

    const traced = await trace(imageData);
    const outputPolygon = createGeoJson(traced);

    let outputRingCount = 0;
    let outputVertexCount = 0;

    for (const ring of outputPolygon.geometry.coordinates) {
        outputRingCount++;

        for (let i = 0; i < ring.length; i++) {
            outputVertexCount++;

            const point = mercatorToLngLat(
                unprojectPoint(ring[i], bound, canvasWidth, canvasHeight),
            );

            ring[i] = toPrecision(point, 7);
        }
    }

    const tracingTime = performance.now() - tracingStartTime;

    fs.writeFileSync(
        path.join(outputPath, 'traced.svg'),
        createSvg(traced, canvasWidth, canvasHeight),
    );

    fs.writeFileSync(path.join(outputPath, 'output.geojson'), JSON.stringify(outputPolygon));

    const stats = {
        ...getBoundInfo(bound),
        rasterTime,
        convolutionTime,
        tracingTime,
        inputRingCount,
        inputVertexCount,
        outputRingCount,
        outputVertexCount,
    };

    fs.writeFileSync(path.join(outputPath, 'stats.json'), JSON.stringify(stats, null, 4));
}
