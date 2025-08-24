import { clamp } from './util';

export function scoreWindow(params: {
  altDeg: number;
  cloudPct: number;
  moonPhase: number;
  moonAltDeg: number;
  bortle?: number;
  framing: number;
}): number {
  const { altDeg, cloudPct, moonPhase, moonAltDeg, bortle, framing } = params;
  const vis = clamp((altDeg - 20) / 50, 0, 1);
  const cloudsScore = 1 - clamp(cloudPct / 100, 0, 1);
  const moonPenalty = (moonAltDeg > 10 ? moonPhase : 0) * 0.6;
  const lpPenalty = bortle ? Math.min(bortle / 9, 1) * 0.3 : 0;
  const score = 0.35 * clamp(framing, 0, 1) + 0.25 * vis + 0.20 * cloudsScore + 0.20 * (1 - clamp(moonPenalty + lpPenalty, 0, 1));
  return clamp(score, 0, 1);
}