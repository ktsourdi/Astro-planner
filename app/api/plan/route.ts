import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import SunCalc from "suncalc";
import targets from "@/data/targets.json";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  targetId: z.string().min(1),
  date: z.string().datetime().optional(),
  mount: z.enum(["fixed", "tracker", "guided"]).default("tracker").optional(),
  minAlt: z.coerce.number().min(0).max(89).default(10).optional(),
  export: z.enum(["json", "csv"]).default("json").optional(),
  subExposureS: z.coerce.number().positive().optional(),
  gain: z.coerce.number().nonnegative().optional(),
  subs: z.coerce.number().positive().optional(),
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

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
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

function computeVisibilityWindow(
  t: Target,
  lat: number,
  lon: number,
  atIso?: string,
  minAlt = 10
): {
  start_utc: string;
  end_utc: string;
  alt_max_deg: number;
  transit_utc: string;
} | null {
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

  if (!firstVisible || !lastVisible || !maxAltTime) return null;
  return {
    start_utc: firstVisible.toISOString(),
    end_utc: new Date(lastVisible.getTime() + stepMinutes * 60 * 1000).toISOString(),
    alt_max_deg: Number(maxAlt.toFixed(1)),
    transit_utc: maxAltTime.toISOString(),
  };
}

function computeSubExposureSeconds(mount: "fixed" | "tracker" | "guided"): number {
  if (mount === "guided") return 180;
  if (mount === "tracker") return 60;
  return 10;
}

// Minutes reserved before capture start for mount/tripod setup and alignment.
const SETUP_LEAD_MINUTES = 20;
// Minutes reserved immediately before capture for focus and framing checks.
const FOCUS_LEAD_MINUTES = 10;
const MOUNT_EFFICIENCY: Record<"fixed" | "tracker" | "guided", number> = {
  fixed: 0.8,
  tracker: 0.85,
  guided: 0.9,
};

function localMonthAtLongitude(dateIso: string | undefined, lonDeg: number): number {
  const base = dateIso ? new Date(dateIso) : new Date();
  const offsetMinutes = lonDeg * 4;
  const localMs = base.getTime() + offsetMinutes * 60 * 1000;
  return new Date(localMs).getUTCMonth() + 1;
}

function rotateMonthsForSouthernHemisphere(months: number[] | undefined, latDeg: number): number[] | undefined {
  if (!months || months.length === 0) return months;
  if (latDeg >= 0) return months;
  return months.map((m) => ((m + 5) % 12) + 1);
}

