import { convolutionRadius, targetZoom, tileRasterSize } from './constants';
import { FeatureCollection, Polygon } from 'geojson';
import { convolute } from './convolution';
import { createGeoJson } from './geojson';
import { createCanvas } from 'canvas';
import { trace } from './trace';
import * as path from 'path';
import * as fs from 'fs';
import {
    createSvg,
    getBound,
    lngLatToMercator,
    mercatorToLngLat,
    mercatorToTileCount,
    projectPoint,
    toPrecision,
    unprojectPoint,
} from './utils';

run();

async function run() {
    const inputPath = path.join(__dirname, '..', 'assets');
    const outputPath = path.join(__dirname, '..', 'dist');

    const geojson: FeatureCollection<Polygon> = JSON.parse(
        fs.readFileSync(path.join(inputPath, 'woods.geojson'), 'utf8'),
    );

    const polygons = geojson.features.filter(feature => {
        return feature.geometry.type === 'Polygon';
    });

    for (const polygon of polygons) {
        for (const ring of polygon.geometry.coordinates) {
            for (let i = 0; i < ring.length; i++) {
                ring[i] = lngLatToMercator(ring[i]);
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
        const rings = polygon.geometry.coordinates;

        ctx.beginPath();

        for (const ring of rings) {
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

        ctx.fillStyle = '#ffffff';
        ctx.fill();
    }

    fs.writeFileSync(path.join(outputPath, 'rasterized.png'), canvas.toBuffer());

    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

    convolute(imageData, convolutionRadius);

    ctx.putImageData(imageData, 0, 0);

    fs.writeFileSync(path.join(outputPath, 'convoluted.png'), canvas.toBuffer());

    const traced = await trace(imageData);

    fs.writeFileSync(
        path.join(outputPath, 'traced.svg'),
        createSvg(traced, canvasWidth, canvasHeight),
    );

    const outputPolygon = createGeoJson(traced);

    for (const ring of outputPolygon.geometry.coordinates) {
        for (let i = 0; i < ring.length; i++) {
            const point = mercatorToLngLat(
                unprojectPoint(ring[i], bound, canvasWidth, canvasHeight),
            );

            ring[i] = toPrecision(point, 7);
        }
    }

    fs.writeFileSync(path.join(outputPath, 'output.geojson'), JSON.stringify(outputPolygon));
}
