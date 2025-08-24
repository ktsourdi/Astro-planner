export default function MapLightPollution() {
  const tiles = process.env.NEXT_PUBLIC_MAP_TILES_URL || '';
  return (
    <div style={{ height: 240, borderRadius: 8, overflow: 'hidden', border: '1px solid #ddd', background: '#f6f6f6' }}>
      {!tiles ? (
        <div style={{ padding: 16, color: '#666' }}>Map tiles URL not configured.</div>
      ) : (
        <div style={{ padding: 16, color: '#666' }}>Map placeholder. Configure tiles at NEXT_PUBLIC_MAP_TILES_URL.</div>
      )}
    </div>
  );
}