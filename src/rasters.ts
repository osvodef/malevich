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

export function squash(
    leftTop: Uint8ClampedArray | undefined,
    rightTop: Uint8ClampedArray | undefined,
    leftBottom: Uint8ClampedArray | undefined,
    rightBottom: Uint8ClampedArray | undefined,
): Uint8ClampedArray {
    const pixels = new Uint8ClampedArray(canvasSize * canvasSize);

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

    fillPadding(pixels);

    return pixels;
}

function squashPart(dst: Uint8ClampedArray, src: Uint8ClampedArray, dx: number, dy: number): void {
    const halfRasterSize = rasterSize / 2;

    const offsetX = dx * halfRasterSize + canvasPadding;
    const offsetY = dy * halfRasterSize + canvasPadding;

    for (let x = 0; x < halfRasterSize; x++) {
        for (let y = 0; y < halfRasterSize; y++) {
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

function fillPadding(pixels: Uint8ClampedArray): void {
    const last = canvasSize - 1;

    for (let x = canvasPadding; x < canvasPadding + rasterSize; x++) {
        const topValue = pixels[index(x, canvasPadding)];
        const bottomValue = pixels[index(x, last - canvasPadding)];

        for (let y = 0; y < canvasPadding; y++) {
            pixels[index(x, y)] = topValue;
            pixels[index(x, last - y)] = bottomValue;
        }
    }

    for (let y = canvasPadding; y < canvasPadding + rasterSize; y++) {
        const leftValue = pixels[index(canvasPadding, y)];
        const rightValue = pixels[index(last - canvasPadding, y)];

        for (let x = 0; x < canvasPadding; x++) {
            pixels[index(x, y)] = leftValue;
            pixels[index(last - x, y)] = rightValue;
        }
    }

    const leftTopValue = pixels[index(canvasPadding, canvasPadding)];
    const leftBottomValue = pixels[index(canvasPadding, last - canvasPadding)];
    const rightTopValue = pixels[index(last - canvasPadding, canvasPadding)];
    const rightBottomValue = pixels[index(last - canvasPadding, last - canvasPadding)];

    for (let x = 0; x < canvasPadding; x++) {
        for (let y = 0; y < canvasPadding; y++) {
            pixels[index(x, y)] = leftTopValue;
            pixels[index(x, last - y)] = leftBottomValue;
            pixels[index(last - x, y)] = rightTopValue;
            pixels[index(last - x, last - y)] = rightBottomValue;
        }
    }
}

function index(x: number, y: number): number {
    return y * canvasSize + x;
}
