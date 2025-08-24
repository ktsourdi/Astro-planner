"use client";

import Link from "next/link";
import SetupForm from "@/components/SetupForm";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="animate-fadeIn">
            <h1 className="hero-title">
              Plan Your Perfect Night Sky Session
            </h1>
            <p className="hero-subtitle">
              Professional astrophotography planning with gain-based recommendations, 
              target visibility calculations, and optimal capture settings tailored to your equipment.
            </p>
            <div style={{ 
              marginTop: "var(--space-8)",
              display: "flex",
              gap: "var(--space-4)",
              justifyContent: "center",
              flexWrap: "wrap"
            }}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "var(--space-2)",
                padding: "var(--space-3) var(--space-4)",
                background: "var(--color-bg-card)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-border)"
              }}>
                <span style={{ fontSize: "1.5em" }}>🎯</span>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>Smart Targeting</div>
                  <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>AI-powered recommendations</div>
                </div>
              </div>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "var(--space-2)",
                padding: "var(--space-3) var(--space-4)",
                background: "var(--color-bg-card)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-border)"
              }}>
                <span style={{ fontSize: "1.5em" }}>📸</span>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>Gain-Based</div>
                  <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>Modern sensor optimization</div>
                </div>
              </div>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "var(--space-2)",
                padding: "var(--space-3) var(--space-4)",
                background: "var(--color-bg-card)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-border)"
              }}>
                <span style={{ fontSize: "1.5em" }}>🌌</span>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>Live Visibility</div>
                  <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>Real-time sky calculations</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="container" style={{ paddingTop: "var(--space-12)", paddingBottom: "var(--space-12)" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div className="card" style={{ padding: "var(--space-8)" }}>
            <h2 style={{ 
              fontSize: "var(--font-size-2xl)", 
              marginBottom: "var(--space-6)",
              textAlign: "center"
            }}>
              📍 Setup Your Session
            </h2>
            <SetupForm />
          </div>

          <div style={{ 
            marginTop: "var(--space-8)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "var(--space-4)"
          }}>
            <div className="card card-compact">
              <h3 style={{ fontSize: "var(--font-size-lg)", marginBottom: "var(--space-3)" }}>
                🔍 How It Works
              </h3>
              <ol style={{ 
                listStyle: "none", 
                padding: 0,
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)"
              }}>
                <li style={{ marginBottom: "var(--space-2)" }}>1. Enter your location or use GPS</li>
                <li style={{ marginBottom: "var(--space-2)" }}>2. Select your camera and optics</li>
                <li style={{ marginBottom: "var(--space-2)" }}>3. Choose your mount type</li>
                <li style={{ marginBottom: "var(--space-2)" }}>4. Get personalized recommendations</li>
              </ol>
            </div>

            <div className="card card-compact">
              <h3 style={{ fontSize: "var(--font-size-lg)", marginBottom: "var(--space-3)" }}>
                💡 Pro Tips
              </h3>
              <ul style={{ 
                listStyle: "none", 
                padding: 0,
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)"
              }}>
                <li style={{ marginBottom: "var(--space-2)" }}>• Use camera search for auto-fill</li>
                <li style={{ marginBottom: "var(--space-2)" }}>• Gain values are more accurate than ISO</li>
                <li style={{ marginBottom: "var(--space-2)" }}>• Check moon phase for DSO imaging</li>
                <li style={{ marginBottom: "var(--space-2)" }}>• Consider light pollution levels</li>
              </ul>
            </div>

            <div className="card card-compact">
              <h3 style={{ fontSize: "var(--font-size-lg)", marginBottom: "var(--space-3)" }}>
                🎯 Target Types
              </h3>
              <div style={{ 
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)"
              }}>
                <div style={{ marginBottom: "var(--space-2)" }}>
                  <span className="badge badge-success">Galaxies</span> Best in spring
                </div>
                <div style={{ marginBottom: "var(--space-2)" }}>
                  <span className="badge">Nebulae</span> Year-round targets
                </div>
                <div style={{ marginBottom: "var(--space-2)" }}>
                  <span className="badge badge-warning">Clusters</span> Wide-field friendly
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}