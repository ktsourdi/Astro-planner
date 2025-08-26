"use client";

import { useEffect, useState } from "react";
import TargetCard from "@/components/TargetCard";
import Link from "next/link";

type ApiDebug = { night_start_utc: string | null; night_end_utc: string | null };

type Recommendation = {
  id: string;
  name: string;
  type: string;
  ra_hms: string;
  dec_dms: string;
  fill_ratio: number;
  framing_score: number;
  window?: { start_utc: string; end_utc: string; alt_max_deg: number };
  visibility_score?: number;
  visible_hours?: number;
  score: number;
  suggested_capture: { sub_exposure_s: number; gain: number; subs: number; notes: string };
};

export default function RecommendPage() {
  const [data, setData] = useState<{ setup?: any; debug?: ApiDebug; recommended_targets: Recommendation[]; filtered_out_examples?: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "high" | "medium">("all");
  const [sortBy, setSortBy] = useState<"score" | "framing" | "name">("score");
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugTargetId, setDebugTargetId] = useState<string | null>(null);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);

  useEffect(() => {
    async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit, retries = 2): Promise<Response> {
      let lastError: any = null;
      for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
          const resp = await fetch(input as any, init);
          if (!resp.ok) {
            throw new Error(`Request failed: ${resp.status}`);
          }
          return resp;
        } catch (err) {
          lastError = err;
          console.warn("[recommend] fetch attempt failed", { input: String(input), attempt, err });
          if (attempt <= retries) {
            await new Promise((r) => setTimeout(r, 200 * attempt));
          }
        }
      }
      throw lastError;
    }

    let params: URLSearchParams | null = null;
    try {
      let raw = window.sessionStorage.getItem("astro-params") || "";
      if (!raw) {
        // Fallback to last saved params in localStorage
        raw = window.localStorage.getItem("astro-params-last") || "";
      }
      console.debug("[recommend] loaded session params raw", { raw });
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
    const url = `/api/recommend?${qs}`;
    console.debug("[recommend] fetching recommendations", { url });
    fetchWithRetry(url, { cache: "no-store" }, 2)
      .then((r) => r.json())
      .then((json) => {
        console.debug("[recommend] received recommendations", { count: Array.isArray(json?.recommended_targets) ? json.recommended_targets.length : undefined });
        setData(json);
      })
      .catch((e) => {
        console.error("[recommend] fetch error", e);
        setError(String(e));
      });
  }, []);

  // Filter and sort targets
  const getFilteredTargets = () => {
    if (!data) return [];
    let targets = [...data.recommended_targets];
    
    if (typeFilters.length > 0) {
      targets = targets.filter(t => typeFilters.includes(t.type));
    }

    // Apply filter
    if (filter === "high") {
      targets = targets.filter(t => t.score >= 0.7);
    } else if (filter === "medium") {
      targets = targets.filter(t => t.score >= 0.5);
    }
    
    // Apply sort
    if (sortBy === "score") {
      targets.sort((a, b) => b.score - a.score);
    } else if (sortBy === "framing") {
      targets.sort((a, b) => b.framing_score - a.framing_score);
    } else if (sortBy === "name") {
      targets.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return targets;
  };

  if (error) {
    return (
      <main className="container" style={{ paddingTop: "var(--space-8)", paddingBottom: "var(--space-8)" }}>
        <div className="card" style={{ 
          textAlign: "center",
          padding: "var(--space-8)",
          maxWidth: "600px",
          margin: "0 auto"
        }}>
          <div style={{ fontSize: "3em", marginBottom: "var(--space-4)" }}>⚠️</div>
          <h2 style={{ color: "var(--color-error)", marginBottom: "var(--space-4)" }}>
            Setup Required
          </h2>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-6)" }}>
            {error}
          </p>
          <Link href="/">
            <button>← Back to Setup</button>
          </Link>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="container" style={{ paddingTop: "var(--space-8)", paddingBottom: "var(--space-8)" }}>
        <div style={{ textAlign: "center", padding: "var(--space-12)" }}>
          <div className="loading" style={{ 
            fontSize: "var(--font-size-lg)",
            justifyContent: "center"
          }}>
            Calculating recommendations...
          </div>
          <p style={{ 
            color: "var(--color-text-muted)", 
            fontSize: "var(--font-size-sm)",
            marginTop: "var(--space-4)"
          }}>
            Analyzing visibility windows and optimal capture settings
          </p>
        </div>
      </main>
    );
  }

  const filteredTargets = getFilteredTargets();

  function toRadians(deg: number) {
    return (deg * Math.PI) / 180;
  }
  function toDegrees(rad: number) {
    return (rad * 180) / Math.PI;
  }
  function normalizeDegrees(deg: number) {
    let x = deg % 360;
    if (x < 0) x += 360;
    return x;
  }
  function parseHmsToHours(hms: string) {
    const [h, m, s] = hms.split(":").map(Number);
    return (h || 0) + (m || 0) / 60 + (s || 0) / 3600;
  }
  function parseDmsToDegrees(dms: string) {
    const sign = dms.trim().startsWith("-") ? -1 : 1;
    const clean = dms.replace(/[+\-]/, "");
    const [d, m, s] = clean.split(":").map(Number);
    const deg = (Math.abs(d) || 0) + (m || 0) / 60 + (s || 0) / 3600;
    return sign * deg;
  }
  function gmstDegrees(date: Date) {
    const JD = date.getTime() / 86400000 + 2440587.5;
    const D = JD - 2451545.0;
    const T = D / 36525.0;
    const GMST = 280.46061837 + 360.98564736629 * D + 0.000387933 * (T * T) - (T * T * T) / 38710000;
    return normalizeDegrees(GMST);
  }
  function altitudeAt(date: Date, latDeg: number, lonDeg: number, raHours: number, decDeg: number) {
    const gmst = gmstDegrees(date);
    const lst = normalizeDegrees(gmst + lonDeg);
    const raDeg = raHours * 15;
    const hourAngle = normalizeDegrees(lst - raDeg);
    const H = toRadians(hourAngle);
    const phi = toRadians(latDeg);
    const delta = toRadians(decDeg);
    const sinAlt = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(H);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    return toDegrees(alt);
  }

  return (
    <>
      {/* Header Section */}
      <section style={{ 
        background: "linear-gradient(180deg, var(--color-bg-secondary) 0%, var(--color-bg-primary) 100%)",
        borderBottom: "1px solid var(--color-border)",
        paddingTop: "var(--space-8)",
        paddingBottom: "var(--space-8)"
      }}>
        <div className="container">
          <div style={{ 
            display: "flex", 
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "var(--space-4)",
            marginBottom: "var(--space-6)"
          }}>
            <div>
              <h1 style={{ 
                fontSize: "var(--font-size-2xl)",
                marginBottom: "var(--space-2)"
              }}>
                🎯 Recommended Targets
              </h1>
              <p style={{ 
                color: "var(--color-text-secondary)",
                fontSize: "var(--font-size-base)",
                marginBottom: 0
              }}>
                {data.recommended_targets.length} targets found for your setup
              </p>
            </div>
            <Link href="/">
              <button className="btn-secondary">
                ← Adjust Setup
              </button>
            </Link>
            {data && (
              <button
                type="button"
                onClick={() => setDebugOpen((v) => !v)}
                className="btn-secondary"
              >
                {debugOpen ? "Hide Debug" : "Show Debug"}
              </button>
            )}
          </div>

          {/* Filters and Sort */}
          <div style={{ 
            display: "flex",
            gap: "var(--space-4)",
            flexWrap: "wrap",
            alignItems: "center"
          }}>
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
              <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>Filter:</span>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                {[
                  { value: "all", label: "All", count: data.recommended_targets.length },
                  { value: "high", label: "High Score", count: data.recommended_targets.filter(t => t.score >= 0.7).length },
                  { value: "medium", label: "Medium+", count: data.recommended_targets.filter(t => t.score >= 0.5).length }
                ].map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value as any)}
                    className={filter === option.value ? "" : "btn-ghost"}
                    style={{
                      padding: "var(--space-2) var(--space-3)",
                      fontSize: "var(--font-size-sm)",
                      background: filter === option.value ? "var(--color-accent-bg)" : "transparent",
                      color: filter === option.value ? "var(--color-accent)" : "var(--color-text-secondary)",
                      border: filter === option.value ? "1px solid var(--color-accent)" : "1px solid transparent",
                      borderColor: filter === option.value ? "rgba(88, 166, 255, 0.3)" : "transparent"
                    }}
                  >
                    {option.label} ({option.count})
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
              <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>Sort:</span>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{ 
                  padding: "var(--space-2) var(--space-3)",
                  fontSize: "var(--font-size-sm)",
                  minWidth: "120px"
                }}
              >
                <option value="score">By Score</option>
                <option value="framing">By Framing</option>
                <option value="name">By Name</option>
              </select>
            </div>

            {/* Category filter */}
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>Categories:</span>
              {Array.from(new Set((data?.recommended_targets || []).map(t => t.type))).sort().map(cat => (
                <label key={cat} style={{ display: "inline-flex", gap: 6, alignItems: "center", border: "1px solid var(--color-border)", borderRadius: 6, padding: "2px 6px" }}>
                  <input
                    type="checkbox"
                    checked={typeFilters.includes(cat)}
                    onChange={(e) => {
                      setTypeFilters((prev) => e.target.checked ? [...prev, cat] : prev.filter(c => c !== cat));
                    }}
                  />
                  <span style={{ fontSize: "var(--font-size-xs)" }}>{cat}</span>
                </label>
              ))}
              {typeFilters.length > 0 && (
                <button type="button" className="btn-ghost" onClick={() => setTypeFilters([])} style={{ fontSize: "var(--font-size-sm)" }}>Clear</button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container" style={{ 
        paddingTop: "var(--space-8)", 
        paddingBottom: "var(--space-8)" 
      }}>
        {debugOpen && data && (
          <div className="card" style={{ marginBottom: "var(--space-6)" }}>
            <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 600 }}>Night interval</div>
                <div style={{ color: "var(--color-text-secondary)" }}>
                  {data.debug?.night_start_utc || "-"} → {data.debug?.night_end_utc || "-"}
                </div>
              </div>
              <div>
                <label style={{ marginRight: 8 }}>Debug target:</label>
                <select value={debugTargetId || ""} onChange={(e) => setDebugTargetId(e.target.value || null)}>
                  <option value="">— select —</option>
                  {filteredTargets.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                  ))}
                </select>
              </div>
            </div>

            {!!debugTargetId && (() => {
              const t = filteredTargets.find((x) => x.id === debugTargetId) as any;
              if (!t) return null;
              const lat = data.setup?.lat as number;
              const lon = data.setup?.lon as number;
              const startIso = data.debug?.night_start_utc as string | null;
              const endIso = data.debug?.night_end_utc as string | null;
              if (!startIso || !endIso) return <div style={{ marginTop: 8 }}>No night interval available.</div>;
              const raH = parseHmsToHours(t.ra_hms);
              const decD = parseDmsToDegrees(t.dec_dms);
              const start = new Date(startIso).getTime();
              const end = new Date(endIso).getTime();
              const rows: { time: string; alt: number }[] = [];
              for (let ms = start; ms <= end; ms += 60 * 60 * 1000) {
                const d = new Date(ms);
                const alt = altitudeAt(d, lat, lon, raH, decD);
                rows.push({ time: d.toISOString(), alt: Math.round(alt * 10) / 10 });
              }
              return (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Hourly altitude (°)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {rows.map((r, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--color-text-secondary)" }}>{new Date(r.time).toLocaleTimeString()}</span>
                        <span>{r.alt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
        {filteredTargets.length === 0 ? (
          <div className="card" style={{ 
            textAlign: "center",
            padding: "var(--space-8)",
            maxWidth: "600px",
            margin: "0 auto"
          }}>
            <div style={{ fontSize: "3em", marginBottom: "var(--space-4)" }}>🔍</div>
            <h3 style={{ marginBottom: "var(--space-3)" }}>No Targets Match Criteria</h3>
            <p style={{ color: "var(--color-text-secondary)" }}>
              Try adjusting your filters or modifying your setup parameters.
            </p>
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div style={{ 
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "var(--space-4)",
              marginBottom: "var(--space-8)"
            }}>
              <div className="card card-compact" style={{ textAlign: "center" }}>
                <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 600, color: "var(--color-accent)" }}>
                  {filteredTargets.filter(t => t.score >= 0.8).length}
                </div>
                <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
                  Excellent Targets
                </div>
              </div>
              <div className="card card-compact" style={{ textAlign: "center" }}>
                <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 600, color: "var(--color-success)" }}>
                  {filteredTargets.filter(t => t.framing_score >= 0.7).length}
                </div>
                <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
                  Great Framing
                </div>
              </div>
              <div className="card card-compact" style={{ textAlign: "center" }}>
                <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 600, color: "var(--color-text-primary)" }}>
                  {filteredTargets.filter(t => t.window).length}
                </div>
                <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
                  Visible Tonight
                </div>
              </div>
            </div>

            {/* Target Grid */}
            <div className="grid grid-auto-fill-280" style={{ gap: "var(--space-4)" }}>
              {filteredTargets.map((t) => (
                <TargetCard key={t.id} rec={t as any} />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}