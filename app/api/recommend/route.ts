import { NextRequest, NextResponse } from "next/server";
import localTargets from "@/data/targets.json";
import SunCalc from "suncalc";
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
  minAlt: z.coerce.number().min(0).max(89).default(10).optional(),
  maxMag: z.coerce.number().min(-10).max(20).default(12).optional(),
});

type Target = {
  id: string;
  name: string;
  type: string;
  size_deg: number;
  ra_hms: string;
  dec_dms: string;
  best_months?: number[];
  image_url?: string;
  description?: string;
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

function parseHmsToHours(hms: string): number {
  const [h, m, s] = hms.split(":").map(Number);
  const sign = 1;
  const hours = (Math.abs(h) || 0) + (m || 0) / 60 + (s || 0) / 3600;
  return sign * hours;
}

function parseDmsToDegrees(dms: string): number {
  // Expect formats like +41:16:09 or -05:23:28
  const sign = dms.trim().startsWith("-") ? -1 : 1;
  const clean = dms.replace(/[+\-]/, "");
  const [d, m, s] = clean.split(":").map(Number);
  const deg = (Math.abs(d) || 0) + (m || 0) / 60 + (s || 0) / 3600;
  return sign * deg;
}

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
  // Meeus approximation
  const JD = date.getTime() / 86400000 + 2440587.5;
  const D = JD - 2451545.0;
  const D0 = Math.floor(D);
  const T = (D0 - 0) / 36525.0;
  const GMST = 280.46061837 + 360.98564736629 * D + 0.000387933 * T * T - (T * T * T) / 38710000;
  return normalizeDegrees(GMST);
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
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  return toDegrees(alt);
}

function computeVisibilityWindow(t: Target, lat: number, lon: number, atIso?: string, minAlt = 10) {
  const date = atIso ? new Date(atIso) : new Date();
  let times = SunCalc.getTimes(date, lat, lon) as any;
  // Prefer astronomical night, fall back to sunset/sunrise if needed
  const start = (times.night as Date) || (times.dusk as Date) || (times.sunset as Date);
  const end = (times.nightEnd as Date) || (times.dawn as Date) || (times.sunrise as Date);
  if (!start || !end || !(start instanceof Date) || !(end instanceof Date) || start >= end) {
    return null;
  }

  const raH = parseHmsToHours(t.ra_hms);
  const decD = parseDmsToDegrees(t.dec_dms);

  const stepMinutes = 20; // sampling step
  let maxAlt = -90;
  let maxAltTime: Date | null = null;
  let firstVisible: Date | null = null;
  let lastVisible: Date | null = null;
  for (let ms = start.getTime(); ms <= end.getTime(); ms += stepMinutes * 60 * 1000) {
    const d = new Date(ms);
    const alt = altitudeDegreesAt(d, lat, lon, raH, decD);
    if (alt > maxAlt) {
      maxAlt = alt;
      maxAltTime = d;
    }
    if (alt >= minAlt) {
      if (!firstVisible) firstVisible = d;
      lastVisible = d;
    }
  }

  if (!firstVisible || !lastVisible) {
    return null;
  }
  return {
    start_utc: firstVisible.toISOString(),
    end_utc: new Date(lastVisible.getTime() + stepMinutes * 60 * 1000).toISOString(),
    alt_max_deg: Number(maxAlt.toFixed(1)),
  } as { start_utc: string; end_utc: string; alt_max_deg: number };
}

