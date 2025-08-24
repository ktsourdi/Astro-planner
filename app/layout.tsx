import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Astronomy Planner MVP",
  description: "Gain-based astrophotography planner",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", background: "#0b0e12", color: "#e6edf3" }}>
        <div style={{ borderBottom: "1px solid #1f2937", background: "#0e131a" }}>
          <div className="container" style={{ paddingTop: 12, paddingBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="brand" style={{ fontWeight: 700 }}>Astronomy Planner</div>
            <nav className="nav" style={{ display: "flex", gap: 12 }}>
              <a href="/" style={{ color: "#93c5fd" }}>Plan</a>
              <a href="/recommend" style={{ color: "#93c5fd" }}>Recommend</a>
            </nav>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
