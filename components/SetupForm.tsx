"use client";

import targets from "@/data/targets.json";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initialLat?: number | "";
  initialLon?: number | "";
};

type PlaceSuggestion = { place_id: string; display_name: string; lat: string; lon: string };
type CameraSuggestion = { id: string; name: string; sensorW: number; sensorH: number; pixelUm: number | null };

export default function SetupForm({ initialLat = "", initialLon = "" }: Props) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<"location" | "equipment" | "settings">("location");
  const [form, setForm] = useState({
    lat: initialLat,
    lon: initialLon,
    sensorW: 23.5,
    sensorH: 15.6,
    pixelUm: 3.76,
    focalMm: 200,
    fNum: 2.8,
    mount: "tracker" as "fixed" | "tracker" | "guided",
    targetId: "",
    date: new Date().toISOString(),
  });

  const targetOptions = useMemo(() => targets.map((t) => ({ id: t.id, name: t.name })), []);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toParams() {
    const p = new URLSearchParams();
    (Object.keys(form) as (keyof typeof form)[]).forEach((k) => {
      const v = (form as any)[k];
      if (v !== "" && v != null) p.set(String(k), String(v));
    });
    console.debug("[setup] built params", Object.fromEntries(p.entries()));
    return p;
  }

  function persistAndNavigate(target: "plan" | "recommend") {
    const params = toParams();
    if (target === "plan" && !form.targetId) return;
    const raw = params.toString();
    console.debug("[setup] saving session params", { raw });
    sessionStorage.setItem("astro-params", raw);
    if (target === "plan") {
      const qs = params.toString();
      const url = `/api/plan?${qs}`;
      console.debug("[setup] opening plan", { url });
      window.open(url, "_blank");
    } else {
      router.push("/recommend");
    }
  }

  const [placeQuery, setPlaceQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isFetchingPlaces, setIsFetchingPlaces] = useState(false);

  const [cameraQuery, setCameraQuery] = useState("");
  const [cameraSuggestions, setCameraSuggestions] = useState<CameraSuggestion[]>([]);
  const [isFetchingCameras, setIsFetchingCameras] = useState(false);

  useEffect(() => {
    if (placeQuery.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setIsFetchingPlaces(true);
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(placeQuery)}&limit=5`;
      console.debug("[setup] fetching places", { url });
      fetch(url, {
        headers: { "Accept": "application/json" },
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((json) => {
          console.debug("[setup] places response", { count: Array.isArray(json) ? json.length : undefined });
          setSuggestions(Array.isArray(json) ? json : []);
        })
        .catch((e) => {
          console.warn("[setup] places fetch error", e);
        })
        .finally(() => setIsFetchingPlaces(false));
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [placeQuery]);

  useEffect(() => {
    const q = cameraQuery.trim();
    if (q.length < 2) {
      setCameraSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setIsFetchingCameras(true);
      const url = `/api/camera?query=${encodeURIComponent(q)}`;
      console.debug("[setup] fetching cameras", { url });
      fetch(url, { signal: controller.signal })
        .then((r) => r.json())
        .then((json) => {
          console.debug("[setup] cameras response", { count: Array.isArray(json?.items) ? json.items.length : undefined });
          setCameraSuggestions(Array.isArray(json?.items) ? json.items : []);
        })
        .catch((e) => {
          console.warn("[setup] cameras fetch error", e);
        })
        .finally(() => setIsFetchingCameras(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [cameraQuery]);

  function choosePlace(s: PlaceSuggestion) {
    update("lat", Number(Number(s.lat).toFixed(4)) as any);
    update("lon", Number(Number(s.lon).toFixed(4)) as any);
    setPlaceQuery("");
    setSuggestions([]);
  }

  function useMyLocation() {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          update("lat", Number(pos.coords.latitude.toFixed(4)) as any);
          update("lon", Number(pos.coords.longitude.toFixed(4)) as any);
        },
        () => {}
      );
    }
  }

  const isLocationSet = form.lat !== "" && form.lon !== "";

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      {/* Mobile-friendly tabs */}
      <div style={{ 
        display: "flex", 
        gap: "var(--space-2)",
        marginBottom: "var(--space-6)",
        borderBottom: "1px solid var(--color-border)",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch"
      }}>
        <button
          type="button"
          onClick={() => setActiveSection("location")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeSection === "location" ? "2px solid var(--color-accent)" : "2px solid transparent",
            color: activeSection === "location" ? "var(--color-accent)" : "var(--color-text-secondary)",
            padding: "var(--space-3) var(--space-4)",
            fontWeight: activeSection === "location" ? 600 : 400,
            whiteSpace: "nowrap",
            transition: "all var(--transition-fast)"
          }}
        >
          📍 Location {isLocationSet && "✓"}
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("equipment")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeSection === "equipment" ? "2px solid var(--color-accent)" : "2px solid transparent",
            color: activeSection === "equipment" ? "var(--color-accent)" : "var(--color-text-secondary)",
            padding: "var(--space-3) var(--space-4)",
            fontWeight: activeSection === "equipment" ? 600 : 400,
            whiteSpace: "nowrap",
            transition: "all var(--transition-fast)"
          }}
        >
          📷 Equipment
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("settings")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeSection === "settings" ? "2px solid var(--color-accent)" : "2px solid transparent",
            color: activeSection === "settings" ? "var(--color-accent)" : "var(--color-text-secondary)",
            padding: "var(--space-3) var(--space-4)",
            fontWeight: activeSection === "settings" ? 600 : 400,
            whiteSpace: "nowrap",
            transition: "all var(--transition-fast)"
          }}
        >
          ⚙️ Settings
        </button>
      </div>

      {/* Location Section */}
      {activeSection === "location" && (
        <div className="animate-fadeIn">
          <div className="form-group">
            <label style={{ fontSize: "var(--font-size-base)", marginBottom: "var(--space-3)" }}>
              🌍 Observation Location
            </label>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "1fr auto",
              gap: "var(--space-3)",
              marginBottom: "var(--space-3)"
            }}>
              <input 
                type="text" 
                value={placeQuery} 
                onChange={(e) => setPlaceQuery(e.target.value)} 
                placeholder="Search city, address, or landmark..." 
              />
              <button 
                type="button" 
                onClick={useMyLocation}
                className="btn-secondary"
                style={{ whiteSpace: "nowrap" }}
              >
                📍 Use GPS
              </button>
            </div>
            
            {isFetchingPlaces && placeQuery.trim().length >= 3 && (
              <div className="loading">Searching locations...</div>
            )}
            
            {suggestions.length > 0 && (
              <ul className="suggestions-list">
                {suggestions.map((s) => (
                  <li key={s.place_id}>
                    <button type="button" onClick={() => choosePlace(s)}>
                      📍 {s.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            
            {isLocationSet && (
              <div style={{ 
                padding: "var(--space-3)",
                background: "var(--color-accent-bg)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-accent)",
                borderColor: "rgba(88, 166, 255, 0.3)",
                marginTop: "var(--space-3)"
              }}>
                <div style={{ color: "var(--color-accent)", fontWeight: 500, marginBottom: "var(--space-1)" }}>
                  ✓ Location Set
                </div>
                <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
                  Lat: {form.lat}°, Lon: {form.lon}°
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Equipment Section */}
      {activeSection === "equipment" && (
        <div className="animate-fadeIn">
          <div className="form-group">
            <label style={{ fontSize: "var(--font-size-base)", marginBottom: "var(--space-3)" }}>
              📸 Camera Model (auto-fills sensor specs)
            </label>
            <input 
              type="text" 
              value={cameraQuery} 
              onChange={(e) => setCameraQuery(e.target.value)} 
              placeholder="e.g., Canon 6D, Nikon D850, ZWO ASI294..." 
            />
            
            {isFetchingCameras && cameraQuery.trim().length >= 2 && (
              <div className="loading mt-3">Searching cameras...</div>
            )}
            
            {!isFetchingCameras && cameraQuery.trim().length >= 2 && cameraSuggestions.length === 0 && (
              <div className="mt-3 text-muted text-sm">No cameras found. Enter specs manually below.</div>
            )}
            
            {cameraSuggestions.length > 0 && (
              <ul className="suggestions-list">
                {cameraSuggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCameraQuery(s.name);
                        setCameraSuggestions([]);
                        update("sensorW", Number(s.sensorW) as any);
                        update("sensorH", Number(s.sensorH) as any);
                        if (s.pixelUm != null) update("pixelUm", Number(s.pixelUm) as any);
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{s.name}</div>
                      <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
                        {s.sensorW} × {s.sensorH} mm{s.pixelUm ? `, ${s.pixelUm} µm pixels` : ""}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "var(--space-4)"
          }}>
            <div className="form-group">
              <label>Sensor Width (mm)</label>
              <input 
                type="number" 
                step="0.1" 
                value={form.sensorW} 
                onChange={(e) => update("sensorW", Number(e.target.value))} 
              />
            </div>
            <div className="form-group">
              <label>Sensor Height (mm)</label>
              <input 
                type="number" 
                step="0.1" 
                value={form.sensorH} 
                onChange={(e) => update("sensorH", Number(e.target.value))} 
              />
            </div>
            <div className="form-group">
              <label>Pixel Size (μm)</label>
              <input 
                type="number" 
                step="0.01" 
                value={form.pixelUm} 
                onChange={(e) => update("pixelUm", Number(e.target.value))} 
              />
            </div>
          </div>

          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "var(--space-4)"
          }}>
            <div className="form-group">
              <label>Focal Length (mm)</label>
              <input 
                type="number" 
                step="1" 
                value={form.focalMm} 
                onChange={(e) => update("focalMm", Number(e.target.value))} 
              />
            </div>
            <div className="form-group">
              <label>f-number (f/)</label>
              <input 
                type="number" 
                step="0.1" 
                value={form.fNum} 
                onChange={(e) => update("fNum", Number(e.target.value))} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Settings Section */}
      {activeSection === "settings" && (
        <div className="animate-fadeIn">
          <div className="form-group">
            <label>Mount Type</label>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: "var(--space-3)"
            }}>
              {["fixed", "tracker", "guided"].map((mountType) => (
                <button
                  key={mountType}
                  type="button"
                  onClick={() => update("mount", mountType as any)}
                  style={{
                    padding: "var(--space-4)",
                    background: form.mount === mountType ? "var(--color-accent-bg)" : "var(--color-bg-secondary)",
                    border: form.mount === mountType ? "1px solid var(--color-accent)" : "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    color: form.mount === mountType ? "var(--color-accent)" : "var(--color-text-primary)",
                    fontWeight: form.mount === mountType ? 600 : 400,
                    transition: "all var(--transition-fast)",
                    cursor: "pointer"
                  }}
                >
                  {mountType === "fixed" && "🔧 Fixed"}
                  {mountType === "tracker" && "🔄 Tracker"}
                  {mountType === "guided" && "🎯 Guided"}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Session Date/Time (UTC)</label>
            <input 
              type="datetime-local" 
              value={form.date.slice(0, 16)} 
              onChange={(e) => update("date", new Date(e.target.value).toISOString())} 
            />
          </div>

          <div className="form-group">
            <label>Specific Target (optional)</label>
            <select 
              value={form.targetId} 
              onChange={(e) => update("targetId", e.target.value)}
            >
              <option value="">— Let me recommend targets —</option>
              <optgroup label="Popular Targets">
                {targetOptions.slice(0, 10).map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                ))}
              </optgroup>
              <optgroup label="All Targets">
                {targetOptions.slice(10).map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ 
        display: "flex", 
        gap: "var(--space-3)", 
        marginTop: "var(--space-8)",
        flexWrap: "wrap"
      }}>
        <button 
          type="button" 
          onClick={() => persistAndNavigate("recommend")}
          style={{ flex: "1 1 200px" }}
        >
          ⭐ Get Recommendations
        </button>
        <button 
          type="button" 
          disabled={!form.targetId} 
          onClick={() => persistAndNavigate("plan")}
          className="btn-secondary"
          style={{ flex: "1 1 200px" }}
        >
          📋 Plan Selected Target
        </button>
      </div>
    </form>
  );
}