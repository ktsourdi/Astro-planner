import { NextRequest, NextResponse } from "next/server";
import localCameras from "@/data/cameras.json";

type CameraSpec = {
  brand: string;
  model: string;
  sensorW: number;
  sensorH: number;
  pixelUm?: number | null;
};

let cachedSpecs: CameraSpec[] | null = null;
let lastFetchTimeMs = 0;

async function fetchCameraSpecsFromWeb(): Promise<CameraSpec[]> {
  const now = Date.now();
  if (cachedSpecs && now - lastFetchTimeMs < 1000 * 60 * 60 * 24) {
    return cachedSpecs;
  }
  const url = "https://raw.githubusercontent.com/openMVG/CameraSensorSizeDatabase/master/sensor_database.csv";
  const resp = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
  if (!resp.ok) {
    throw new Error(`Failed to fetch camera sensor database: ${resp.status}`);
  }
  const text = await resp.text();
  const lines = text.split(/\r?\n/);
  const specs: CameraSpec[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    // The database is semicolon-separated: Brand;Model;SensorWidth;SensorHeight
    const parts = trimmed.split(";").map((p) => p.trim());
    if (parts.length < 4) continue;
    const brand = parts[0];
    const model = parts[1];
    const sensorW = Number(parts[2]);
    const sensorH = Number(parts[3]);
    if (!brand || !model || !Number.isFinite(sensorW) || !Number.isFinite(sensorH)) continue;
    specs.push({ brand, model, sensorW, sensorH, pixelUm: null });
  }
  cachedSpecs = specs;
  lastFetchTimeMs = now;
  return specs;
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\s_\-]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const query = (searchParams.get("query") || "").trim();
  if (!query) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }
  let specs: CameraSpec[] = [];
  try {
    specs = await fetchCameraSpecsFromWeb();
  } catch (err) {
    // ignore and fall back to local
  }
  // Merge in local cameras and de-duplicate by brand+model
  const merged: CameraSpec[] = (() => {
    const byKey = new Map<string, CameraSpec>();
    const add = (s: CameraSpec) => {
      const key = `${s.brand} ${s.model}`.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, s);
    };
    for (const s of specs) add(s);
    for (const s of localCameras as any[]) add({
      brand: s.brand,
      model: s.model,
      sensorW: Number(s.sensorW),
      sensorH: Number(s.sensorH),
      pixelUm: s.pixelUm ?? null,
    });
    return Array.from(byKey.values());
  })();
  const nq = normalize(query);
  const scored = merged
    .map((s) => {
      const full = `${s.brand} ${s.model}`;
      const nfull = normalize(full);
      let score = 0;
      if (nfull === nq) score = 100;
      else if (nfull.startsWith(nq)) score = 90;
      else if (nfull.includes(nq)) score = 70;
      else {
        // try splitting words and partial matches
        const words = nq.split(" ").filter(Boolean);
        const hits = words.filter((w) => nfull.includes(w)).length;
        if (hits > 0) score = 50 + hits;
      }
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((x) => x.s);

  return NextResponse.json(
    {
      items: scored.map((s) => ({
        id: `${s.brand} ${s.model}`,
        name: `${s.brand} ${s.model}`,
        sensorW: s.sensorW,
        sensorH: s.sensorH,
        pixelUm: s.pixelUm ?? null,
      })),
    },
    { status: 200 }
  );
}

