import { NextRequest } from "next/server";
import { z } from "zod";
import SunCalc from "suncalc";
import targets from "@/data/targets.json";
import { jsonWithApiContract } from "@/lib/api-contract";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  sensorW: z.coerce.number().positive(),
  sensorH: z.coerce.number().positive(),
  focalMm: z.coerce.number().positive(),
  date: z.string().datetime().optional(),
  range: z.enum(["week", "month", "season"]).default("week").optional(),
  minAlt: z.coerce.number().min(0).max(89).default(10).optional(),
  minScore: z.coerce.number().min(0).max(1).default(0.4).optional(),
  type: z.string().optional(),
  maxPerNight: z.coerce.number().min(1).max(20).default(5).optional(),
});

type Target = {
  id: string;
  name: string;
  type: string;
  ra_hms: string;
  dec_dms: string;
  size_deg: number;
  best_months?: number[];
};

type WeatherData = {
  cloudByHour: Map<string, number>;
  generatedAtUtc: string;
};

const WEATHER_REVALIDATE_SECONDS = 60 * 30;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

function normalizeDegrees(deg: number): number {
  let x = deg % 360;
  if (x < 0) x += 360;
  return x;
}

function gmstDegrees(date: Date): number {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const D = JD - 2451545.0;
  const T = D / 36525.0;
  const GMST = 280.46061837 + 360.98564736629 * D + 0.000387933 * (T * T) - (T * T * T) / 38710000;
  return normalizeDegrees(GMST);
}

function parseHmsToHours(hms: string): number {
  const [h, m, s] = hms.split(":").map(Number);
  return (Math.abs(h) || 0) + (m || 0) / 60 + (s || 0) / 3600;
}

function parseDmsToDegrees(dms: string): number {
  const sign = dms.trim().startsWith("-") ? -1 : 1;
  const clean = dms.replace(/[+\-]/, "");
  const [d, m, s] = clean.split(":").map(Number);
  const deg = (Math.abs(d) || 0) + (m || 0) / 60 + (s || 0) / 3600;
  return sign * deg;
}

function altitudeDegreesAt(date: Date, latDeg: number, lonDeg: number, raHours: number, decDeg: number): number {
  const gmst = gmstDegrees(date);
  const lst = normalizeDegrees(gmst + lonDeg);
  const raDeg = raHours * 15;
  const hourAngle = normalizeDegrees(lst - raDeg);
  const H = toRadians(hourAngle);
  const phi = toRadians(latDeg);
  const delta = toRadians(decDeg);
  const sinAlt = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(H);
  return toDegrees(Math.asin(Math.max(-1, Math.min(1, sinAlt))));
}

function horizontalCoordsAt(
  date: Date,
  latDeg: number,
  lonDeg: number,
  raHours: number,
  decDeg: number
): { altDeg: number; azRad: number } {
  const gmst = gmstDegrees(date);
  const lst = normalizeDegrees(gmst + lonDeg);
  const raDeg = raHours * 15;
  const hourAngle = normalizeDegrees(lst - raDeg);
  const H = toRadians(hourAngle);
  const phi = toRadians(latDeg);
  const delta = toRadians(decDeg);
  const sinAlt = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(delta) * Math.cos(phi));
  return { altDeg: toDegrees(alt), azRad: az };
}

