"use client";
import { useEffect, useState } from 'react';
import targets from '../data/targets.json';

export default function SetupForm() {
  const [lat, setLat] = useState<string>('');
  const [lon, setLon] = useState<string>('');
  const [sensorW, setSensorW] = useState<string>('23.5');
  const [sensorH, setSensorH] = useState<string>('15.6');
  const [pixelUm, setPixelUm] = useState<string>('3.76');
  const [focalMm, setFocalMm] = useState<string>('200');
  const [fNum, setFNum] = useState<string>('2.8');
  const [mount, setMount] = useState<'fixed'|'tracker'|'guided'>('tracker');
  const [targetId, setTargetId] = useState<string>('');
  const [dateISO, setDateISO] = useState<string>('');

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLat(pos.coords.latitude.toFixed(4));
        setLon(pos.coords.longitude.toFixed(4));
      });
    }
    const now = new Date();
    setDateISO(new Date(now).toISOString());
  }, []);

  const params = new URLSearchParams({
    lat, lon, date: dateISO, sensorW, sensorH, pixelUm, focalMm, fNum, mount
  });

  function goRecommend() {
    window.location.href = `/recommend?${params.toString()}`;
  }

  async function planTarget() {
    if (!targetId) return;
    const qp = new URLSearchParams({ ...Object.fromEntries(params), targetId });
    const res = await fetch(`/api/plan?${qp.toString()}`);
    const data = await res.json();
    alert(JSON.stringify(data, null, 2));
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 16 }}>
      <h1>Astronomy Planner (MVP)</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label>Lat<input value={lat} onChange={e=>setLat(e.target.value)} placeholder="40.64"/></label>
        <label>Lon<input value={lon} onChange={e=>setLon(e.target.value)} placeholder="22.94"/></label>
        <label>Sensor W (mm)<input value={sensorW} onChange={e=>setSensorW(e.target.value)} /></label>
        <label>Sensor H (mm)<input value={sensorH} onChange={e=>setSensorH(e.target.value)} /></label>
        <label>Pixel size (µm)<input value={pixelUm} onChange={e=>setPixelUm(e.target.value)} /></label>
        <label>Focal (mm)<input value={focalMm} onChange={e=>setFocalMm(e.target.value)} /></label>
        <label>f-number<input value={fNum} onChange={e=>setFNum(e.target.value)} /></label>
        <label>Mount<select value={mount} onChange={e=>setMount(e.target.value as any)}>
          <option value="fixed">Fixed</option>
          <option value="tracker">Tracker</option>
          <option value="guided">Guided</option>
        </select></label>
        <label style={{ gridColumn: 'span 2' }}>Date ISO<input style={{ width: '100%' }} value={dateISO} onChange={e=>setDateISO(e.target.value)} /></label>
        <label style={{ gridColumn: 'span 2' }}>Target (optional)
          <select value={targetId} onChange={e=>setTargetId(e.target.value)} style={{ width: '100%' }}>
            <option value="">-- choose a target --</option>
            {(targets as any[]).map(t => <option key={t.id} value={t.id}>{t.id} — {t.name}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button onClick={goRecommend}>Recommend for me</button>
        <button onClick={planTarget} disabled={!targetId}>Plan this target</button>
      </div>
    </div>
  );
}