"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type PlannerItem = {
  id: string;
  name: string;
  type: string;
  score: number;
  score_breakdown: { visibility: number; framing: number; season: number; moon: number; weather: number };
  window: { start_utc: string; end_utc: string; alt_max_deg: number };
};

type PlannerNight = {
  date_utc: string;
  best_windows: PlannerItem[];
};

export default function PlannerPage() {
  const [data, setData] = useState<{ nights: PlannerNight[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<"week" | "month" | "season">("week");
  const [typeFilter, setTypeFilter] = useState("");
  const [minScore, setMinScore] = useState(0.4);
  const [minAlt, setMinAlt] = useState(10);

  useEffect(() => {
    let raw = "";
    try {
      raw = window.sessionStorage.getItem("astro-params") || window.localStorage.getItem("astro-params-last") || "";
    } catch {}
    const base = new URLSearchParams(raw);
    if (!base.get("lat") || !base.get("lon")) {
      setError("Missing setup parameters. Go back and configure your session first.");
      return;
    }
    if (!base.get("sensorW")) base.set("sensorW", "23.5");
    if (!base.get("sensorH")) base.set("sensorH", "15.6");
    if (!base.get("focalMm")) base.set("focalMm", "200");
    base.set("range", range);
    base.set("minScore", String(minScore));
    base.set("minAlt", String(minAlt));
    if (typeFilter.trim()) base.set("type", typeFilter.trim());
    else base.delete("type");
    fetch(`/api/planner?${base.toString()}`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load planner: ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [range, typeFilter, minScore, minAlt]);

  const totalWindows = useMemo(
    () => (data?.nights || []).reduce((acc, n) => acc + n.best_windows.length, 0),
    [data]
  );

  if (error) {
    return (
      <main className="container" style={{ paddingTop: "var(--space-8)", paddingBottom: "var(--space-8)" }}>
        <div className="card" style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <h2>Planner unavailable</h2>
          <p style={{ color: "var(--color-text-secondary)" }}>{error}</p>
          <Link href="/">
            <button>← Back to Setup</button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container" style={{ paddingTop: "var(--space-8)", paddingBottom: "var(--space-8)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: "var(--space-2)" }}>Multi-night Planner</h1>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: 0 }}>
            {data?.nights.length ?? 0} nights • {totalWindows} suggested windows
          </p>
        </div>
        <Link href="/">
          <button className="btn-secondary">Adjust setup</button>
        </Link>
      </div>

      <section className="card" style={{ marginTop: "var(--space-5)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-3)" }}>
          <div>
            <label>Range</label>
            <select value={range} onChange={(e) => setRange(e.target.value as any)}>
              <option value="week">Week (7 nights)</option>
              <option value="month">Month (30 nights)</option>
              <option value="season">Season (90 nights)</option>
            </select>
          </div>
          <div>
            <label>Type filter</label>
            <input value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} placeholder="e.g. galaxy, nebula" />
          </div>
          <div>
            <label>Minimum score ({(minScore * 100).toFixed(0)}%)</label>
            <input type="range" min={0} max={1} step={0.05} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} />
          </div>
          <div>
            <label>Minimum altitude ({minAlt}°)</label>
            <input type="range" min={0} max={40} step={1} value={minAlt} onChange={(e) => setMinAlt(Number(e.target.value))} />
          </div>
        </div>
      </section>

      <section style={{ marginTop: "var(--space-6)", display: "grid", gap: "var(--space-4)" }}>
        {(data?.nights || []).map((night) => (
          <article key={night.date_utc} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
              <h3 style={{ marginBottom: 0 }}>{new Date(night.date_utc).toLocaleDateString()}</h3>
              <span className="badge">{night.best_windows.length} windows</span>
            </div>
            {night.best_windows.length === 0 ? (
              <div className="text-sm text-muted">No targets met your filters for this night.</div>
            ) : (
              <div style={{ display: "grid", gap: "var(--space-2)" }}>
                {night.best_windows.map((w) => (
                  <div
                    key={`${night.date_utc}-${w.id}`}
                    style={{
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      padding: "var(--space-3)",
                      background: "var(--color-bg-secondary)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{w.name}</div>
                        <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>{w.type}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 600 }}>{(w.score * 100).toFixed(0)}%</div>
                        <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>Score</div>
                      </div>
                    </div>
                    <div style={{ marginTop: "var(--space-2)", fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
                      {new Date(w.window.start_utc).toLocaleTimeString()} → {new Date(w.window.end_utc).toLocaleTimeString()} • max {Math.round(w.window.alt_max_deg)}°
                    </div>
                    <div style={{ marginTop: "var(--space-1)", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                      V {(w.score_breakdown.visibility * 100).toFixed(0)}% • F {(w.score_breakdown.framing * 100).toFixed(0)}% • S{" "}
                      {(w.score_breakdown.season * 100).toFixed(0)}% • M {(w.score_breakdown.moon * 100).toFixed(0)}% • W{" "}
                      {(w.score_breakdown.weather * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
