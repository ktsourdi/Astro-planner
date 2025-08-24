"use client";

import targets from "@/data/targets.json";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initialLat?: number | "";
  initialLon?: number | "";
};

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

  return (
    <form onSubmit={(e) => e.preventDefault()} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
      <div>
        <label>Latitude</label>
        <input type="number" step="0.0001" value={form.lat} onChange={(e) => update("lat", Number(e.target.value))} placeholder="e.g., 40.64" />
      </div>
      <div>
        <label>Longitude</label>
        <input type="number" step="0.0001" value={form.lon} onChange={(e) => update("lon", Number(e.target.value))} placeholder="e.g., 22.94" />
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

      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12, marginTop: 8 }}>
        <button type="button" onClick={() => persistAndNavigate("recommend")}>Recommend Targets</button>
        <button type="button" disabled={!form.targetId} onClick={() => persistAndNavigate("plan")}>Plan Selected Target</button>
      </div>
    </form>
  );
}
