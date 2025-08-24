"use client";

import { useEffect, useState } from "react";
import TargetCard from "@/components/TargetCard";

type Recommendation = {
  id: string;
  name: string;
  type: string;
  fill_ratio: number;
  framing_score: number;
  window?: { start_utc: string; end_utc: string; alt_max_deg: number };
  score: number;
  suggested_capture: { sub_exposure_s: number; gain: number; subs: number; notes: string };
};

export default function RecommendPage() {
  const [data, setData] = useState<{ setup?: any; recommended_targets: Recommendation[]; filtered_out_examples?: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let params: URLSearchParams | null = null;
    try {
      const raw = window.sessionStorage.getItem("astro-params") || "";
      params = new URLSearchParams(raw);
    } catch {
      setError("Saved parameters are invalid. Go back and fill the form.");
      return;
    }
    if (!params.get("lat") || !params.get("lon")) {
      setError("Missing location/setup. Go back and fill the form.");
      return;
    }
    const qs = params.toString();
    fetch(`/api/recommend?${qs}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Request failed: ${r.status}`))))
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <main className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>{error}</main>;
  if (!data) return <main className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>Loading recommendations…</main>;

  return (
    <main className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Recommended Targets</h2>
      {data.recommended_targets.length === 0 && <p>No suitable targets found. Adjust your setup.</p>}
      <div className="grid grid-auto-fill-280" style={{ gap: 16 }}>
        {data.recommended_targets.map((t) => (
          <TargetCard key={t.id} rec={t as any} />
        ))}
      </div>
    </main>
  );
}
