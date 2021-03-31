import zlib from 'zlib';
import { promisify } from 'util';
import { canvasPadding, canvasSize, rasterSize } from './constants';

export function toRgba(input: Uint8ClampedArray): Uint8ClampedArray {
    const output = new Uint8ClampedArray(input.length * 4);

    for (let i = 0; i < input.length; i++) {
        output[i * 4 + 0] = input[i];
        output[i * 4 + 1] = input[i];
        output[i * 4 + 2] = input[i];
        output[i * 4 + 3] = 255;
    }

    return output;
}

export function fromRgba(input: Uint8ClampedArray): Uint8ClampedArray {
    const output = new Uint8ClampedArray(input.length / 4);

    for (let i = 0; i < output.length; i++) {
        output[i] = input[i * 4];
    }

    return output;
}

export const inflate = promisify(zlib.inflate);
export const deflate = promisify(zlib.deflate);

export function squash(rasters: Array<Uint8ClampedArray | undefined>): Uint8ClampedArray {
    const pixels = new Uint8ClampedArray(canvasSize * canvasSize);

    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            const raster = rasters[j * 4 + i];

            if (raster !== undefined) {
                squashPart(pixels, raster, i - 1, j - 1);
            }
        }
    }

    return pixels;
}

function squashPart(dst: Uint8ClampedArray, src: Uint8ClampedArray, dx: number, dy: number): void {
    const halfRasterSize = rasterSize / 2;

    const offsetX = dx * halfRasterSize + canvasPadding;
    const offsetY = dy * halfRasterSize + canvasPadding;

    for (let x = 0; x < halfRasterSize; x++) {
        const dstX = offsetX + x;

        if (dstX < 0 || dstX >= canvasSize) {
            continue;
        }

        for (let y = 0; y < halfRasterSize; y++) {
            const dstY = offsetY + y;

            if (dstY < 0 || dstY >= canvasSize) {
                continue;
            }

            const baseX = x * 2 + canvasPadding;
            const baseY = y * 2 + canvasPadding;

            const leftTop = src[index(baseX, baseY)];
            const rightTop = src[index(baseX + 1, baseY)];
            const leftBottom = src[index(baseX, baseY + 1)];
            const rightBottom = src[index(baseX + 1, baseY + 1)];

            dst[index(offsetX + x, offsetY + y)] =
                (leftTop + rightTop + leftBottom + rightBottom) / 4;
        }
    }
}

function index(x: number, y: number): number {
    return y * canvasSize + x;
}
