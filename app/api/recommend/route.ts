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
  // How many recommendations to return (after filtering and sorting)
  limit: z.coerce.number().min(1).max(1000).default(200).optional(),
  // How many OpenNGC rows to scan (performance lever)
  openNgcMax: z.coerce.number().min(100).max(10000).default(3000).optional(),
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

function localMonthAtLongitude(dateIso: string | undefined, lonDeg: number): number {
  // Approximate local time from longitude: 4 minutes per degree eastwards
  const base = dateIso ? new Date(dateIso) : new Date();
  const offsetMinutes = lonDeg * 4; // can be fractional
  const localMs = base.getTime() + offsetMinutes * 60 * 1000;
  const local = new Date(localMs);
  return local.getUTCMonth() + 1; // 1..12
}

function rotateMonthsForSouthernHemisphere(months: number[] | undefined, latDeg: number): number[] | undefined {
  if (!months || months.length === 0) return months;
  if (latDeg >= 0) return months;
  // Rotate by +6 months for southern hemisphere season flip
  return months.map((m) => ((m + 5) % 12) + 1);
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
  // Meeus approximation (accurate GMST with centuries since J2000)
  const JD = date.getTime() / 86400000 + 2440587.5; // Julian Day
  const D = JD - 2451545.0; // Days since J2000.0
  const T = D / 36525.0; // Julian centuries since J2000.0
  const GMST = 280.46061837 + 360.98564736629 * D + 0.000387933 * (T * T) - (T * T * T) / 38710000;
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
  const base = atIso ? new Date(atIso) : new Date();
  // Anchor SunCalc to approximate local civil date based on longitude (4 min/deg)
  const offsetMinutes = lon * 4;
  const localMs = base.getTime() + offsetMinutes * 60 * 1000;
  const localDate = new Date(localMs);
  const times0 = SunCalc.getTimes(localDate, lat, lon) as any;
  const times1 = SunCalc.getTimes(new Date(localDate.getTime() + 24 * 3600000), lat, lon) as any;
  // Use evening twilight start from the given local date, and morning twilight end from the next local date
  const start = (times0.night as Date) || (times0.dusk as Date) || (times0.sunset as Date);
  const end = (times1.nightEnd as Date) || (times1.dawn as Date) || (times1.sunrise as Date);
  if (!start || !end || !(start instanceof Date) || !(end instanceof Date) || start >= end) {
    return null;
  }

  const raH = parseHmsToHours(t.ra_hms);
  const decD = parseDmsToDegrees(t.dec_dms);

  const stepMinutes = 10; // finer sampling for more accurate windows
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

async function fetchOpenNgcTargets(maxItems = 3000, maxMag = 12): Promise<Target[]> {
  const url = "https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/NGC.csv";
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
      if (/(pn|planetary)/.test(s)) return "Planetary Nebula";
      if (/(reflection|rneb|ref)/.test(s)) return "Reflection Nebula";
      if (/(dark neb|\bdn\b|barnard)/.test(s)) return "Dark Nebula";
      if (/(snr|supernova remnant)/.test(s)) return "Supernova Remnant";
      if (/(\boc\b|open cluster)/.test(s)) return "Open Cluster";
      if (/(\bgc\b|globular)/.test(s)) return "Globular Cluster";
      if (/(group of galaxies|galaxy group|grg)/.test(s)) return "Group of Galaxies";
      if (/(galaxy cluster|cluster of galaxies|\bcl\b)/.test(s)) return "Galaxy Cluster";
      if (/(emission|hii|sfr)/.test(s)) return "Emission Nebula";
      if (/\bneb\b/.test(s)) return "Emission Nebula";
      if (/(gal|gx|\bg\b)/.test(s)) return "Galaxy";
      if (/supernova/.test(s)) return "Supernova";
      if (/cluster/.test(s)) return "Open Cluster";
      if (/nebula/.test(s)) return "Emission Nebula";
      return t || "Object";
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
  const t0 = Date.now();
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
  const minAlt = (p.minAlt ?? 10) as number;

  const fovWidthDeg = degreesFromSensorAndFocal(p.sensorW, p.focalMm);
  const fovHeightDeg = degreesFromSensorAndFocal(p.sensorH, p.focalMm);
  const fovShortDeg = Math.min(fovWidthDeg, fovHeightDeg);

  // Use month based on local time at observer longitude (approximation)
  const currentMonth = localMonthAtLongitude(p.date, p.lon);

  // Compute night duration once per request for visibility scoring
  const baseDateIso = p.date ?? new Date().toISOString();
  const sunTimes = SunCalc.getTimes(new Date(baseDateIso), p.lat, p.lon) as any;
  const nightStart = (sunTimes.night as Date) || (sunTimes.dusk as Date) || (sunTimes.sunset as Date);
  const nightEnd = (sunTimes.nightEnd as Date) || (sunTimes.dawn as Date) || (sunTimes.sunrise as Date);
  const nightHours = nightStart && nightEnd && nightEnd > nightStart ? (nightEnd.getTime() - nightStart.getTime()) / 3600000 : null;

  // Merge local curated targets with a dynamic OpenNGC subset (cached by Vercel for a day)
  const dynamicTargets: Target[] = await fetchOpenNgcTargets((p as any).openNgcMax ?? 3000, (p as any).maxMag ?? 12).catch(() => []);
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
    const effectiveBestMonths = rotateMonthsForSouthernHemisphere(t.best_months, p.lat);
    const monthFactor = effectiveBestMonths?.includes(currentMonth) ? 1 : 0;

    // very rough exposure heuristics by mount
    const mountSubExposure = p.mount === "guided" ? 180 : p.mount === "tracker" ? 60 : 10;
    const suggested = {
      sub_exposure_s: mountSubExposure,
      gain: 100,
      subs: 50,
      notes: p.mount === "guided" ? "Guided mount: longer subs OK" : p.mount === "tracker" ? "Tracker: moderate subs recommended" : "Fixed mount: keep subs short",
    };

    // Early prune: if object cannot physically reach the required altitude at transit, skip expensive sampling
    const decDQuick = parseDmsToDegrees(t.dec_dms);
    const maxTransitAlt = 90 - Math.abs(p.lat - decDQuick);
    const window = maxTransitAlt >= minAlt ? computeVisibilityWindow(t, p.lat, p.lon, p.date, minAlt) : null;

    // Visibility scoring prioritizes duration above minAlt and peak altitude
    let visibilityScore = 0;
    let visibleHours = 0;
    if (window) {
      const startMs = new Date(window.start_utc).getTime();
      const endMs = new Date(window.end_utc).getTime();
      visibleHours = Math.max(0, (endMs - startMs) / 3600000);
      const durationFactor = nightHours ? Math.min(1, Math.max(0, visibleHours / nightHours)) : Math.min(1, visibleHours / 8);
      const altitudeFactor = Math.min(1, Math.max(0, window.alt_max_deg / 80));
      visibilityScore = Number((0.6 * durationFactor + 0.4 * altitudeFactor).toFixed(3));
    }

    const finalScore = Number((0.7 * visibilityScore + 0.2 * framingScore + 0.1 * monthFactor).toFixed(3));

    return {
      id: t.id,
      name: t.name,
      type: t.type,
      ra_hms: t.ra_hms,
      dec_dms: t.dec_dms,
      fill_ratio: Number(fillRatio.toFixed(3)),
      framing_score: Number(framingScore.toFixed(3)),
      visibility_score: visibilityScore,
      visible_hours: Number(visibleHours.toFixed(2)),
      score: finalScore,
      suggested_capture: suggested,
      image_url: t.image_url,
      description: t.description,
      window: window ?? undefined,
    };
  });

  const limit = Math.min(Math.max(Number((p as any).limit ?? 200), 1), 1000);
  const recommended = items
    .filter((i) => i.window)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const t1 = Date.now();
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
      time_basis: "local_from_longitude",
      hemisphere: p.lat < 0 ? "southern" : "northern",
      minAlt,
    },
    debug: {
      night_start_utc: nightStart ? new Date(nightStart).toISOString() : null,
      night_end_utc: nightEnd ? new Date(nightEnd).toISOString() : null,
    },
    recommended_targets: recommended,
    metrics: {
      source_count: sourceTargets.length,
      visible_count: recommended.length,
      compute_ms: t1 - t0,
    },
    filtered_out_examples: items
      .filter((i) => i.framing_score <= 0.15)
      .slice(0, 3),
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      // Cache on the edge for 5 minutes; safe because the response varies by the full query string
      "Cache-Control": "s-maxage=300, stale-while-revalidate=60",
    },
  });
}

