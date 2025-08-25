import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import targets from "@/data/targets.json";
import SunCalc from "suncalc";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  targetId: z.string().min(1),
  date: z.string().datetime().optional(),
  sensorW: z.coerce.number().positive().optional(),
  sensorH: z.coerce.number().positive().optional(),
  focalMm: z.coerce.number().positive().optional(),
  mount: z.enum(["fixed", "tracker", "guided"]).optional(),
});

type Target = typeof targets[0];

function parseHmsToHours(hms: string): number {
  const [h, m, s] = hms.split(":").map(Number);
  return (h || 0) + (m || 0) / 60 + (s || 0) / 3600;
}

function parseDmsToDegrees(dms: string): number {
  const sign = dms.trim().startsWith("-") ? -1 : 1;
  const clean = dms.replace(/[+\-]/, "");
  const [d, m, s] = clean.split(":").map(Number);
  return sign * ((d || 0) + (m || 0) / 60 + (s || 0) / 3600);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(params);
  
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  
  const p = parsed.data;
  
  // Find the target
  const target = targets.find(t => t.id === p.targetId);
  if (!target) {
    return NextResponse.json(
      { error: `Target not found: ${p.targetId}` },
      { status: 404 }
    );
  }
  
  const date = p.date ? new Date(p.date) : new Date();
  const raHours = parseHmsToHours(target.ra_hms);
  const decDeg = parseDmsToDegrees(target.dec_dms);
  
  // Calculate sun and moon information
  const sunTimes = SunCalc.getTimes(date, p.lat, p.lon);
  const moonPhase = SunCalc.getMoonIllumination(date);
  const moonPosition = SunCalc.getMoonPosition(date, p.lat, p.lon);
  
  // Calculate recommended capture settings based on mount type
  const mountSettings = {
    fixed: {
      exposureTime: 10,
      numberOfSubs: 100,
      gain: 100,
      totalIntegration: "16.7 minutes",
      notes: "Fixed mount: Use short exposures to avoid star trails. Stack many frames for better SNR."
    },
    tracker: {
      exposureTime: 60,
      numberOfSubs: 60,
      gain: 100,
      totalIntegration: "60 minutes",
      notes: "Star tracker: Medium exposures possible. Ensure good polar alignment."
    },
    guided: {
      exposureTime: 180,
      numberOfSubs: 30,
      gain: 100,
      totalIntegration: "90 minutes",
      notes: "Guided mount: Long exposures for best results. Monitor guiding performance."
    }
  };
  
  const mount = p.mount || "tracker";
  const settings = mountSettings[mount as keyof typeof mountSettings];
  
  // Calculate field of view if equipment specs provided
  let fieldOfView = null;
  if (p.sensorW && p.sensorH && p.focalMm) {
    const fovWidth = 2 * Math.atan((p.sensorW / 2) / p.focalMm) * 180 / Math.PI;
    const fovHeight = 2 * Math.atan((p.sensorH / 2) / p.focalMm) * 180 / Math.PI;
    fieldOfView = {
      width: Number(fovWidth.toFixed(2)),
      height: Number(fovHeight.toFixed(2)),
      diagonal: Number(Math.sqrt(fovWidth ** 2 + fovHeight ** 2).toFixed(2)),
      targetCoverage: Number((target.size_deg / Math.min(fovWidth, fovHeight) * 100).toFixed(1))
    };
  }
  
  const payload = {
    target: {
      id: target.id,
      name: target.name,
      type: target.type,
      coordinates: {
        ra: target.ra_hms,
        dec: target.dec_dms,
        raHours: Number(raHours.toFixed(3)),
        decDegrees: Number(decDeg.toFixed(3))
      },
      size: target.size_deg,
      bestMonths: target.best_months || [],
      description: target.description || "Deep sky object suitable for astrophotography",
      imageUrl: target.image_url
    },
    location: {
      latitude: p.lat,
      longitude: p.lon
    },
    datetime: date.toISOString(),
    conditions: {
      moon: {
        illumination: Math.round(moonPhase.fraction * 100),
        phase: moonPhase.phase,
        altitude: Number((moonPosition.altitude * 180 / Math.PI).toFixed(1))
      },
      astronomicalTwilight: {
        start: (sunTimes.nightEnd || sunTimes.sunrise).toISOString(),
        end: (sunTimes.night || sunTimes.sunset).toISOString()
      },
      darkness: {
        nauticalStart: sunTimes.nauticalDusk?.toISOString(),
        nauticalEnd: sunTimes.nauticalDawn?.toISOString(),
        civilStart: sunTimes.dusk?.toISOString(),
        civilEnd: sunTimes.dawn?.toISOString()
      }
    },
    recommendations: {
      mount: mount,
      exposureTime: settings.exposureTime,
      numberOfSubs: settings.numberOfSubs,
      gain: settings.gain,
      totalIntegration: settings.totalIntegration,
      notes: settings.notes,
      filters: target.type === "nebula" ? "Consider using narrowband filters (Ha, OIII, SII)" : "Use LRGB filters for color imaging"
    },
    fieldOfView: fieldOfView,
    warnings: [
      moonPhase.fraction > 0.5 ? `High moon illumination (${Math.round(moonPhase.fraction * 100)}%) may affect imaging` : null,
      moonPhase.fraction > 0.3 && target.type === "galaxy" ? "Moon brightness may impact galaxy imaging" : null,
      !target.best_months?.includes(new Date().getMonth() + 1) ? "Not in optimal viewing season for this target" : null,
      fieldOfView && fieldOfView.targetCoverage < 10 ? "Target very small in field of view - consider longer focal length" : null,
      fieldOfView && fieldOfView.targetCoverage > 80 ? "Target may overflow field of view - consider shorter focal length" : null
    ].filter(Boolean)
  };
  
  return NextResponse.json(payload, { status: 200 });
}