function angularSeparationDeg(alt1Deg: number, az1Rad: number, alt2Deg: number, az2Rad: number): number {
  const alt1 = toRadians(alt1Deg);
  const alt2 = toRadians(alt2Deg);
  const cosSep = Math.sin(alt1) * Math.sin(alt2) + Math.cos(alt1) * Math.cos(alt2) * Math.cos(az1Rad - az2Rad);
  return toDegrees(Math.acos(Math.max(-1, Math.min(1, cosSep))));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function hourKeyUtc(date: Date): string {
  return `${date.toISOString().slice(0, 13)}:00`;
}

async function fetchHourlyCloudCover(lat: number, lon: number): Promise<WeatherData | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
    String(lat)
  )}&longitude=${encodeURIComponent(String(lon))}&hourly=cloud_cover&forecast_days=2&timezone=UTC`;
  try {
    const resp = await fetch(url, { next: { revalidate: WEATHER_REVALIDATE_SECONDS } });
    if (!resp.ok) return null;
    const json = await resp.json();
    const times: string[] = Array.isArray(json?.hourly?.time) ? json.hourly.time : [];
    const clouds: number[] = Array.isArray(json?.hourly?.cloud_cover) ? json.hourly.cloud_cover : [];
    if (!times.length || !clouds.length || times.length !== clouds.length) return null;
    const cloudByHour = new Map<string, number>();
    for (let i = 0; i < times.length; i++) {
      const t = String(times[i]);
      const c = Number(clouds[i]);
      if (!Number.isFinite(c)) continue;
      cloudByHour.set(t.slice(0, 13), c);
    }
    return { cloudByHour, generatedAtUtc: new Date().toISOString() };
  } catch {
    return null;
  }
}

function cloudStatsForWindow(startIso: string, endIso: string, cloudByHour: Map<string, number>) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  let sum = 0;
  let count = 0;
  for (let ms = start; ms <= end; ms += 60 * 60 * 1000) {
    const key = hourKeyUtc(new Date(ms));
    const cloud = cloudByHour.get(key);
    if (cloud == null) continue;
    sum += cloud;
    count += 1;
  }
  if (!count) return { avgCloudPct: null as number | null, sampleCount: 0 };
  return {
    avgCloudPct: Number((sum / count).toFixed(1)),
    sampleCount: count,
  };
}

function computeVisibilityWindow(
  t: Target,
  lat: number,
  lon: number,
  atIso?: string,
  minAlt = 10
): { start_utc: string; end_utc: string; alt_max_deg: number } | null {
  const base = atIso ? new Date(atIso) : new Date();
  const offsetMinutes = lon * 4;
  const localMs = base.getTime() + offsetMinutes * 60 * 1000;
  const localDate = new Date(localMs);
  const times0 = SunCalc.getTimes(localDate, lat, lon) as any;
  const times1 = SunCalc.getTimes(new Date(localDate.getTime() + 24 * 3600000), lat, lon) as any;
  const start = (times0.night as Date) || (times0.dusk as Date) || (times0.sunset as Date);
  const end = (times1.nightEnd as Date) || (times1.dawn as Date) || (times1.sunrise as Date);
  if (!start || !end || !(start instanceof Date) || !(end instanceof Date) || start >= end) return null;

  const raH = parseHmsToHours(t.ra_hms);
  const decD = parseDmsToDegrees(t.dec_dms);
  const stepMinutes = 10;
  let maxAlt = -90;
  let firstVisible: Date | null = null;
  let lastVisible: Date | null = null;
  for (let ms = start.getTime(); ms <= end.getTime(); ms += stepMinutes * 60 * 1000) {
    const d = new Date(ms);
    const alt = altitudeDegreesAt(d, lat, lon, raH, decD);
    if (alt > maxAlt) maxAlt = alt;
    if (alt >= minAlt) {
      if (!firstVisible) firstVisible = d;
      lastVisible = d;
    }
  }
  if (!firstVisible || !lastVisible) return null;
  return {
    start_utc: firstVisible.toISOString(),
    end_utc: new Date(lastVisible.getTime() + stepMinutes * 60 * 1000).toISOString(),
    alt_max_deg: Number(maxAlt.toFixed(1)),
  };
}

function degreesFromSensorAndFocal(sensorMm: number, focalMm: number): number {
  const radians = 2 * Math.atan((sensorMm / 2) / focalMm);
  return (radians * 180) / Math.PI;
}

function computeFramingScore(fillRatio: number): number {
  if (!Number.isFinite(fillRatio) || fillRatio <= 0) return 0;
  const ideal = 0.3;
  const sigma = 0.15;
  const score = Math.exp(-Math.pow(fillRatio - ideal, 2) / (2 * sigma * sigma));
  return Math.max(0, Math.min(1, score));
}

function rotateMonthsForSouthernHemisphere(months: number[] | undefined, latDeg: number): number[] | undefined {
  if (!months || months.length === 0) return months;
  if (latDeg >= 0) return months;
  return months.map((m) => ((m + 5) % 12) + 1);
}

function localMonthAtLongitude(dateIso: string | undefined, lonDeg: number): number {
  const base = dateIso ? new Date(dateIso) : new Date();
  const offsetMinutes = lonDeg * 4;
  const localMs = base.getTime() + offsetMinutes * 60 * 1000;
  const local = new Date(localMs);
  return local.getUTCMonth() + 1;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 3600000);
}

const DAYS_PER_WEEK = 7;
// Planner month preset is intentionally a simple rolling 30-night window.
const DAYS_PER_MONTH_APPROXIMATE = 30;
const DAYS_PER_SEASON = 90;

function countDaysForRange(range: "week" | "month" | "season"): number {
  if (range === "month") return DAYS_PER_MONTH_APPROXIMATE;
  if (range === "season") return DAYS_PER_SEASON;
  return DAYS_PER_WEEK;
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return jsonWithApiContract({ error: "Invalid query parameters", issues: parsed.error.flatten() }, { status: 400 });
  }

  const p = parsed.data;
  const sourceTargets = targets as Target[];
  const startDate = p.date ? new Date(p.date) : new Date();
  const totalDays = countDaysForRange(p.range ?? "week");
  const shortFov = Math.min(degreesFromSensorAndFocal(p.sensorW, p.focalMm), degreesFromSensorAndFocal(p.sensorH, p.focalMm));
  const minAlt = p.minAlt ?? 10;
  const minScore = p.minScore ?? 0.4;
  const typeFilter = (p.type || "").trim().toLowerCase();
  const maxPerNight = p.maxPerNight ?? 5;
  const weather = await fetchHourlyCloudCover(p.lat, p.lon);

  const nights: Array<{
    date_utc: string;
    best_windows: Array<{
      id: string;
      name: string;
      type: string;
      score: number;
      score_breakdown: { visibility: number; framing: number; season: number; moon: number; weather: number };
      moon: {
        illumination_fraction: number;
        average_altitude_deg: number | null;
        average_separation_deg: number | null;
        above_horizon_fraction: number;
      };
      weather: {
        avg_cloud_pct: number | null;
        confidence: "high" | "medium" | "low";
        sample_hours: number;
      };
      window: { start_utc: string; end_utc: string; alt_max_deg: number };
    }>;
  }> = [];

  for (let day = 0; day < totalDays; day++) {
    const nightDate = addDays(startDate, day);
    const nightIso = nightDate.toISOString();
    const month = localMonthAtLongitude(nightIso, p.lon);
    const nightRows = sourceTargets
      .filter((t) => !typeFilter || t.type.toLowerCase().includes(typeFilter))
      .map((t) => {
        const window = computeVisibilityWindow(t, p.lat, p.lon, nightIso, minAlt);
        if (!window) return null;
        const visibleHours = (new Date(window.end_utc).getTime() - new Date(window.start_utc).getTime()) / 3600000;
        const visibility = Math.max(0, Math.min(1, 0.6 * Math.min(1, visibleHours / 8) + 0.4 * Math.min(1, window.alt_max_deg / 80)));
        const fillRatio = t.size_deg / shortFov;
        const framing = computeFramingScore(fillRatio);
        const effectiveBestMonths = rotateMonthsForSouthernHemisphere(t.best_months, p.lat);
        const season = effectiveBestMonths?.includes(month) ? 1 : 0;
        const moonIllumination = SunCalc.getMoonIllumination(new Date(nightIso)).fraction;
        let moonAboveFraction = 0;
        let moonAltSamples = 0;
        let moonAltSum = 0;
        let moonSepSamples = 0;
        let moonSepSum = 0;
        const raH = parseHmsToHours(t.ra_hms);
        const decD = parseDmsToDegrees(t.dec_dms);
        const startMs = new Date(window.start_utc).getTime();
        const endMs = new Date(window.end_utc).getTime();
        let moonSampleCount = 0;
        let moonAboveCount = 0;
        for (let ms = startMs; ms <= endMs; ms += 20 * 60 * 1000) {
          const d = new Date(ms);
          const target = horizontalCoordsAt(d, p.lat, p.lon, raH, decD);
          const moon = SunCalc.getMoonPosition(d, p.lat, p.lon) as any;
          const moonAltDeg = toDegrees(moon.altitude);
          if (moonAltDeg > 0) moonAboveCount += 1;
          moonAltSamples += 1;
          moonAltSum += moonAltDeg;
          const sep = angularSeparationDeg(target.altDeg, target.azRad, moonAltDeg, moon.azimuth);
          if (Number.isFinite(sep)) {
            moonSepSamples += 1;
            moonSepSum += sep;
          }
          moonSampleCount += 1;
        }
        moonAboveFraction = moonSampleCount ? moonAboveCount / moonSampleCount : 0;
        const moonAvgAltDeg = moonAltSamples ? Number((moonAltSum / moonAltSamples).toFixed(1)) : null;
        const moonAvgSepDeg = moonSepSamples ? Number((moonSepSum / moonSepSamples).toFixed(1)) : null;
        const moonPenalty = clamp01(
          moonIllumination * 0.35 +
            moonAboveFraction * 0.45 +
            (moonAvgSepDeg != null ? clamp01((60 - moonAvgSepDeg) / 60) * 0.2 : 0)
        );
        const moonScore = Number((1 - moonPenalty).toFixed(3));
        const cloudStats =
          weather?.cloudByHour != null
            ? cloudStatsForWindow(window.start_utc, window.end_utc, weather.cloudByHour)
            : { avgCloudPct: null, sampleCount: 0 };
        const weatherScore =
          cloudStats.avgCloudPct == null ? 0.5 : Number(clamp01(1 - cloudStats.avgCloudPct / 100).toFixed(3));
        const weatherConfidence: "high" | "medium" | "low" =
          cloudStats.sampleCount >= 5 ? "high" : cloudStats.sampleCount >= 2 ? "medium" : "low";
        const score = Number((0.4 * visibility + 0.25 * framing + 0.1 * season + 0.15 * moonScore + 0.1 * weatherScore).toFixed(3));
        return {
          id: t.id,
          name: t.name,
          type: t.type,
          score,
          score_breakdown: {
            visibility: Number(visibility.toFixed(3)),
            framing: Number(framing.toFixed(3)),
            season,
            moon: moonScore,
            weather: weatherScore,
          },
          moon: {
            illumination_fraction: Number(moonIllumination.toFixed(3)),
            average_altitude_deg: moonAvgAltDeg,
            average_separation_deg: moonAvgSepDeg,
            above_horizon_fraction: Number(moonAboveFraction.toFixed(3)),
          },
          weather: {
            avg_cloud_pct: cloudStats.avgCloudPct,
            confidence: weatherConfidence,
            sample_hours: cloudStats.sampleCount,
          },
          window,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .filter((x) => x.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPerNight);

    nights.push({
      date_utc: nightDate.toISOString(),
      best_windows: nightRows,
    });
  }

  return jsonWithApiContract(
    {
      setup: {
        lat: p.lat,
        lon: p.lon,
        sensorW: p.sensorW,
        sensorH: p.sensorH,
        focalMm: p.focalMm,
        date: p.date ?? new Date().toISOString(),
      },
      filters: {
        range: p.range ?? "week",
        minAlt,
        minScore,
        type: p.type ?? "",
      },
      context: {
        weather_source: weather ? "open-meteo" : "unavailable",
        weather_generated_at_utc: weather?.generatedAtUtc ?? null,
      },
      nights,
    },
    { status: 200 }
  );
}