async function fetchOpenNgcTargets(maxItems = 800, maxMag = 12): Promise<Target[]> {
  const url = process.env.NEXT_PUBLIC_OPENNGC_URL || "https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/NGC.csv";
  try {
    const resp = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
    if (!resp.ok) throw new Error(`OpenNGC fetch failed ${resp.status}`);
    const text = await resp.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const header = lines[0].split(",").map((h) => h.trim());
    const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    const idxLike = (names: string[]) => header.findIndex((h) => names.map((n) => n.toLowerCase()).includes(h.toLowerCase()));
    const iName = idxLike(["Name", "Object", "ID", "NGC"]);
    const iType = idx("Type");
    const iRA = idxLike(["RA", "RAJ2000", "raj2000"]);
    const iDec = idxLike(["Dec", "DEJ2000", "decj2000"]);
    const iMaj = idxLike(["MajAx", "MajAxis", "MajorAxis", "Size", "Dim"]);
    const iMag = idxLike(["Mag", "Vmag", "Bmag", "magV"]);

    const parseNum = (v: string) => {
      const n = Number(v.replace(/[^0-9.+\-]/g, ""));
      return Number.isFinite(n) ? n : NaN;
    };
    const toHms = (ra: string): string => {
      if (!ra) return "00:00:00";
      if (ra.includes(":")) return ra.replace(/\s/g, ":");
      const hours = Number(ra);
      if (!Number.isFinite(hours)) return "00:00:00";
      const h = Math.floor(hours);
      const m = Math.floor((hours - h) * 60);
      const s = Math.round(((hours - h) * 60 - m) * 60);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };
    const toDms = (dec: string): string => {
      if (!dec) return "+00:00:00";
      if (dec.includes(":")) return dec.replace(/\s/g, ":");
      const deg = Number(dec);
      if (!Number.isFinite(deg)) return "+00:00:00";
      const sign = deg < 0 ? -1 : 1;
      const a = Math.abs(deg);
      const d = Math.floor(a);
      const m = Math.floor((a - d) * 60);
      const s = Math.round(((a - d) * 60 - m) * 60);
      return `${sign < 0 ? "-" : "+"}${String(d).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };
    const mapType = (t: string): string => {
      const s = (t || "").toLowerCase();
      if (/(gal|gx)/.test(s)) return "galaxy";
      if (/(neb|pn|sfr|emission|dark)/.test(s)) return "nebula";
      if (/(oc|gc|cluster)/.test(s)) return "cluster";
      return t || "object";
    };

    const result: Target[] = [];
    for (let li = 1; li < lines.length && result.length < maxItems; li++) {
      const row = lines[li].split(/,(?=(?:[^\"][^\"]*\")[^\"]*$)/).map((v) => v.replace(/^\"|\"$/g, "").trim());
      const name = row[iName] || row[0];
      const type = mapType(row[iType] || "");
      const ra = row[iRA];
      const dec = row[iDec];
      if (!name || !ra || !dec) continue;
      const maj = iMaj >= 0 ? parseNum(row[iMaj]) : NaN; // arcmin
      const mag = iMag >= 0 ? parseNum(row[iMag]) : NaN;
      if (Number.isFinite(mag) && mag > maxMag) continue; // skip faint
      const sizeDeg = Number.isFinite(maj) ? maj / 60 : 0.5; // default 0.5° if unknown
      result.push({
        id: name,
        name,
        type,
        ra_hms: toHms(ra),
        dec_dms: toDms(dec),
        size_deg: Number(sizeDeg.toFixed(2)),
      });
    }
    return result;
  } catch {
    return [];
  }
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
  
  // Prevent division by zero
  if (fovShortDeg <= 0) {
    return NextResponse.json(
      { error: "Invalid field of view calculated. Please check sensor and focal length values." },
      { status: 400 }
    );
  }

  const currentMonth = monthFromIso(p.date);

  // Merge local curated targets with a dynamic OpenNGC subset (cached by Vercel for a day)
  const dynamicTargets: Target[] = await fetchOpenNgcTargets(undefined as any, (p as any).maxMag ?? 12).catch(() => []);
  // Merge with preference for curated local targets when IDs collide
  const normalizeKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const byKey = new Map<string, Target>();
  for (const t of dynamicTargets) {
    byKey.set(normalizeKey(t.id || t.name), t);
  }
  for (const t of (localTargets as unknown as Target[])) {
    byKey.set(normalizeKey(t.id || t.name), t); // override with curated (has images/descriptions)
  }
  const sourceTargets: Target[] = Array.from(byKey.values());

  const items = (sourceTargets as Target[]).map((t) => {
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

    const window = computeVisibilityWindow(t, p.lat, p.lon, p.date, (p as any).minAlt ?? 20);

    return {
      id: t.id,
      name: t.name,
      type: t.type,
      fill_ratio: Number(fillRatio.toFixed(3)),
      framing_score: Number(framingScore.toFixed(3)),
      score: Number((baseScore + (window ? 0.1 : 0)).toFixed(3)),
      suggested_capture: suggested,
      image_url: t.image_url,
      description: t.description,
      window: window ?? undefined,
    };
  });

  let recommended = items
    .filter((i) => i.framing_score > 0.15)
    .filter((i) => i.window)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  // Fallback: if nothing is visible by current thresholds, show best framing regardless of window
  if (recommended.length === 0) {
    recommended = items
      .filter((i) => i.framing_score > 0.15)
      .sort((a, b) => b.framing_score - a.framing_score)
      .slice(0, 10);
  }

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

