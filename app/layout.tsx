"use client";

import "./globals.css";
import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function RootLayout({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Astronomy Planner - Astrophotography Session Planning</title>
        <meta name="description" content="Plan your perfect astrophotography session with gain-based recommendations, target visibility, and optimal capture settings" />
      </head>
      <body style={{ 
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif", 
        background: "var(--color-bg-primary)", 
        color: "var(--color-text-primary)",
        minHeight: "100vh"
      }}>
        <header className="nav-header">
          <div className="container" style={{ 
            paddingTop: "var(--space-4)", 
            paddingBottom: "var(--space-4)", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "space-between" 
          }}>
            <Link href="/" style={{ 
              fontSize: "var(--font-size-xl)", 
              fontWeight: 700,
              background: "linear-gradient(135deg, #f0f6fc 0%, #58a6ff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)"
            }}>
              <span style={{ fontSize: "1.5em" }}>🔭</span>
              <span>AstroPlanner</span>
            </Link>
            
            <button 
              className="nav-mobile-toggle"
              onClick={() => setNavOpen(!navOpen)}
              aria-label="Toggle navigation"
              style={{ fontSize: "1.5rem" }}
            >
              {navOpen ? "✕" : "☰"}
            </button>
            
            <nav className={`nav-links ${navOpen ? 'nav-open' : ''}`} style={{ 
              display: "flex", 
              gap: "var(--space-4)",
              alignItems: "center"
            }}>
              <Link 
                href="/" 
                onClick={() => setNavOpen(false)}
                style={{ 
                  color: pathname === "/" ? "var(--color-accent)" : "var(--color-text-secondary)",
                  fontWeight: pathname === "/" ? 600 : 400,
                  transition: "all var(--transition-fast)",
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  background: pathname === "/" ? "var(--color-accent-bg)" : "transparent"
                }}
              >
                📋 Plan Session
              </Link>
              <Link 
                href="/recommend" 
                onClick={() => setNavOpen(false)}
                style={{ 
                  color: pathname === "/recommend" ? "var(--color-accent)" : "var(--color-text-secondary)",
                  fontWeight: pathname === "/recommend" ? 600 : 400,
                  transition: "all var(--transition-fast)",
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-md)",
                  background: pathname === "/recommend" ? "var(--color-accent-bg)" : "transparent"
                }}
              >
                ⭐ Recommendations
              </Link>
            </nav>
          </div>
        </header>
        
        <div style={{ minHeight: "calc(100vh - 73px)" }}>
          {children}
        </div>
        
        <footer style={{ 
          borderTop: "1px solid var(--color-border)", 
          marginTop: "var(--space-12)",
          padding: "var(--space-8) 0",
          background: "var(--color-bg-secondary)"
        }}>
          <div className="container text-center">
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", marginBottom: 0 }}>
              © 2024 AstroPlanner • Built for astrophotographers, by astrophotographers
            </p>
          </div>
        </footer>
        
        <style jsx>{`
          @media (min-width: 641px) {
            .nav-links {
              position: static !important;
              display: flex !important;
              flex-direction: row !important;
              background: transparent !important;
              border: none !important;
              padding: 0 !important;
            }
          }
        `}</style>
      </body>
    </html>
  );
}