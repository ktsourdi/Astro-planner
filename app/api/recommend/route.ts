import { NextRequest, NextResponse } from "next/server";
import targets from "@/data/targets.json";
import { z } from "zod";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  sensorW: z.coerce.number().positive(),
  sensorH: z.coerce.number().positive(),
  pixelUm: z.coerce.number().positive().optional(),
  focalMm: z.coerce.number().positive(),
  fNum: z.coerce.number().positive(),
  mount: z.enum(["fixed", "tracker", "guided"]).default("tracker"),
  date: z.string().datetime().optional(),
  targetId: z.string().optional(),
});

type Target = {
  id: string;
  name: string;
  type: string;
  size_deg: number;
  best_months?: number[];
};

function degreesFromSensorAndFocal(sensorMm: number, focalMm: number): number {
  const radians = 2 * Math.atan((sensorMm / 2) / focalMm);
  return (radians * 180) / Math.PI;
}

function computeFramingScore(fillRatio: number): number {
  if (!Number.isFinite(fillRatio) || fillRatio <= 0) return 0;
  // Heuristic: prefer fill around ~0.3 of the short FOV
  const ideal = 0.3;
  const sigma = 0.15; // spread
  const score = Math.exp(-Math.pow(fillRatio - ideal, 2) / (2 * sigma * sigma));
  return Math.max(0, Math.min(1, score));
}

function monthFromIso(dateIso?: string): number {
  const d = dateIso ? new Date(dateIso) : new Date();
  const m = d.getUTCMonth() + 1; // 1..12
  return m;
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const rawParams = Object.fromEntries(searchParams.entries());
  const parsed = querySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const p = parsed.data;

  const fovWidthDeg = degreesFromSensorAndFocal(p.sensorW, p.focalMm);
  const fovHeightDeg = degreesFromSensorAndFocal(p.sensorH, p.focalMm);
  const fovShortDeg = Math.min(fovWidthDeg, fovHeightDeg);

  const currentMonth = monthFromIso(p.date);

  const items = (targets as Target[]).map((t) => {
    const fillRatio = t.size_deg / fovShortDeg;
    const framingScore = computeFramingScore(fillRatio);
    const monthBoost = t.best_months?.includes(currentMonth) ? 0.15 : 0;
    const baseScore = framingScore + monthBoost;

    // very rough exposure heuristics by mount
    const mountSubExposure = p.mount === "guided" ? 180 : p.mount === "tracker" ? 60 : 10;
    const suggested = {
      sub_exposure_s: mountSubExposure,
      gain: 100,
      subs: 50,
      notes: p.mount === "guided" ? "Guided mount: longer subs OK" : p.mount === "tracker" ? "Tracker: moderate subs recommended" : "Fixed mount: keep subs short",
    };

    return {
      id: t.id,
      name: t.name,
      type: t.type,
      fill_ratio: Number(fillRatio.toFixed(3)),
      framing_score: Number(framingScore.toFixed(3)),
      score: Number(baseScore.toFixed(3)),
      suggested_capture: suggested,
    };
  });

  const recommended = items
    .filter((i) => i.framing_score > 0.15) // drop very poor framing
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const payload = {
    setup: {
      lat: p.lat,
      lon: p.lon,
      sensorW: p.sensorW,
      sensorH: p.sensorH,
      pixelUm: p.pixelUm ?? null,
      focalMm: p.focalMm,
      fNum: p.fNum,
      mount: p.mount,
      date: p.date ?? new Date().toISOString(),
    },
    recommended_targets: recommended,
    filtered_out_examples: items
      .filter((i) => i.framing_score <= 0.15)
      .slice(0, 3),
  };

  return NextResponse.json(payload, { status: 200 });
}

