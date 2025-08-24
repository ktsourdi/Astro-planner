import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  targetId: z.string().min(1),
  date: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters", issues: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;
  // Minimal placeholder plan result; front-end opens in new tab
  const payload = {
    targetId: p.targetId,
    atUtc: p.date ?? new Date().toISOString(),
    location: { lat: p.lat, lon: p.lon },
    note: "Planning endpoint stub. Detailed plan logic to be implemented.",
  };
  return NextResponse.json(payload, { status: 200 });
}

