import { Point } from './types';

export class Bound {
    public minX: number;
    public minY: number;
    public maxX: number;
    public maxY: number;

    constructor() {
        this.minX = Infinity;
        this.minY = Infinity;
        this.maxX = -Infinity;
        this.maxY = -Infinity;
    }

    public extend(point: Point): void {
        const x = point[0];
        const y = point[1];

        if (x < this.minX) {
            this.minX = x;
        }

        if (x > this.maxX) {
            this.maxX = x;
        }

        if (y < this.minY) {
            this.minY = y;
        }

        if (y > this.maxY) {
            this.maxY = y;
        }
    }
}
