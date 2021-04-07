export const rasterSize = 1024;
export const extent = 4096;
export const padding = 32;

export const canvasPadding = (padding * rasterSize) / extent;
export const canvasSize = rasterSize + 2 * canvasPadding;

export const convolutionRadius = 1;
export const turdSize = 1;
export const simplificationTolerance = 1;
export const threshold = 0.75;

export const minZoom = 0;
export const maxZoom = 10;

export const savePng = false;
