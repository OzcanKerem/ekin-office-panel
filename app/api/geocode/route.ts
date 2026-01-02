import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();

  if (!q || q.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(q)}` +
    `&format=json&addressdetails=1&limit=6`;

  // Nominatim iyi niyetli kullanım ister; backend üzerinden çağırmak daha stabil.
  const r = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      // User-Agent tarayıcıdan ayarlanamaz; server-side burada problem olmaz.
      'User-Agent': 'EkinOfficePanel/1.0 (contact: info@ekinotomasyon.com.tr)',
    },
    // Nominatim cevapları hızlı; cache kapalı daha iyi kontrol
    cache: 'no-store',
  });

  if (!r.ok) {
    return NextResponse.json({ results: [] }, { status: 200 });
  }

  const data = (await r.json()) as any[];

  const results = data.map((x) => ({
    display_name: x.display_name as string,
    lat: Number(x.lat),
    lon: Number(x.lon),
  }));

  return NextResponse.json({ results });
}
