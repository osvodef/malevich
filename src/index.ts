import { getBound, lngLatToMercator, mercatorToTileCount, projectPoint } from './utils';
import { convolutionRadius, targetZoom, tileRasterSize, turdSize } from './constants';
import { FeatureCollection, Polygon } from 'geojson';
import { convolute } from './convolution';
import parse from 'parse-svg-path';
import potrace from 'potrace';

async function run() {
    const geojson: FeatureCollection<Polygon> = await fetch('./woods.geojson').then(response =>
        response.json(),
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

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.imageSmoothingEnabled = false;
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

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = canvasWidth;
    outputCanvas.height = canvasHeight;
    document.body.appendChild(outputCanvas);

    const outputCtx = outputCanvas.getContext('2d') as CanvasRenderingContext2D;
    outputCtx.putImageData(imageData, 0, 0);

    const tracer = new potrace.Potrace();

    tracer.loadImage(outputCanvas.toDataURL(), () => {
        tracer.setParameters({
            alphaMax: 0,
            optCurve: false,
            blackOnWhite: false,
            threshold: 127,
            turdSize,
        });

        const path = tracer.getPathTag().split('"')[1];

        parse(path);
    });
}

run();
