import MBTiles, { Handle } from '@mapbox/mbtiles';
import { deflate } from './utils';
import { Coords } from './types';

export class TileWriter {
    private promise: Promise<Handle>;

    constructor(path: string) {
        this.promise = new Promise((resolve, reject) => {
            new MBTiles(path, (err, handle) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(handle);
                }
            });
        });
    }

    public async startWriting(): Promise<void> {
        const handle = await this.promise;

        await new Promise<void>((resolve, reject) => {
            handle.startWriting(err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public async stopWriting(): Promise<void> {
        const handle = await this.promise;

        await new Promise<void>((resolve, reject) => {
            handle.startWriting(err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public async putTile(coords: Coords, buffer: Buffer): Promise<void> {
        const handle = await this.promise;
        const deflated = await deflate(buffer);

        await new Promise<void>((resolve, reject) => {
            handle.putTile(coords[0], coords[1], coords[2], deflated, err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}
