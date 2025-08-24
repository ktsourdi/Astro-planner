"use client";

import Link from "next/link";
import SetupForm from "@/components/SetupForm";

export default function HomePage() {
  return (
    <main className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Astronomy Planner (MVP)</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>Plan your next imaging session. Uses Gain, not ISO.</p>
      <SetupForm />
      <div style={{ marginTop: 24 }}>
        <Link href="/recommend">See recommendations</Link>
      </div>
    </main>
  );
}
