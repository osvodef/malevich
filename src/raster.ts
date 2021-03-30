import zlib from 'zlib';
import { promisify } from 'util';
import { rasterSize } from './constants';

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

export function squash(
    leftTop: Uint8ClampedArray | undefined,
    rightTop: Uint8ClampedArray | undefined,
    leftBottom: Uint8ClampedArray | undefined,
    rightBottom: Uint8ClampedArray | undefined,
): Uint8ClampedArray {
    const pixels = new Uint8ClampedArray(rasterSize * rasterSize);

    if (leftTop !== undefined) {
        squashPart(pixels, leftTop, 0, 0);
    }

    if (rightTop !== undefined) {
        squashPart(pixels, rightTop, 1, 0);
    }

    if (leftBottom !== undefined) {
        squashPart(pixels, leftBottom, 0, 1);
    }

    if (rightBottom !== undefined) {
        squashPart(pixels, rightBottom, 1, 1);
    }

    return pixels;
}

function squashPart(dst: Uint8ClampedArray, src: Uint8ClampedArray, dx: number, dy: number): void {
    const halfSize = rasterSize / 2;
    const offsetX = dx * halfSize;
    const offsetY = dy * halfSize;

    for (let x = 0; x < halfSize; x++) {
        for (let y = 0; y < halfSize; y++) {
            const doubleX = x * 2;
            const doubleY = y * 2;

            const leftTop = src[doubleY * rasterSize + doubleX];
            const rightTop = src[doubleY * rasterSize + doubleX + 1];
            const leftBottom = src[(doubleY + 1) * rasterSize + doubleX];
            const rightBottom = src[(doubleY + 1) * rasterSize + doubleX + 1];

            dst[(offsetY + y) * rasterSize + offsetX + x] =
                (leftTop + rightTop + leftBottom + rightBottom) / 4;
        }
    }
}
