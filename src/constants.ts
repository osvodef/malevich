export const rasterSize = 1024;
export const extent = 4096;
export const padding = 256;

export const canvasPadding = (padding * rasterSize) / extent;
export const canvasSize = rasterSize + 2 * canvasPadding;

export const convolutionRadius = 4;
export const turdSize = 1;
export const simplificationTolerance = 1;

export const minZoom = 0;
export const maxZoom = 10;