function buildPlanCsv(payload: any): string {
  const csvSafe = (value: unknown) => {
    const raw = String(value ?? "").replace(/\t/g, " ");
    const escaped = raw.replace(/"/g, '""');
    // Prefix potential spreadsheet formulas to reduce CSV formula injection risk.
    const formulaSafe = /^[=\-+@]/.test(escaped) ? `'${escaped}` : escaped;
    return `"${formulaSafe}"`;
  };
  const lines: string[] = [];
  lines.push("section,key,value");
  lines.push(`meta,target_id,${csvSafe(payload.target.id)}`);
  lines.push(`meta,target_name,${csvSafe(payload.target.name)}`);
  lines.push(`meta,at_utc,${csvSafe(payload.atUtc)}`);
  lines.push(`meta,lat,${csvSafe(payload.location.lat)}`);
  lines.push(`meta,lon,${csvSafe(payload.location.lon)}`);
  lines.push(`setup,mount,${csvSafe(payload.setup.mount)}`);
  lines.push(`setup,min_alt_deg,${csvSafe(payload.setup.min_alt_deg)}`);
  lines.push(`setup,sub_exposure_s,${csvSafe(payload.setup.exposure.sub_exposure_s)}`);
  lines.push(`setup,gain,${csvSafe(payload.setup.exposure.gain)}`);
  lines.push(`setup,subs,${csvSafe(payload.setup.exposure.subs)}`);
  lines.push(`score,visibility,${csvSafe(payload.score_context.visibility)}`);
  lines.push(`score,season,${csvSafe(payload.score_context.season)}`);
  lines.push(`score,combined,${csvSafe(payload.score_context.combined)}`);
  lines.push(`window,start_utc,${csvSafe(payload.visibility_window.start_utc)}`);
  lines.push(`window,end_utc,${csvSafe(payload.visibility_window.end_utc)}`);
  lines.push(`window,alt_max_deg,${csvSafe(payload.visibility_window.alt_max_deg)}`);
  lines.push(`window,transit_utc,${csvSafe(payload.visibility_window.transit_utc)}`);
  lines.push("");
  lines.push("capture_blocks,target_id,target_name,start_utc,end_utc,sub_exposure_s,estimated_subs,requires_meridian_flip");
  for (const b of payload.capture_blocks) {
    lines.push(
      `${csvSafe(b.target_id)},${csvSafe(b.target_name)},${csvSafe(b.start_utc)},${csvSafe(b.end_utc)},${csvSafe(
        b.sub_exposure_s
      )},${csvSafe(b.estimated_subs)},${csvSafe(b.requires_meridian_flip)}`
    );
  }
  lines.push("");
  lines.push("timeline,type,time_utc,note");
  for (const t of payload.timeline) {
    lines.push(`${csvSafe(t.type)},${csvSafe(t.time_utc)},${csvSafe(t.note)}`);
  }
  return `${lines.join("\n")}\n`;
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters", issues: parsed.error.flatten() }, { status: 400 });
  }

  const p = parsed.data;
  const mount = p.mount ?? "tracker";
  const minAlt = p.minAlt ?? 10;
  const exportMode = p.export ?? "json";
  const allTargets = targets as Target[];
  const key = normalize(p.targetId);
  const target =
    allTargets.find((t) => normalize(t.id) === key) ??
    allTargets.find((t) => normalize(t.name) === key);

  if (!target) {
    return NextResponse.json({ error: `Target not found: ${p.targetId}` }, { status: 404 });
  }

  const atUtc = p.date ?? new Date().toISOString();
  const window = computeVisibilityWindow(target, p.lat, p.lon, atUtc, minAlt);
  if (!window) {
    return NextResponse.json(
      {
        targetId: target.id,
        targetName: target.name,
        atUtc,
        location: { lat: p.lat, lon: p.lon },
        error: "Target is not visible above minimum altitude during the selected night.",
      },
      { status: 200 }
    );
  }

  const preCaptureStart = new Date(new Date(window.start_utc).getTime() - (SETUP_LEAD_MINUTES + FOCUS_LEAD_MINUTES) * 60 * 1000);
  const visibleStart = new Date(window.start_utc);
  const visibleEnd = new Date(window.end_utc);
  const transit = new Date(window.transit_utc);
  const subExposureS = computeSubExposureSeconds(mount);
  const efficiency = MOUNT_EFFICIENCY[mount];
  const visibleSeconds = Math.max(0, (visibleEnd.getTime() - visibleStart.getTime()) / 1000);
  const computedSubExposureS = p.subExposureS ?? subExposureS;
  const estimatedSubsTotal = Math.max(1, Math.floor((visibleSeconds * efficiency) / computedSubExposureS));
  const hasFlip = mount !== "fixed" && transit > visibleStart && transit < visibleEnd;
  const flipDowntimeMin = hasFlip ? 10 : 0;
  const usableCaptureSeconds = Math.max(0, visibleSeconds - flipDowntimeMin * 60);
  const estimatedSubsAdjusted = Math.max(1, Math.floor((usableCaptureSeconds * efficiency) / computedSubExposureS));

  const captureBlocks: Array<{
    target_id: string;
    target_name: string;
    start_utc: string;
    end_utc: string;
    sub_exposure_s: number;
    estimated_subs: number;
    requires_meridian_flip: boolean;
  }> = [];

  if (hasFlip) {
    const flipStart = new Date(transit.getTime() - 5 * 60 * 1000);
    const flipEnd = new Date(transit.getTime() + 5 * 60 * 1000);
    const firstSeconds = Math.max(0, (flipStart.getTime() - visibleStart.getTime()) / 1000);
    const secondSeconds = Math.max(0, (visibleEnd.getTime() - flipEnd.getTime()) / 1000);
    const total = Math.max(1, firstSeconds + secondSeconds);
    const firstSubs = Math.max(1, Math.floor((estimatedSubsAdjusted * firstSeconds) / total));
    const secondSubs = Math.max(1, estimatedSubsAdjusted - firstSubs);
    captureBlocks.push({
      target_id: target.id,
      target_name: target.name,
      start_utc: visibleStart.toISOString(),
      end_utc: flipStart.toISOString(),
      sub_exposure_s: computedSubExposureS,
      estimated_subs: firstSubs,
      requires_meridian_flip: true,
    });
    captureBlocks.push({
      target_id: target.id,
      target_name: target.name,
      start_utc: flipEnd.toISOString(),
      end_utc: visibleEnd.toISOString(),
      sub_exposure_s: computedSubExposureS,
      estimated_subs: secondSubs,
      requires_meridian_flip: true,
    });
  } else {
    captureBlocks.push({
      target_id: target.id,
      target_name: target.name,
      start_utc: visibleStart.toISOString(),
      end_utc: visibleEnd.toISOString(),
      sub_exposure_s: computedSubExposureS,
      estimated_subs: estimatedSubsAdjusted,
      requires_meridian_flip: false,
    });
  }

  const timeline = [
    {
      type: "setup",
      time_utc: preCaptureStart.toISOString(),
      note: "Set up tripod/mount, polar align, and connect capture software.",
    },
    {
      type: "focus_and_framing",
      time_utc: new Date(visibleStart.getTime() - FOCUS_LEAD_MINUTES * 60 * 1000).toISOString(),
      note: `Slew to ${target.name}, focus, and frame before capture window starts.`,
    },
    {
      type: "capture_start",
      time_utc: visibleStart.toISOString(),
      note: `Start capture sequence (${computedSubExposureS}s subs).`,
    },
    ...(hasFlip
      ? [
          {
            type: "meridian_flip",
            time_utc: transit.toISOString(),
            note: "Perform meridian flip and re-center target.",
          },
        ]
      : []),
    {
      type: "capture_stop",
      time_utc: visibleEnd.toISOString(),
      note: "Stop capture for this target window.",
    },
  ];

  const currentMonth = localMonthAtLongitude(atUtc, p.lon);
  const effectiveBestMonths = rotateMonthsForSouthernHemisphere(target.best_months, p.lat);
  const seasonScore = effectiveBestMonths?.includes(currentMonth) ? 1 : 0;
  const visibilityScore = Math.min(1, Number((visibleSeconds / (8 * 3600)).toFixed(3)));
  const combinedScore = Number((0.7 * visibilityScore + 0.3 * seasonScore).toFixed(3));

  const payload = {
    target: {
      id: target.id,
      name: target.name,
      type: target.type,
      ra_hms: target.ra_hms,
      dec_dms: target.dec_dms,
    },
    atUtc,
    location: { lat: p.lat, lon: p.lon },
    setup: {
      mount,
      min_alt_deg: minAlt,
      exposure: {
        sub_exposure_s: computedSubExposureS,
        gain: p.gain ?? 100,
        subs: p.subs ?? estimatedSubsAdjusted,
      },
    },
    sequence: [target.id],
    visibility_window: window,
    score_context: {
      visibility: visibilityScore,
      season: seasonScore,
      combined: combinedScore,
    },
    capture_summary: {
      visible_hours: Number((visibleSeconds / 3600).toFixed(2)),
      sub_exposure_s: computedSubExposureS,
      estimated_subs_raw: estimatedSubsTotal,
      estimated_subs_planned: estimatedSubsAdjusted,
      meridian_flip_required: hasFlip,
    },
    capture_blocks: captureBlocks,
    timeline,
  };

  if (exportMode === "csv") {
    const csv = buildPlanCsv(payload);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="astro-plan-${target.id}.csv"`,
      },
    });
  }

  return NextResponse.json(payload, { status: 200 });
}
