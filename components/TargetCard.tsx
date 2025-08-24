type Props = {
  rec: {
    id: string;
    name: string;
    type: string;
    fill_ratio: number;
    framing_score: number;
    score: number;
    window?: { start_utc: string; end_utc: string; alt_max_deg: number };
    suggested_capture: { sub_exposure_s: number; gain: number; subs: number; notes: string };
  };
};

export default function TargetCard({ rec }: Props) {
  const getFramingBadge = () => {
    if (rec.framing_score >= 0.8) return { text: "Perfect Framing", class: "badge-success" };
    if (rec.framing_score >= 0.7) return { text: "Great Framing", class: "badge-success" };
    if (rec.framing_score >= 0.5) return { text: "Good Framing", class: "badge" };
    if (rec.fill_ratio < 0.1) return { text: "Too Small", class: "badge-warning" };
    return null;
  };

  const getTypeIcon = () => {
    const type = rec.type.toLowerCase();
    if (type.includes("galaxy")) return "🌌";
    if (type.includes("nebula")) return "☁️";
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
        background: `linear-gradient(90deg, var(--color-accent) ${rec.score * 100}%, var(--color-bg-secondary) ${rec.score * 100}%)`
      }} />

      {/* Header */}
      <div style={{ marginBottom: "var(--space-4)" }}>
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
          {badge && (
            <span className={`badge ${badge.class}`}>
              {badge.text}
            </span>
          )}
        </div>
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
      </div>
    </div>
  );
}