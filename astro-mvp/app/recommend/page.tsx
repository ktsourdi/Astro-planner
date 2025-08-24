"use client";
import { useEffect, useMemo, useState } from 'react';
import TargetCard from '../../components/TargetCard';

export default function RecommendPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useMemo(() => typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams(), []);

  useEffect(() => {
    async function run() {
      try {
        const res = await fetch(`/api/recommend?${search.toString()}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Request failed');
        setData(json);
      } catch (e: any) {
        setError(e?.message || 'Error');
      }
    }
    run();
  }, [search]);

  if (error) return <div style={{ padding: 16 }}>Error: {error}</div>;
  if (!data) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <h2>Recommendations</h2>
      <div style={{ marginBottom: 8, color: '#555' }}>
        FOV: {data.setup.fov_deg.w}° × {data.setup.fov_deg.h}° — Pixel scale: {data.setup.arcsec_per_px}″/px
      </div>
      <div>
        {data.recommended_targets.map((item: any) => (
          <TargetCard key={item.id} item={item} />
        ))}
      </div>
      {data.filtered_out_examples?.length > 0 && (
        <details>
          <summary>Filtered out examples</summary>
          <ul>
            {data.filtered_out_examples.map((f: any, i: number) => (
              <li key={i}>{f.id}: {f.reason}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}