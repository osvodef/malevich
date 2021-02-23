import { getBound, lngLatToMercator, mercatorToTileCount, projectPoint } from './utils';
import { convolutionRadius, targetZoom, tileRasterSize, turdSize } from './constants';
import { FeatureCollection, Polygon } from 'geojson';
import { convolute } from './convolution';
import { createCanvas } from 'canvas';
import parse from 'parse-svg-path';
import potrace from 'potrace';
import * as path from 'path';
import * as fs from 'fs';

const geojson: FeatureCollection<Polygon> = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'woods.geojson'), 'utf8'),
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

ctx.antialias = 'none';
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

const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

convolute(imageData, convolutionRadius);

ctx.putImageData(imageData, 0, 0);

const tracer = new potrace.Potrace();

tracer.loadImage(imageData, () => {
    tracer.setParameters({
        alphaMax: 0,
        optCurve: false,
        blackOnWhite: false,
        threshold: 127,
        turdSize,
    });

    const path = tracer.getPathTag().split('"')[1];

    console.log(parse(path));
});
