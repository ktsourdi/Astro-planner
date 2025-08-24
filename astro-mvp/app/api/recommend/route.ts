import { NextRequest } from 'next/server';
import { z } from 'zod';
import targets from '../../../data/targets.json';
import { parseRA, parseDec, altAz, moonInfo, isAstronomicalNight } from '../../../lib/astro';
import { pixelScaleArcsecPerPx, fovDeg, fillRatio, framingScore, npfSeconds } from '../../../lib/framing';
import { clamp, addHours, isoHour } from '../../../lib/util';
import { getHourlyWeather } from '../../../lib/weather';
import { scoreWindow } from '../../../lib/scoring';

const schema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  date: z.string().datetime().optional(),
  days: z.coerce.number().int().min(1).max(14).optional(),
  sensorW: z.coerce.number().positive(),
  sensorH: z.coerce.number().positive(),
  pixelUm: z.coerce.number().positive(),
  focalMm: z.coerce.number().positive(),
  fNum: z.coerce.number().positive(),
  mount: z.enum(['fixed', 'tracker', 'guided'])
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const query = Object.fromEntries(url.searchParams.entries());
    const parsed = schema.safeParse(query);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.message }), { status: 400 });
    }
    const { lat, lon, date, days = 7, sensorW, sensorH, pixelUm, focalMm, fNum, mount } = parsed.data;

    const start = date ? new Date(date) : new Date();
    const end = addHours(start, Math.min(days * 24, 72));
    const weatherMap = await getHourlyWeather(lat, lon, start.toISOString(), end.toISOString());

    const fov = fovDeg({ w: sensorW, h: sensorH }, focalMm);
    const arcsecPerPx = pixelScaleArcsecPerPx(pixelUm, focalMm);

    const results: any[] = [];
    const filteredOut: any[] = [];

    for (const t of targets as any[]) {
      const fr = fillRatio(t.size_deg, fov);
      const frScore = framingScore(fr);

      if (fr < 0.2 || fr > 0.9) {
        filteredOut.push({ id: t.id, reason: fr < 0.2 ? `Too small for your FOV (fill_ratio=${fr.toFixed(2)}). Try longer focal length.` : `Too large for your FOV (fill_ratio=${fr.toFixed(2)}). Consider a shorter focal or mosaic.` });
        continue;
      }

      const raHours = parseRA(t.ra_hms);
      const decDeg = parseDec(t.dec_dms);

      let bestSlot: any = null;
      for (let h = 0; h <= Math.min(days * 24, 72); h++) {
        const time = addHours(start, h);
        if (!isAstronomicalNight(time, lat, lon)) continue;
        const { altDeg } = altAz(time, lat, lon, raHours, decDeg);
        const { phase, altDeg: moonAltDeg } = moonInfo(time, lat, lon);
        const cloudPct = weatherMap.get(isoHour(time)) ?? 50;
        const s = scoreWindow({ altDeg, cloudPct, moonPhase: phase, moonAltDeg, framing: frScore });
        if (!bestSlot || s > bestSlot.score) {
          bestSlot = { time, altDeg, score: s, cloudPct, moonPhase: phase, moonAltDeg };
        }
      }

      if (!bestSlot) continue;

      const baseExposure = npfSeconds(fNum, pixelUm, focalMm, decDeg);
      let cap = baseExposure;
      if (mount === 'tracker') cap *= 3;
      if (mount === 'guided') cap = Math.min(300, cap * 10);
      const subExposure = clamp(cap, 10, 300);
      const gain = 110;
      const subs = Math.max(1, Math.round((90 * 60) / subExposure));

      results.push({
        id: t.id,
        name: t.name,
        type: t.type,
        fill_ratio: Number(fr.toFixed(2)),
        framing_score: Number(frScore.toFixed(2)),
        window: { start_utc: bestSlot.time.toISOString(), end_utc: addHours(bestSlot.time, 1).toISOString(), alt_max_deg: Number(bestSlot.altDeg.toFixed(1)) },
        score: Number(bestSlot.score.toFixed(2)),
        suggested_capture: { sub_exposure_s: Math.round(subExposure), gain, subs, notes: 'Default 90 min total. Adjust for sky brightness and target.' }
      });
    }

    results.sort((a, b) => b.score - a.score);

    const body = {
      setup: { fov_deg: { w: Number(fov.w.toFixed(2)), h: Number(fov.h.toFixed(2)) }, arcsec_per_px: Number(arcsecPerPx.toFixed(2)) },
      recommended_targets: results.slice(0, 8),
      filtered_out_examples: filteredOut.slice(0, 3)
    };

    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Internal error' }), { status: 500 });
  }
}