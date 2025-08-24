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
    return p;
  }

  function persistAndNavigate(target: "plan" | "recommend") {
    const params = toParams();
    if (target === "plan" && !form.targetId) return;
    sessionStorage.setItem("astro-params", params.toString());
    if (target === "plan") {
      const qs = params.toString();
      window.open(`/api/plan?${qs}`, "_blank");
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
      fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(placeQuery)}&limit=5`, {
        headers: { "Accept": "application/json" },
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((json) => setSuggestions(Array.isArray(json) ? json : []))
        .catch(() => {})
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
      fetch(`/api/camera?query=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((json) => setCameraSuggestions(Array.isArray(json?.items) ? json.items : []))
        .catch(() => {})
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
    setPlaceQuery(s.display_name);
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

  return (
    <form onSubmit={(e) => e.preventDefault()} className="grid grid-auto-fit-220" style={{ gap: 12 }}>
      <div style={{ gridColumn: "1 / -1" }}>
        <label>Location</label>
        <div className="row row-wrap" style={{ gap: 8 }}>
          <button type="button" onClick={useMyLocation}>Use my location</button>
          <input type="text" value={placeQuery} onChange={(e) => setPlaceQuery(e.target.value)} placeholder="Search place (city, address, landmark)" />
        </div>
        {isFetchingPlaces && placeQuery.trim().length >= 3 && <div className="mt-3" style={{ color: "#666" }}>Searching…</div>}
        {suggestions.length > 0 && (
          <ul className="mt-3" style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4, listStyle: "none", maxHeight: 180, overflowY: "auto" }}>
            {suggestions.map((s) => (
              <li key={s.place_id}>
                <button type="button" onClick={() => choosePlace(s)} style={{ background: "transparent", border: "none", padding: 6, cursor: "pointer", textAlign: "left", width: "100%" }}>{s.display_name}</button>
              </li>
            ))}
          </ul>
        )}
        {(form.lat !== "" && form.lon !== "") && (
          <p className="mt-3" style={{ color: "#666", fontSize: 12 }}>Location set</p>
        )}
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label>Camera model (auto-fill sensor)</label>
        <input type="text" value={cameraQuery} onChange={(e) => setCameraQuery(e.target.value)} placeholder="e.g. Nikon D7500, Sony a7 III" />
        {isFetchingCameras && cameraQuery.trim().length >= 2 && <div className="mt-3" style={{ color: "#666" }}>Searching cameras…</div>}
        {cameraSuggestions.length > 0 && (
          <ul className="mt-3" style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4, listStyle: "none", maxHeight: 180, overflowY: "auto" }}>
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
                  style={{ background: "transparent", border: "none", padding: 6, cursor: "pointer", textAlign: "left", width: "100%" }}
                >
                  {s.name} — {s.sensorW} × {s.sensorH} mm{(s.pixelUm ? `, ${s.pixelUm} µm` : "")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <label>Sensor width (mm)</label>
        <input type="number" step="0.1" value={form.sensorW} onChange={(e) => update("sensorW", Number(e.target.value))} />
      </div>
      <div>
        <label>Sensor height (mm)</label>
        <input type="number" step="0.1" value={form.sensorH} onChange={(e) => update("sensorH", Number(e.target.value))} />
      </div>
      <div>
        <label>Pixel size (μm)</label>
        <input type="number" step="0.01" value={form.pixelUm} onChange={(e) => update("pixelUm", Number(e.target.value))} />
      </div>
      <div>
        <label>Focal length (mm)</label>
        <input type="number" step="1" value={form.focalMm} onChange={(e) => update("focalMm", Number(e.target.value))} />
      </div>
      <div>
        <label>f-number</label>
        <input type="number" step="0.1" value={form.fNum} onChange={(e) => update("fNum", Number(e.target.value))} />
      </div>
      <div>
        <label>Mount</label>
        <select value={form.mount} onChange={(e) => update("mount", e.target.value as any)}>
          <option value="fixed">Fixed</option>
          <option value="tracker">Tracker</option>
          <option value="guided">Guided</option>
        </select>
      </div>
      <div>
        <label>Date/time (UTC ISO)</label>
        <input type="text" value={form.date} onChange={(e) => update("date", e.target.value)} />
      </div>
      <div>
        <label>Target (optional)</label>
        <select value={form.targetId} onChange={(e) => update("targetId", e.target.value)}>
          <option value="">— None (Recommend for me) —</option>
          {targetOptions.map((t) => (
            <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
          ))}
        </select>
      </div>
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => persistAndNavigate("recommend")}>Recommend Targets</button>
        <button type="button" disabled={!form.targetId} onClick={() => persistAndNavigate("plan")}>Plan Selected Target</button>
      </div>
    </form>
  );
}
