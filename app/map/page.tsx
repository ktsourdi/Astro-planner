"use client";

import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";

// Dynamically import react-leaflet components to avoid SSR/type issues
const MapContainer: any = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer: any = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker: any = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup: any = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });

export default function DarkSkyMapPage() {
  const [pos, setPos] = useState<[number, number] | null>(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("astro-params") || "";
      const params = new URLSearchParams(raw);
      const lat = Number(params.get("lat"));
      const lon = Number(params.get("lon"));
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        setPos([lat, lon]);
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((p) => setPos([p.coords.latitude, p.coords.longitude]));
      }
    } catch {
      // ignore
    }
  }, []);

  const center = pos ?? [48.8584, 2.2945];

  // Light pollution tiles using World Atlas 2015 hosted mirror (no key).
  // If tiles fail, the overlay will just not render.
  const [overlayOpacity, setOverlayOpacity] = useState(0.75);
  const [showNasa, setShowNasa] = useState(false);
  const [showLpm, setShowLpm] = useState(true);
  const lightPollutionTiles = useMemo(() => ({
    url: "https://tiles.lightpollutionmap.info/tiles/{z}/{x}/{y}.png?org=wa_2015",
    attribution: "&copy; LightPollutionMap.info",
  }), []);
  const nasaBlackMarble = useMemo(() => ({
    // NASA GIBS Black Marble (night lights), static 2016 layer as a fallback
    url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
    attribution: "Imagery © NASA GIBS",
  }), []);

  return (
    <main className="container" style={{ paddingTop: "var(--space-8)", paddingBottom: "var(--space-8)" }}>
      <h1 style={{ marginBottom: "var(--space-4)" }}>🗺️ Dark-Sky Map</h1>
      <p className="text-secondary" style={{ marginBottom: "var(--space-4)" }}>
        Find nearby darker locations. Yellow/white indicates heavy light pollution; blue/black is darker.
      </p>
      <div style={{ height: "70vh", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        <MapContainer center={center as any} zoom={8} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {showNasa && (
            <TileLayer url={nasaBlackMarble.url} attribution={nasaBlackMarble.attribution} opacity={overlayOpacity} />
          )}
          {showLpm && (
            <TileLayer url={lightPollutionTiles.url} attribution={lightPollutionTiles.attribution} opacity={overlayOpacity} />
          )}
          {pos && (
            <Marker position={pos as any}>
              <Popup>
                Your location
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
      <div style={{ marginTop: "var(--space-3)", display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <label className="text-secondary" style={{ fontSize: "var(--font-size-sm)" }}>
          <input type="checkbox" checked={showNasa} onChange={(e) => setShowNasa(e.target.checked)} style={{ marginRight: 8 }} /> NASA Black Marble
        </label>
        <label className="text-secondary" style={{ fontSize: "var(--font-size-sm)" }}>
          <input type="checkbox" checked={showLpm} onChange={(e) => setShowLpm(e.target.checked)} style={{ marginRight: 8 }} /> World Atlas 2015
        </label>
        <span className="text-secondary" style={{ fontSize: "var(--font-size-sm)" }}>Opacity</span>
        <input type="range" min={0} max={1} step={0.05} value={overlayOpacity} onChange={(e) => setOverlayOpacity(Number(e.target.value))} style={{ width: 200 }} />
      </div>
      <div className="text-secondary" style={{ marginTop: "var(--space-2)", fontSize: "var(--font-size-sm)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span>Legend:</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 16, height: 10, background: "#ffffb2", border: "1px solid var(--color-border)" }} /> Bright city (Bortle 8–9)
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 16, height: 10, background: "#fd8d3c", border: "1px solid var(--color-border)" }} /> Suburban (Bortle 5–6)
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 16, height: 10, background: "#31a354", border: "1px solid var(--color-border)" }} /> Rural (Bortle 4)
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 16, height: 10, background: "#08519c", border: "1px solid var(--color-border)" }} /> Dark / Remote (Bortle 2–3)
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 16, height: 10, background: "#000000" }} /> Darkest (Bortle 1)
        </span>
      </div>
    </main>
  );
}


