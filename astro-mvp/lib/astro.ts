import { toRadians, toDegrees } from './util';
import * as suncalc from 'suncalc';
import { sidereal } from 'astronomia';

export function parseRA(hms: string): number {
  const [h, m, s] = hms.split(':').map(Number);
  return (h + (m || 0) / 60 + (s || 0) / 3600);
}

export function parseDec(dms: string): number {
  const sign = dms.trim().startsWith('-') ? -1 : 1;
  const parts = dms.replace('+', '').replace('-', '').split(':').map(Number);
  const deg = parts[0] + (parts[1] || 0) / 60 + (parts[2] || 0) / 3600;
  return sign * deg;
}

export function lst(dateUTC: Date, lonDeg: number): number {
  const jd = sidereal.julianDay(dateUTC);
  const gmstRad = sidereal.apparent(jd);
  const gmstHours = (gmstRad * 12) / Math.PI; // rad -> hours
  const lstHours = (gmstHours + lonDeg / 15 + 24) % 24;
  return lstHours;
}

export function altAz(dateUTC: Date, latDeg: number, lonDeg: number, raHours: number, decDeg: number): { altDeg: number; azDeg: number } {
  const lstHours = lst(dateUTC, lonDeg);
  const haHours = (lstHours - raHours + 24) % 24;
  const ha = toRadians(haHours * 15);
  const lat = toRadians(latDeg);
  const dec = toRadians(decDeg);

  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

  const y = -Math.sin(ha) * Math.cos(dec);
  const x = Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(ha);
  const az = Math.atan2(y, x);

  return { altDeg: toDegrees(alt), azDeg: (toDegrees(az) + 360) % 360 };
}

export function isAstronomicalNight(dateUTC: Date, lat: number, lon: number): boolean {
  const times = suncalc.getTimes(dateUTC, lat, lon);
  const start = times.night as Date | undefined;
  const end = times.nightEnd as Date | undefined;
  if (!start || !end) return false;
  return dateUTC >= start && dateUTC <= end;
}

export function moonInfo(dateUTC: Date, lat: number, lon: number): { phase: number; altDeg: number } {
  const illum = suncalc.getMoonIllumination(dateUTC);
  const pos = suncalc.getMoonPosition(dateUTC, lat, lon);
  return { phase: illum.phase, altDeg: toDegrees(pos.alt) };
}