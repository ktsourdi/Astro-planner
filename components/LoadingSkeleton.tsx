export default function LoadingSkeleton({ 
  lines = 3, 
  height = 20,
  className = "" 
}: { 
  lines?: number; 
  height?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            height: `${height}px`,
            background: "linear-gradient(90deg, var(--color-bg-secondary) 25%, var(--color-bg-card) 50%, var(--color-bg-secondary) 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s infinite",
            borderRadius: "var(--radius-sm)",
            marginBottom: i < lines - 1 ? "var(--space-2)" : 0,
            width: i === lines - 1 ? "60%" : "100%"
          }}
        />
      ))}
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}