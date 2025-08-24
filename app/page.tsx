"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SetupForm from "@/components/SetupForm";

export default function HomePage() {
  const [coords, setCoords] = useState<{ lat: number | ""; lon: number | "" }>({ lat: "", lon: "" });

  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: Number(pos.coords.latitude.toFixed(4)), lon: Number(pos.coords.longitude.toFixed(4)) });
        },
        () => {}
      );
    }
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Astronomy Planner (MVP)</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>Plan your next imaging session. Uses Gain, not ISO.</p>
      <SetupForm initialLat={coords.lat} initialLon={coords.lon} />
      <div style={{ marginTop: 24 }}>
        <Link href="/recommend">See recommendations</Link>
      </div>
    </main>
  );
}
