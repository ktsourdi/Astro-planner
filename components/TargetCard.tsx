type Props = {
  rec: {
    id: string;
    name: string;
    type: string;
    fill_ratio: number;
    framing_score: number;
    score: number;
    score_breakdown?: {
      visibility: number;
      framing: number;
      season: number;
      moon: number;
      weather: number;
      sky_quality: number;
    };
    moon?: {
      illumination_fraction: number;
      average_altitude_deg: number | null;
      average_separation_deg: number | null;
      above_horizon_fraction: number;
    };
    weather?: {
      avg_cloud_pct: number | null;
      confidence: "high" | "medium" | "low";
      sample_hours: number;
    };
    window?: { start_utc: string; end_utc: string; alt_max_deg: number };
    suggested_capture: { sub_exposure_s: number; gain: number; subs: number; notes: string };
    image_url?: string;
    description?: string;
  };
  setup?: {
    lat?: number;
    lon?: number;
    date?: string;
    mount?: "fixed" | "tracker" | "guided";
    minAlt?: number;
    subExposureS?: number;
    gain?: number;
    subs?: number;
    alertsEnabled?: boolean;
    alertLeadMin?: number;
  };
};

import { memo, useEffect, useMemo, useState } from "react";

function TargetCardImpl({ rec, setup }: Props) {
  const [previewRotationDeg, setPreviewRotationDeg] = useState(0);
  const [alertStatus, setAlertStatus] = useState<string>("");
  const [alertsScheduled, setAlertsScheduled] = useState(false);

  const fovRatio = setup?.sensorW && setup?.sensorH ? setup.sensorW / setup.sensorH : 1.5;
  const targetVisualPct = Math.min(220, Math.max(12, rec.fill_ratio * 100));
  const mosaicPanels = rec.fill_ratio > 2 ? 4 : rec.fill_ratio > 1 ? 2 : 1;

  function buildPlanUrl(format: "json" | "csv" = "json") {
    if (setup?.lat == null || setup?.lon == null) return null;
    const params = new URLSearchParams();
    params.set("lat", String(setup.lat));
    params.set("lon", String(setup.lon));
    params.set("targetId", rec.id);
    if (setup.date) params.set("date", setup.date);
    if (setup.mount) params.set("mount", setup.mount);
    if (setup.minAlt != null) params.set("minAlt", String(setup.minAlt));
    if (setup.subExposureS != null) params.set("subExposureS", String(setup.subExposureS));
    if (setup.gain != null) params.set("gain", String(setup.gain));
    if (setup.subs != null) params.set("subs", String(setup.subs));
    params.set("export", format);
    return `/api/plan?${params.toString()}`;
  }

  const recommendedPlanUrl = useMemo(() => buildPlanUrl("json"), [setup, rec.id]);
  const recommendedCsvUrl = useMemo(() => buildPlanUrl("csv"), [setup, rec.id]);

  function showBlockedFallback() {
    setAlertStatus("Notifications are blocked in this browser. Enable notification permission to schedule alerts.");
  }

  function scheduleAlerts() {
    if (!rec.window) {
      setAlertStatus("No visible window available for alerts.");
      return;
    }
    if (typeof window === "undefined" || !("Notification" in window)) {
      setAlertStatus("This browser does not support notifications.");
      return;
    }
    const leadMinutes = Math.max(0, Number(setup?.alertLeadMin ?? 0));
    const startMs = new Date(rec.window.start_utc).getTime();
    const stopMs = new Date(rec.window.end_utc).getTime();
    const notifyStartMs = startMs - leadMinutes * 60000;
    const now = Date.now();

    const schedule = () => {
      const startDelay = notifyStartMs - now;
      const stopDelay = stopMs - now;
      if (startDelay > 0) {
        window.setTimeout(() => {
          new Notification(`Capture window opening: ${rec.name}`, {
            body: leadMinutes > 0 ? `Starts in ${leadMinutes} minutes.` : "Your capture window is starting now.",
          });
        }, Math.min(startDelay, 2147483647));
      }
      if (stopDelay > 0) {
        window.setTimeout(() => {
          new Notification(`Capture window closing: ${rec.name}`, {
            body: "Stop capture or switch to your next target.",
          });
        }, Math.min(stopDelay, 2147483647));
      }
      setAlertsScheduled(true);
      setAlertStatus(stopDelay <= 0 ? "Window already ended; no alerts were scheduled." : "Alerts scheduled for this window.");
    };

    if (Notification.permission === "granted") {
      schedule();
      return;
    }
    if (Notification.permission === "denied") {
      showBlockedFallback();
      return;
    }
    Notification.requestPermission()
      .then((permission) => {
        if (permission !== "granted") {
          showBlockedFallback();
          return;
        }
        schedule();
      })
      .catch(() => {
        setAlertStatus("Unable to request notification permission.");
      });
  }

  useEffect(() => {
    if (!setup?.alertsEnabled || !rec.window || alertsScheduled) return;
    setAlertStatus("Alerts enabled in profile. Click schedule to activate this target’s start/stop notifications.");
  }, [setup?.alertsEnabled, rec.window, alertsScheduled]);

  const getFramingBadge = () => {
    if (rec.framing_score >= 0.8) return { text: "Perfect Framing", class: "badge-success" };
    if (rec.framing_score >= 0.7) return { text: "Great Framing", class: "badge-success" };
    if (rec.framing_score >= 0.5) return { text: "Good Framing", class: "badge" };
    if (rec.fill_ratio < 0.1) return { text: "Too Small", class: "badge-warning" };
    return null;
  };

  const getTypeIcon = () => {
    const type = rec.type.toLowerCase();
    if (type.includes("planetary nebula")) return "🟢";
    if (type.includes("reflection nebula")) return "🔷";
    if (type.includes("dark nebula")) return "🌑";
    if (type.includes("supernova remnant")) return "💥";
    if (type.includes("emission nebula")) return "☁️";
    if (type.includes("open cluster")) return "✨";
    if (type.includes("globular cluster")) return "🔆";
    if (type.includes("group of galaxies")) return "🧩";
    if (type.includes("galaxy cluster")) return "🧊";
    if (type.includes("galaxy")) return "🌌";
    if (type.includes("cluster")) return "✨";
    if (type.includes("planet")) return "🪐";
    return "⭐";
  };

  const badge = getFramingBadge();
  const typeIcon = getTypeIcon();

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Generate simple visibility curve data points
  const generateVisibilityCurve = () => {
    if (!rec.window) return null;
    
    const points = [];
    const startTime = new Date(rec.window.start_utc).getTime();
    const endTime = new Date(rec.window.end_utc).getTime();
    const duration = endTime - startTime;
    const maxAlt = rec.window.alt_max_deg;
    
    // Generate 5 points for a simple curve
    for (let i = 0; i <= 4; i++) {
      const progress = i / 4;
      const time = startTime + duration * progress;
      // Simple parabolic curve peaking in the middle
      const altitude = maxAlt * (1 - Math.pow(2 * progress - 1, 2));
      points.push({ x: progress * 100, y: altitude });
    }
    
    return points;
  };

  const visibilityCurve = generateVisibilityCurve();

  return (
    <div className="card" style={{ 
      display: "flex", 
      flexDirection: "column",
      height: "100%",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Score indicator bar */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "3px",
        background: `linear-gradient(90deg, var(--color-accent) ${rec.score * 100}%, var(--color-bg-secondary) ${rec.score * 100}%)`,
        zIndex: 2
      }} />

      {/* Image Section */}
      {(rec.image_url || true) && (
        <div style={{
          position: "relative",
          marginTop: "-20px",
          marginLeft: "-20px",
          marginRight: "-20px",
          marginBottom: "var(--space-4)",
          height: "200px",
          overflow: "hidden",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0"
        }}>
          <img 
            loading="lazy"
            decoding="async"
            src={rec.image_url || `/api/image?name=${encodeURIComponent(rec.name)}`}
            alt={rec.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "brightness(0.9)"
            }}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              // Try fallback once via our proxy; hide only if that also fails
              if (!img.dataset.fallback) {
                img.dataset.fallback = "1";
                img.src = `/api/image?name=${encodeURIComponent(rec.name)}`;
              } else {
                img.style.display = 'none';
              }
            }}
          />
          {/* Gradient overlay for better text readability */}
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "80px",
            background: "linear-gradient(to top, var(--color-bg-card) 0%, transparent 100%)"
          }} />
          {/* Badge overlay on image */}
          {badge && (
            <div style={{
              position: "absolute",
              top: "var(--space-3)",
              right: "var(--space-3)"
            }}>
              <span className={`badge ${badge.class}`}>
                {badge.text}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: "var(--space-3)" }}>
        <div style={{ 
          display: "flex", 
          alignItems: "flex-start", 
          justifyContent: "space-between",
          gap: "var(--space-3)",
          marginBottom: "var(--space-2)"
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ 
              fontWeight: 600, 
              fontSize: "var(--font-size-lg)",
              color: "var(--color-text-primary)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)"
            }}>
              <span>{typeIcon}</span>
              <span>{rec.name}</span>
            </div>
            <div style={{ 
              color: "var(--color-text-muted)", 
              fontSize: "var(--font-size-sm)",
              marginTop: "var(--space-1)"
            }}>
              {rec.type} • {rec.id}
            </div>
          </div>
          {!rec.image_url && badge && (
            <span className={`badge ${badge.class}`}>
              {badge.text}
            </span>
          )}
        </div>
        {rec.description && (
          <p style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-secondary)",
            marginTop: "var(--space-2)",
            marginBottom: 0,
            lineHeight: 1.5
          }}>
            {rec.description}
          </p>
        )}
      </div>

      {/* Stats Grid */}
      <div style={{ 
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "var(--space-3)",
        marginBottom: "var(--space-4)",
        padding: "var(--space-3)",
        background: "var(--color-bg-secondary)",
        borderRadius: "var(--radius-md)"
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ 
            fontSize: "var(--font-size-xl)", 
            fontWeight: 600,
            color: "var(--color-accent)"
          }}>
            {(rec.score * 100).toFixed(0)}%
          </div>
          <div style={{ 
            fontSize: "var(--font-size-xs)", 
            color: "var(--color-text-muted)",
            marginTop: "var(--space-1)"
          }}>
            Score
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ 
            fontSize: "var(--font-size-xl)", 
            fontWeight: 600,
            color: rec.framing_score >= 0.7 ? "var(--color-success)" : "var(--color-text-primary)"
          }}>
            {(rec.framing_score * 100).toFixed(0)}%
          </div>
          <div style={{ 
            fontSize: "var(--font-size-xs)", 
            color: "var(--color-text-muted)",
            marginTop: "var(--space-1)"
          }}>
            Framing
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ 
            fontSize: "var(--font-size-xl)", 
            fontWeight: 600,
            color: "var(--color-text-primary)"
          }}>
            {(rec.fill_ratio * 100).toFixed(0)}%
          </div>
          <div style={{ 
            fontSize: "var(--font-size-xs)", 
            color: "var(--color-text-muted)",
            marginTop: "var(--space-1)"
          }}>
            Fill
          </div>
        </div>
      </div>

      {/* Visibility Window */}
      {rec.window && (
        <div style={{ 
          marginBottom: "var(--space-4)",
          padding: "var(--space-3)",
          background: "var(--color-bg-tertiary)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border)"
        }}>
          <div style={{ 
            fontSize: "var(--font-size-sm)", 
            fontWeight: 500,
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-2)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)"
          }}>
            <span>🕐</span>
            <span>Visibility Window</span>
          </div>
          
          {/* Visibility Graph */}
          {visibilityCurve && (
            <div style={{ 
              marginBottom: "var(--space-2)",
              padding: "var(--space-2)",
              background: "var(--color-bg-secondary)",
              borderRadius: "var(--radius-sm)"
            }}>
              <svg 
                width="100%" 
                height="60" 
                viewBox="0 0 100 60"
                style={{ display: "block" }}
              >
                {/* Grid lines */}
                <line x1="0" y1="50" x2="100" y2="50" stroke="var(--color-border)" strokeWidth="0.5" opacity="0.3" />
                <line x1="0" y1="30" x2="100" y2="30" stroke="var(--color-border)" strokeWidth="0.5" opacity="0.3" />
                <line x1="0" y1="10" x2="100" y2="10" stroke="var(--color-border)" strokeWidth="0.5" opacity="0.3" />
                
                {/* Altitude curve */}
                <path
                  d={`M ${visibilityCurve.map((p, i) => 
                    `${p.x} ${50 - (p.y / rec.window!.alt_max_deg) * 40}`
                  ).join(' L ')}`}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="2"
                />
                
                {/* Fill under curve */}
                <path
                  d={`M 0 50 ${visibilityCurve.map((p, i) => 
                    `L ${p.x} ${50 - (p.y / rec.window!.alt_max_deg) * 40}`
                  ).join(' ')} L 100 50 Z`}
                  fill="var(--color-accent)"
                  opacity="0.1"
                />
                
                {/* Peak indicator */}
                <circle 
                  cx="50" 
                  cy={50 - 40} 
                  r="3" 
                  fill="var(--color-accent)"
                />
                
                {/* Labels */}
                <text x="50" y="58" fontSize="8" fill="var(--color-text-muted)" textAnchor="middle">
                  Time →
                </text>
                <text x="2" y="8" fontSize="8" fill="var(--color-text-muted)">
                  {Math.round(rec.window.alt_max_deg)}°
                </text>
              </svg>
            </div>
          )}
          
          <div style={{ 
            fontSize: "var(--font-size-sm)", 
            color: "var(--color-text-secondary)"
          }}>
            {formatDateTime(rec.window.start_utc)} → {formatDateTime(rec.window.end_utc)}
          </div>
          <div style={{ 
            fontSize: "var(--font-size-sm)", 
            color: "var(--color-text-muted)",
            marginTop: "var(--space-1)"
          }}>
            Max altitude: {Math.round(rec.window.alt_max_deg)}°
          </div>
          <div style={{ marginTop: "var(--space-2)", display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {recommendedPlanUrl && (
              <a href={recommendedPlanUrl} target="_blank" rel="noreferrer" className="btn-ghost" style={{ textDecoration: "none", fontSize: "var(--font-size-sm)" }}>
                📋 Plan JSON
              </a>
            )}
            {recommendedCsvUrl && (
              <a href={recommendedCsvUrl} target="_blank" rel="noreferrer" className="btn-ghost" style={{ textDecoration: "none", fontSize: "var(--font-size-sm)" }}>
                ⬇️ Export CSV
              </a>
            )}
            <button type="button" className="btn-ghost" onClick={scheduleAlerts} style={{ fontSize: "var(--font-size-sm)" }}>
              🔔 Schedule alerts
            </button>
          </div>
          {alertStatus && (
            <div style={{ marginTop: "var(--space-2)", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              {alertStatus}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          marginBottom: "var(--space-4)",
          padding: "var(--space-3)",
          background: "var(--color-bg-secondary)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 500, marginBottom: "var(--space-2)" }}>🧩 Framing & mosaic preview</div>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
          <div
            style={{
              position: "relative",
              width: 170,
              height: 110,
              border: "1px solid var(--color-border-light)",
              background: "var(--color-bg-tertiary)",
              overflow: "hidden",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: "12%",
                border: "1px solid var(--color-accent)",
                transform: `rotate(${previewRotationDeg}deg)`,
                transformOrigin: "center center",
                borderRadius: "2px",
                aspectRatio: String(fovRatio),
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: `${targetVisualPct}%`,
                height: `${targetVisualPct}%`,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                border: "1px dashed var(--color-warning)",
                background: "rgba(210, 153, 34, 0.1)",
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label>Preview rotation ({previewRotationDeg}°)</label>
            <input type="range" min={0} max={180} step={1} value={previewRotationDeg} onChange={(e) => setPreviewRotationDeg(Number(e.target.value))} />
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
              Suggested layout: {mosaicPanels === 1 ? "Single panel" : mosaicPanels === 2 ? "2-panel mosaic" : "4-panel mosaic"}
              {rec.fill_ratio > 1 ? " (target exceeds current FOV)" : ""}
            </div>
          </div>
        </div>
      </div>

      {(rec.score_breakdown || rec.moon || rec.weather) && (
        <div
          style={{
            marginBottom: "var(--space-4)",
            padding: "var(--space-3)",
            background: "var(--color-bg-secondary)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 500, marginBottom: "var(--space-2)" }}>
            🧮 Ranking factors
          </div>
          {rec.score_breakdown && (
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              Visibility {(rec.score_breakdown.visibility * 100).toFixed(0)}% • Framing {(rec.score_breakdown.framing * 100).toFixed(0)}% • Moon {(rec.score_breakdown.moon * 100).toFixed(0)}% • Weather {(rec.score_breakdown.weather * 100).toFixed(0)}%
            </div>
          )}
          {rec.moon && (
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
              Moon {(rec.moon.illumination_fraction * 100).toFixed(0)}% lit
              {rec.moon.average_separation_deg != null ? ` • separation ${rec.moon.average_separation_deg.toFixed(0)}°` : ""}
            </div>
          )}
          {rec.weather && (
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
              Clouds {rec.weather.avg_cloud_pct == null ? "n/a" : `${rec.weather.avg_cloud_pct.toFixed(0)}%`} • forecast {rec.weather.confidence}
            </div>
          )}
        </div>
      )}

      {/* Capture Settings */}
      <div style={{ 
        marginTop: "auto",
        padding: "var(--space-4)",
        background: "linear-gradient(135deg, var(--color-accent-bg) 0%, rgba(88, 166, 255, 0.05) 100%)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-accent)",
        borderColor: "rgba(88, 166, 255, 0.3)"
      }}>
        <div style={{ 
          fontSize: "var(--font-size-sm)", 
          fontWeight: 500,
          color: "var(--color-accent)",
          marginBottom: "var(--space-2)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)"
        }}>
          <span>📸</span>
          <span>Suggested Capture</span>
        </div>
        <div style={{ 
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "var(--space-3)",
          marginBottom: "var(--space-2)"
        }}>
          <div>
            <div style={{ 
              fontSize: "var(--font-size-base)", 
              fontWeight: 600,
              color: "var(--color-text-primary)"
            }}>
              {rec.suggested_capture.sub_exposure_s}s
            </div>
            <div style={{ 
              fontSize: "var(--font-size-xs)", 
              color: "var(--color-text-muted)"
            }}>
              Exposure
            </div>
          </div>
          <div>
            <div style={{ 
              fontSize: "var(--font-size-base)", 
              fontWeight: 600,
              color: "var(--color-text-primary)"
            }}>
              {rec.suggested_capture.gain}
            </div>
            <div style={{ 
              fontSize: "var(--font-size-xs)", 
              color: "var(--color-text-muted)"
            }}>
              Gain
            </div>
          </div>
          <div>
            <div style={{ 
              fontSize: "var(--font-size-base)", 
              fontWeight: 600,
              color: "var(--color-text-primary)"
            }}>
              {rec.suggested_capture.subs}
            </div>
            <div style={{ 
              fontSize: "var(--font-size-xs)", 
              color: "var(--color-text-muted)"
            }}>
              Subs
            </div>
          </div>
        </div>
        {rec.suggested_capture.notes && (
          <div style={{ 
            fontSize: "var(--font-size-xs)", 
            color: "var(--color-text-secondary)",
            fontStyle: "italic"
          }}>
            💡 {rec.suggested_capture.notes}
          </div>
        )}

        {/* External Links */}
        <div style={{
          display: "flex",
          gap: "var(--space-3)",
          marginTop: "var(--space-3)",
          flexWrap: "wrap"
        }}>
          <a
            href={`https://stellarium-web.org/skysource/${encodeURIComponent(rec.id)}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
            style={{ textDecoration: "none", fontSize: "var(--font-size-sm)" }}
          >
            🗺️ View in sky map
          </a>
          <a
            href={`https://simbad.u-strasbg.fr/simbad/sim-basic?Ident=${encodeURIComponent(rec.id)}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
            style={{ textDecoration: "none", fontSize: "var(--font-size-sm)" }}
          >
            📚 SIMBAD
          </a>
        </div>
      </div>
    </div>
  );
}

const TargetCard = memo(TargetCardImpl);
export default TargetCard;
