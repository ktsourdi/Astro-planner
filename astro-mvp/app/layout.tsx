export const metadata = {
  title: 'Astronomy Planner (MVP)',
  description: 'Next.js Astronomy planning tool for DSO imaging',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'ui-sans-serif, system-ui, Arial, sans-serif' }}>{children}</body>
    </html>
  );
}

