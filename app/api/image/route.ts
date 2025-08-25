import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const name = (req.nextUrl.searchParams.get("name") || "").trim();
  if (!name) {
    return new NextResponse("Missing name", { status: 400 });
  }
  const tryTitles = [name];
  if (/^ngc\s*\d+/i.test(name)) {
    tryTitles.push(name.replace(/\s+/g, " ").toUpperCase());
  }

  for (const title of tryTitles) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const r = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
      if (!r.ok) continue;
      const json: any = await r.json();
      const thumb = json?.thumbnail?.source as string | undefined;
      if (thumb) {
        // Redirect the browser to the thumbnail URL so <img> can load it directly
        return NextResponse.redirect(thumb, 302);
      }
    } catch {}
  }
  return new NextResponse(null, { status: 204 });
}


