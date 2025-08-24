export function pixelScaleArcsecPerPx(pixelUm: number, focalMm: number): number {
  return 206.265 * (pixelUm / focalMm);
}

export function fovDeg(sensor: { w: number; h: number }, focalMm: number): { w: number; h: number } {
  return {
    w: 57.296 * (sensor.w / focalMm),
    h: 57.296 * (sensor.h / focalMm),
  };
}

export function fillRatio(targetSizeDeg: number, fov: { w: number; h: number }): number {
  const minFov = Math.min(fov.w, fov.h);
  return targetSizeDeg / Math.max(minFov, 1e-6);
}

export function framingScore(fillRatioValue: number): number {
  const ideal = 0.55;
  const score = 1 - Math.abs(ideal - fillRatioValue) / ideal;
  return Math.max(0, Math.min(1, score));
}

export function npfSeconds(fNum: number, pixelUm: number, focalMm: number, decDeg = 0): number {
  const cosDec = Math.cos((decDeg * Math.PI) / 180);
  const t = ((35 * fNum) + (13.7 * pixelUm)) / (focalMm * Math.max(cosDec, 1e-6));
  return t;
}