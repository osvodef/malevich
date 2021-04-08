const accessToken = 'Fcl36Sb9lU5ynhsN8ofA47SqaVDPAlnG5b669b1f243a48e40fd719fef7b80ecbe75a54da';
const mapboxAccessToken =
    'pk.eyJ1Ijoib3N2b2RlZiIsImEiOiJjazNwbjNlMWUwNGtkM2Vtb253MjM3cXhvIn0.A9Qebgu0gf2BlndYixeeOw';

const layersContainer = document.querySelector('#layers-container');
const stylesContainer = document.querySelector('#mapstyle-list');
const bufferContainer = document.querySelector('#buffer-list');
const rasterContainer = document.querySelector('#raster-list');
const pngContainer = document.querySelector('#png-list');
const disabledLayers = new Set(['Landuse-nationalpark']);

const styles = [];
let styleIndex = 0;
let layersDimmed = false;

const woodsets = [
    {
        id: 'buffer4px',
        name: '@ 4px',
        type: 'original',
        url: 'https://vapi.bleeding.mc-cdn.io/dataset/test_forest_s_8',
    },
    {
        id: 'buffer8px',
        name: '@ 8px',
        type: 'buffer',
        url: 'https://vapi.bleeding.mc-cdn.io/dataset/test_forest_s_8',
    },
    {
        id: 'buffer8px1.5ms',
        name: '@ 8px (1.5 minSurfaceFactor)',
        type: 'buffer',
        url: 'https://vapi.bleeding.mc-cdn.io/dataset/test_forest_s_8_ms_1_5',
    },
];
let woodsetIndex = 0;
let woodOutlines = false;

let minVertices = 0;
let minArea = 0;

const stats = new window.Stats();
const vtxPanel = stats.addPanel(new window.Stats.Panel('vtx', '#f8f', '#212'));
const drawPanel = stats.addPanel(new window.Stats.Panel('dc', '#ff8', '#221'));
document.body.appendChild(stats.dom);

window.stats = stats;
window.vtxCounts = {};
window.drawCount = 0;

run();

async function run() {
    await loadInitialStyles();
    await loadWoodsets();

    mapboxgl.accessToken = mapboxAccessToken;

    const map = new mapboxgl.Map({
        container: 'map',
        zoom: 7,
        center: [10, 50],
        hash: true,
        minZoom: 0,
        maxZoom: 9,
        transformRequest: url => {
            return { url: transformResourceUrl(url) };
        },
    });

    window.map = map;

    switchStyle(styles.length - 1);
    rerenderStyles();

    map.on('render', e => {
        const { vtxCounts, drawCount } = window;

        vtxPanel.update(getTotalVtxCount(vtxCounts), 10000000);
        drawPanel.update(drawCount, 1000);
    });

    map.on('move', () => dimLayers());
    map.on('idle', () => rerenderLayers());

    map.showTileBoundaries = false;
    map.showCollisionBoxes = false;
    map.showOverdrawInspector = false;

    document.querySelector('#tile-boundaries').addEventListener('input', e => {
        map.showTileBoundaries = e.target.checked;
    });

    document.querySelector('#collision-boxes').addEventListener('input', e => {
        map.showCollisionBoxes = e.target.checked;
    });

    document.querySelector('#overdraw-inspector').addEventListener('input', e => {
        map.showOverdrawInspector = e.target.checked;
    });

    document.querySelector('#wood-outlines').addEventListener('input', e => {
        woodOutlines = e.target.checked;
        switchStyle(styleIndex);
    });

    document.querySelector('#add-mapstyle-input').addEventListener('input', async e => {
        const file = e.target.files[0];

        const name = file.name
            .split('.')
            .slice(0, -1)
            .join('.');
        const style = JSON.parse(await file.text());

        addStyle(name, style);
        switchStyle(styles.length - 1);
        rerenderStyles();
    });

    document.querySelector('#scale-input').addEventListener('input', e => {
        const scale = Number(e.target.value);
        map.setScale(scale);
        document.querySelector('.indicator.scale').innerText = scale.toFixed(2);
    });

    rerenderWoods();
}

