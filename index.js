async function run () {
    const geojson = await fetch('./woods.geojson').then(response => response.json());

    const polygons = geojson.features.filter(feature => {
        return feature.geometry.type === 'Polygon'
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
    const aspectRatio = width / height;

    const canvasWidth = 2000;
    const canvasHeight = Math.ceil(canvasWidth / aspectRatio);

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
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

        ctx.fillStyle = "#ffffff";
        ctx.fill();
    }
}

function projectPoint(point, bound, canvasWidth, canvasHeight) {
    const width = bound.maxX - bound.minX;
    const height = bound.maxY - bound.minY;

    return [
        (point[0] - bound.minX) / width * canvasWidth,
        (point[1] - bound.minY) / height * canvasHeight,
    ];
}

function getBound(polygons) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const polygon of polygons) {
        const rings = polygon.geometry.coordinates;

        for (const ring of rings) {
            for (const point of ring) {
                if (point[0] < minX) {
                    minX = point[0];
                }

                if (point[0] > maxX) {
                    maxX = point[0];
                }

                if (point[1] < minY) {
                    minY = point[1];
                }

                if (point[1] > maxY) {
                    maxY = point[1];
                }
            }
        }
    }



    return {minX, maxX, minY, maxY};
}

function lngLatToMercator(lngLat) {
    return [
        mercatorXfromLng(lngLat[0]),
        mercatorYfromLat(lngLat[1]),
    ];
}

function mercatorXfromLng(lng) {
    return (180 + lng) / 360;
}

function mercatorYfromLat(lat) {
    return (180 - (180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)))) / 360;
}

run();
