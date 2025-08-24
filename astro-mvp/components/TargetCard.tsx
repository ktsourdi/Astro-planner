type Props = {
  item: {
    id: string;
    name: string;
    type: string;
    fill_ratio: number;
    framing_score: number;
    window: { start_utc: string; end_utc: string; alt_max_deg: number };
    score: number;
    suggested_capture: { sub_exposure_s: number; gain: number; subs: number; notes: string };
  };
};

export default function TargetCard({ item }: Props) {
  const greatFraming = item.framing_score >= 0.7;
  const tooSmall = item.fill_ratio < 0.1;
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>{item.id} — {item.name}</h3>
        <span>{(item.score*100).toFixed(0)}%</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {greatFraming && <span style={{ background: '#e0ffe0', padding: '2px 6px', borderRadius: 4 }}>Great framing</span>}
        {tooSmall && <span style={{ background: '#ffe0e0', padding: '2px 6px', borderRadius: 4 }}>Too small</span>}
      </div>
      <div style={{ marginTop: 8, fontSize: 14 }}>
        Fill ratio: {item.fill_ratio.toFixed(2)} — Framing score: {item.framing_score.toFixed(2)} — Alt max: {item.window.alt_max_deg.toFixed(0)}°
      </div>
      <div style={{ marginTop: 8, fontSize: 14 }}>
        Suggested: {item.suggested_capture.subs} × {item.suggested_capture.sub_exposure_s}s @ Gain {item.suggested_capture.gain}
      </div>
      <div style={{ marginTop: 4, color: '#666' }}>{item.suggested_capture.notes}</div>
    </div>
  );
}