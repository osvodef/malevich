async function run () {
    const geojson = await fetch('./woods.geojson').then(response => response.json());

    const polygon = geojson.features.find(feature => {
        return feature.geometry.type === 'Polygon'
            && feature.geometry.coordinates.length === 1
            && feature.geometry.coordinates[0].length > 10;
    });

    const ring = polygon.geometry.coordinates[0];
    const bound = getBound(ring);

    const width = bound.maxX - bound.minX;
    const height = bound.maxY - bound.minY;
    const aspectRatio = width / height;

    const canvasWidth = 500;
    const canvasHeight = Math.ceil(canvasWidth * aspectRatio);



    console.log(getBound(ring));
}

function getBound(points) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const point of points) {
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
