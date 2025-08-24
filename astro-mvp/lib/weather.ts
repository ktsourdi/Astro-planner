import { formatYMD, isoHour } from './util';

export async function getHourlyWeather(lat: number, lon: number, startISO: string, endISO: string): Promise<Map<string, number>> {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('hourly', 'cloudcover,relative_humidity_2m,windspeed_10m,visibility');
  url.searchParams.set('start_date', formatYMD(start));
  url.searchParams.set('end_date', formatYMD(end));

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const data = await res.json();

  const times: string[] = data?.hourly?.time || [];
  const clouds: number[] = data?.hourly?.cloudcover || [];
  const map = new Map<string, number>();
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]);
    map.set(isoHour(t), clouds[i] ?? 0);
  }
  return map;
}