async function loadInitialStyles() {
    const styles = [
        {
            name: 'Base Carto (latest)',
            url: `https://vapi.bleeding.mapcreator.io/styles/Base%20Carto.json?access_token=${accessToken}`,
        },
    ];

    const jsons = await Promise.all(
        styles.map(style => fetch(style.url).then(response => response.json())),
    );

    for (let i = 0; i < styles.length; i++) {
        addStyle(styles[i].name, jsons[i]);
    }
}

async function loadWoodsets() {
    const tilesets = await fetch('./dist/tilesets.json').then(response => response.json());

    tilesets.reverse();

    for (const tileset of tilesets) {
        woodsets.push({
            id: tileset.id,
            type: tileset.id === 'png' ? 'png' : 'raster',
            name: `@ ${tileset.settings.convolutionRadius}px`,
        });
    }

    for (let i = 0; i < woodsets.length; i++) {
        woodsets[i].index = i;
    }
}

function addStyle(name, style) {
    styles.push({ name, style });
}

function switchStyle(index, options) {
    styleIndex = index;

    const style = JSON.parse(JSON.stringify(styles[styleIndex].style));
    const { sources, layers } = style;

    const woodset = woodsets[woodsetIndex];
    const woodsLayer = layers.find(layer => layer.id === 'Landuse-wood');

    if (woodsLayer !== undefined) {
        const { type } = woodset;

        if (type !== 'original') {
            const baseUrl = location.href.replace(location.hash, '');

            let url;

            if (type === 'raster') {
                url = `${baseUrl}dist/${woodset.id}/{z}_{x}_{y}.pbf`;
            } else if (type === 'buffer') {
                url = `${woodset.url}/{z}/{x}/{y}`;
            } else {
                url = `${baseUrl}dist/${woodset.id}/{z}_{x}_{y}.png`;
            }

            sources[woodset.id] = {
                type: type === 'png' ? 'raster' : 'vector',
                minzoom: 0,
                maxzoom: 8,
                tiles: [url],
            };

            if (type === 'png') {
                layers.length = 0;
                layers.push({
                    id: woodset.id,
                    type: 'raster',
                    source: woodset.id,
                });
            } else {
                woodsLayer['source-layer'] = 'polygons';
                woodsLayer['source'] = woodset.id;

                delete woodsLayer.filter;
            }
        }

        woodsLayer.minzoom = 0;

        if (woodOutlines) {
            woodsLayer.paint['fill-outline-color'] = '#ff0000';
        }
    }

    style.layers = style.layers.filter(layer => !disabledLayers.has(layer.id));

    window.map.setStyle(style, options);
}

function rerenderLayers() {
    layersDimmed = false;

    layersContainer.innerHTML = getLayersHtml();

    document.querySelectorAll('.layer').forEach(element => {
        element.addEventListener('click', () => {
            const layerId = element.dataset.id;

            if (!disabledLayers.has(layerId)) {
                disabledLayers.add(layerId);
            } else {
                disabledLayers.delete(layerId);
            }

            dimLayers();
            switchStyle(styleIndex);
        });
    });
}

function getLayersHtml() {
    const { vtxCounts } = window;
    const style = styles[styleIndex].style;

    const layers = style.layers.map(layer => {
        return {
            id: layer.id,
            vtcs: vtxCounts[layer.id] ?? 0,
        };
    });

    layers.sort((a, b) => b.vtcs - a.vtcs);

    const disabled = layers.filter(layer => disabledLayers.has(layer.id));
    const enabled = layers.filter(layer => !disabledLayers.has(layer.id));

    const maxVtxCount = layers[0].vtcs;

    let html = '';

    if (disabled.length > 0) {
        html += `<div class="layers-header">Disabled Nodes</div>`;
    }

    html += disabled.map(layer => getLayerHtml(layer, maxVtxCount)).join('');

    if (enabled.length > 0) {
        html += `<div class="layers-header">Enabled Nodes</div>`;
    }

    html += enabled.map(layer => getLayerHtml(layer, maxVtxCount)).join('');

    return `<div id="layers">${html}</div>`;
}

