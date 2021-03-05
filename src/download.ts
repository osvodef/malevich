import { VectorTile } from 'mapbox-vector-tile';
import { Coords } from './types';
import fetch from 'node-fetch';

export async function download(coords: Coords): Promise<VectorTile> {
    const [z, x, y] = coords;

    const url = `https://vapi.mc-cdn.io/dataset/base/${z}/${x}/${y}?access_token=tGWUl5E518B6TgkaBpK0FCRqBKjZouMS2a88e49397231ad4b47c1f8cfd51d9a63b4ad218`;
    const data = await fetch(url).then(response => response.arrayBuffer());

    return new VectorTile(new Uint8Array(data));
}