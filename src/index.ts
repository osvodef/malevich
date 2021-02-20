import {
    getBound,
    lngLatToMercator,
    mercatorToTileCount,
    monochromize,
    projectPoint,
} from './utils';
import { FeatureCollection, Polygon } from 'geojson';
import { quality, targetZoom, tileSize } from './constants';

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

    const canvasWidth = Math.ceil(quality * tileSize * mercatorToTileCount(width, targetZoom));
    const canvasHeight = Math.ceil(quality * tileSize * mercatorToTileCount(height, targetZoom));

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
    const pixels = imageData.data;

    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i + 0] = monochromize(pixels[i + 0]);
        pixels[i + 1] = monochromize(pixels[i + 1]);
        pixels[i + 2] = monochromize(pixels[i + 2]);
    }

    ctx.putImageData(imageData, 0, 0);
}

run();
