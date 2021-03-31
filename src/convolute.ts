import { threshold } from './constants';

export function convolute(imageData: ImageData, radius: number): void {
    const width = imageData.width;
    const height = imageData.height;
    const pixels = imageData.data;

    const pixelThreshold = threshold * 255;
    const convoThreshold = (2 * radius + 1) ** 2 * 127;

    for (let i = 0; i < pixels.length; i += 4) {
        const value = pixels[i] > pixelThreshold ? 255 : 0;

        pixels[i + 0] = value;
        pixels[i + 1] = value;
        pixels[i + 2] = value;
    }

    const result = new Uint8Array(width * height);

    for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
            const minX = Math.max(0, i - radius);
            const maxX = Math.min(width - 1, i + radius);
            const minY = Math.max(0, j - radius);
            const maxY = Math.min(height - 1, j + radius);

            let sum = 0;

            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    sum += pixels[y * width * 4 + x * 4];
                }
            }

            result[j * width + i] = sum > convoThreshold ? 255 : 0;
        }
    }

    for (let i = 0; i < result.length; i++) {
        pixels[i * 4 + 0] = result[i];
        pixels[i * 4 + 1] = result[i];
        pixels[i * 4 + 2] = result[i];
    }
}