function getLayerHtml(layer, maxVtxCount) {
    const ratio = layer.vtcs / maxVtxCount;

    const opacity = disabledLayers.has(layer.id) ? 0.5 : 1;

    return `
        <div class="layer" data-id="${layer.id}" >
            <div class="layer-bar" style="width: ${ratio * 100}%; opacity: ${opacity}"></div>
            <div class="layer-text" style="opacity: ${opacity}">
                <div class="layer-id">${layer.id}</div>
                <div class="layer-vtcs">${formatNumber(layer.vtcs)}</div>
            </div>
        </div>
    `;
}

function rerenderStyles() {
    stylesContainer.innerHTML = styles.map((style, index) => getStyleHtml(index)).join('');

    document.querySelectorAll('.button.select').forEach(element => {
        element.addEventListener('click', () => {
            const index = Number(element.dataset.index);
            dimLayers();
            switchStyle(index);
            rerenderStyles();
        });
    });
}

function getStyleHtml(index) {
    const style = styles[index];
    const active = index === styleIndex ? 'active' : '';

    return `
        <div class="button select ${active}" data-index="${index}">
            <span class="title">${style.name}</span>
        </div>
    `;
}

function rerenderWoods() {
    const bufferHtml = woodsets
        .filter(woodset => woodset.type === 'buffer' || woodset.type === 'original')
        .map(woodset => {
            const active = woodset.index === woodsetIndex ? 'active' : '';

            return `
                <div class="button woods ${active}" data-id="${woodset.index}">
                    <span class="title">${woodset.name}</span>
                </div>
            `;
        })
        .join('');

    bufferContainer.innerHTML = bufferHtml;

    const rasterHtml = woodsets
        .filter(woodset => woodset.type === 'raster')
        .map(woodset => {
            const active = woodset.index === woodsetIndex ? 'active' : '';

            return `
                <div class="button woods ${active}" data-id="${woodset.index}">
                    <span class="title">${woodset.name}</span>
                </div>
            `;
        })
        .join('');

    rasterContainer.innerHTML = rasterHtml;

    const pngHtml = woodsets
        .filter(woodset => woodset.type === 'png')
        .map(woodset => {
            const active = woodset.index === woodsetIndex ? 'active' : '';

            return `
                <div class="button woods ${active}" data-id="${woodset.index}">
                    <span class="title">PNGs</span>
                </div>
            `;
        })
        .join('');

    pngContainer.innerHTML = pngHtml;

    document.querySelectorAll('.button.woods').forEach(element => {
        element.addEventListener('click', () => {
            woodsetIndex = Number(element.dataset.id);

            rerenderWoods();

            switchStyle(styleIndex);
        });
    });
}

function dimLayers() {
    if (layersDimmed) {
        return;
    }

    const panel = document.querySelector('#layers');

    if (panel) {
        panel.style.opacity = 0.5;
        panel.style.pointerEvents = 'none';
        layersDimmed = true;
    }
}

function getTotalVtxCount(vtxCounts) {
    let total = 0;

    for (const key in vtxCounts) {
        total += vtxCounts[key];
    }

    return total;
}

function formatNumber(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function transformResourceUrl(url) {
    url = url.replace('maps4news.com', 'mapcreator.io');
    url = url.replace(/vapi\.(mc-cdn|mapcreator)/, 'vapi.bleeding.$1');

    if (isVapiUrl(url)) {
        url = `${url}?access_token=${accessToken}`;
    }

    return url;
}

function isVapiUrl(url) {
    return /vapi\..*(mc-cdn|mapcreator)\.io/.test(url);
}

function debounce(func, wait, immediate) {
    let timeout;

    const out = (...args) => {
        const later = () => {
            timeout = undefined;

            if (!immediate) func(...args);
        };

        const callNow = immediate && typeof timeout === 'undefined';

        if (typeof timeout !== 'undefined') {
            clearTimeout(timeout);
        }

        timeout = setTimeout(later, wait);

        if (callNow) func(...args);
    };

    out.cancel = () => {
        clearTimeout(timeout);

        timeout = undefined;
    };

    return out;
}
