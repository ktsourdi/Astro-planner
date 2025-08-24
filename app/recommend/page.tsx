"use client";

import { useEffect, useState } from "react";
import TargetCard from "@/components/TargetCard";
import Link from "next/link";

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
  const [filter, setFilter] = useState<"all" | "high" | "medium">("all");
  const [sortBy, setSortBy] = useState<"score" | "framing" | "name">("score");

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
      const raw = window.sessionStorage.getItem("astro-params") || "";
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
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container" style={{ 
        paddingTop: "var(--space-8)", 
        paddingBottom: "var(--space-8)" 
      }}>
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