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
  const badge = rec.framing_score >= 0.7 ? "Great framing" : rec.fill_ratio < 0.1 ? "Too small" : null;
  return (
    <div style={{ border: "1px solid #1f2937", borderRadius: 8, padding: 12, background: "#0e131a" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700 }}>{rec.name} <span style={{ color: "#9ca3af", fontWeight: 400 }}>({rec.id})</span></div>
          <div style={{ color: "#9ca3af", fontSize: 12 }}>{rec.type}</div>
        </div>
        {badge && <span style={{ fontSize: 12, background: "#1f2937", color: "#93c5fd", padding: "2px 6px", borderRadius: 999 }}>{badge}</span>}
      </div>
      <div style={{ marginTop: 8, color: "#d1d5db", fontSize: 14 }}>
        Score: {rec.score.toFixed(2)} — Framing: {rec.framing_score.toFixed(2)} (fill {rec.fill_ratio.toFixed(2)})
      </div>
      {rec.window && (
        <div style={{ marginTop: 4, color: "#9ca3af", fontSize: 12 }}>
          Window: {new Date(rec.window.start_utc).toLocaleString()} → {new Date(rec.window.end_utc).toLocaleString()} (alt max {Math.round(rec.window.alt_max_deg)}°)
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 14 }}>
        Suggested: {rec.suggested_capture.sub_exposure_s}s @ Gain {rec.suggested_capture.gain} — {rec.suggested_capture.subs} subs.
        <div style={{ color: "#9ca3af", fontSize: 12 }}>{rec.suggested_capture.notes}</div>
      </div>
    </div>
  );
}
