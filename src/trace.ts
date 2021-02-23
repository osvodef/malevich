import { turdSize } from './constants';
import potrace from 'potrace';

export function trace(imageData: ImageData): Promise<string> {
    const tracer = new potrace.Potrace();

    return new Promise(resolve => {
        tracer.loadImage(imageData, () => {
            tracer.setParameters({
                alphaMax: 0,
                optCurve: false,
                blackOnWhite: false,
                threshold: 127,
                turdSize,
            });

            const path = tracer.getPathTag().split('"')[1];

            resolve(path);
        });
    });
}
