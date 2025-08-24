import { NextRequest } from 'next/server';
import { z } from 'zod';
import targets from '../../../data/targets.json';
import { parseRA, parseDec, altAz, isAstronomicalNight, moonInfo } from '../../../lib/astro';
import { pixelScaleArcsecPerPx, fovDeg, fillRatio, framingScore, npfSeconds } from '../../../lib/framing';
import { clamp, addHours, isoHour } from '../../../lib/util';
import { getHourlyWeather } from '../../../lib/weather';
import { scoreWindow } from '../../../lib/scoring';

const schema = z.object({
  targetId: z.string(),
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  date: z.string().datetime().optional(),
  days: z.coerce.number().int().min(1).max(7).optional(),
  sensorW: z.coerce.number().positive(),
  sensorH: z.coerce.number().positive(),
  pixelUm: z.coerce.number().positive(),
  focalMm: z.coerce.number().positive(),
  fNum: z.coerce.number().positive(),
  mount: z.enum(['fixed', 'tracker', 'guided']),
  gainHint: z.coerce.number().min(0).max(500).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const query = Object.fromEntries(url.searchParams.entries());
    const parsed = schema.safeParse(query);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.message }), { status: 400 });
    }
    const { targetId, lat, lon, date, sensorW, sensorH, pixelUm, focalMm, fNum, mount, gainHint } = parsed.data;

    const target = (targets as any[]).find(t => t.id === targetId);
    if (!target) {
      return new Response(JSON.stringify({ error: 'Target not found' }), { status: 400 });
    }

    const raHours = parseRA(target.ra_hms);
    const decDeg = parseDec(target.dec_dms);

    const fov = fovDeg({ w: sensorW, h: sensorH }, focalMm);
    const fr = fillRatio(target.size_deg, fov);
    const frScore = framingScore(fr);
    const arcsecPerPx = pixelScaleArcsecPerPx(pixelUm, focalMm);

    const start = date ? new Date(date) : new Date();
    const end = addHours(start, 8);

    const weatherMap = await getHourlyWeather(lat, lon, start.toISOString(), end.toISOString());

    const slots: any[] = [];
    for (let h = 0; h <= 8; h++) {
      const t = addHours(start, h);
      if (!isAstronomicalNight(t, lat, lon)) continue;
      const { altDeg } = altAz(t, lat, lon, raHours, decDeg);
      const { phase, altDeg: moonAltDeg } = moonInfo(t, lat, lon);
      const hourKey = isoHour(t);
      const cloudPct = weatherMap.get(hourKey) ?? 50;
      const score = scoreWindow({ altDeg, cloudPct, moonPhase: phase, moonAltDeg, framing: frScore });
      if (score >= 0.5 && altDeg > 0) {
        slots.push({ time_utc: t.toISOString(), alt_deg: altDeg, score, cloud_pct: cloudPct, moon_phase: phase, moon_alt_deg: moonAltDeg });
      }
    }

    slots.sort((a, b) => b.score - a.score);
    const best = slots.slice(0, 6);

    const baseExposure = npfSeconds(fNum, pixelUm, focalMm, decDeg);
    let cap = baseExposure;
    if (mount === 'tracker') cap *= 3;
    if (mount === 'guided') cap = Math.min(300, cap * 10);
    let exposure = clamp(cap, 10, 300);
    if (target.id === 'M42') exposure = Math.max(10, Math.min(exposure, 120));

    const gain = gainHint ?? 110;
    const subs = Math.max(1, Math.round((90 * 60) / exposure));

    const body = {
      target: { id: target.id, name: target.name, type: target.type, size_deg: target.size_deg },
      setup: {
        fov_deg: { w: Number(fov.w.toFixed(2)), h: Number(fov.h.toFixed(2)) },
        pixel_scale_arcsec_per_px: Number(arcsecPerPx.toFixed(2)),
        fill_ratio: Number(fr.toFixed(2)),
        framing_score: Number(frScore.toFixed(2)),
      },
      best_windows: best,
      suggested_capture: {
        exposure_s: Math.round(exposure),
        gain,
        subs,
        notes: mount === 'guided' ? 'Guided mount: consider 180–300s subs; adjust for sky brightness.' : 'If under bright skies (Bortle 7–8), use 30–60s and more subs.'
      }
    };

    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Internal error' }), { status: 500 });
  }
}