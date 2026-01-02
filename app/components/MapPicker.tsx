'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type LatLng = { lat: number; lng: number };

export default function MapPicker(props: {
  value: LatLng | null;
  onChange: (v: LatLng | null) => void;
}) {
  const { value, onChange } = props;

  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [leaflet, setLeaflet] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);

  const center = useMemo(() => {
    if (value) return value;
    // Ankara default
    return { lat: 39.9208, lng: 32.8541 };
  }, [value]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load Leaflet dynamically (Next.js safe)
  useEffect(() => {
    if (!mounted) return;

    (async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      setLeaflet(L);
    })();
  }, [mounted]);

  useEffect(() => {
    if (!leaflet) return;

    // Fix default marker icons for Leaflet + Next
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const L = leaflet as any;
	L.Icon.Default.mergeOptions({
 	 iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
 	 iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
 	 shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
	});
    // Create map once
    if (!mapRef.current) {
      const map = L.map('map-picker', {
        center: [center.lat, center.lng],
        zoom: value ? 16 : 12,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      map.on('click', (e: any) => {
        const lat = e.latlng.lat as number;
        const lng = e.latlng.lng as number;
        onChange({ lat, lng });
      });

      mapRef.current = map;
    }

    // Ensure marker matches value
    const map = mapRef.current;
    if (value) {
      if (!markerRef.current) {
        markerRef.current = L.marker([value.lat, value.lng]).addTo(map);
      } else {
        markerRef.current.setLatLng([value.lat, value.lng]);
      }
      map.setView([value.lat, value.lng], Math.max(map.getZoom(), 15));
    } else {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      // don’t force center if user cleared; keep map as is
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaflet, value?.lat, value?.lng]);

  async function doSearch() {
    const s = q.trim();
    if (!s) return;

    setSearching(true);
    setSearchErr(null);

    try {
      // Nominatim (OpenStreetMap) geocoding
      // Note: For heavy usage you should add your own backend/proxy & respect rate limits.
      const url =
        `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q: s,
          format: 'json',
          limit: '1',
          countrycodes: 'tr',
        }).toString();

      const res = await fetch(url, {
        headers: {
          // Nominatim asks for a valid UA/Referer; browsers set UA automatically.
          // Keep it simple here.
          'Accept': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Arama servisi hata verdi.');

      const data = (await res.json()) as Array<any>;
      if (!data || data.length === 0) {
        setSearchErr('Adres bulunamadı. Daha detaylı yazmayı dene.');
        setSearching(false);
        return;
      }

      const lat = Number(data[0].lat);
      const lng = Number(data[0].lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setSearchErr('Konum çözümlenemedi.');
        setSearching(false);
        return;
      }

      onChange({ lat, lng });

      // Move map immediately
      if (mapRef.current) {
        mapRef.current.setView([lat, lng], 16);
      }
    } catch (e: any) {
      setSearchErr(e?.message ?? 'Arama başarısız.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Adres ara (örn: Çankaya Caddesi, Ankara)"
          style={{ padding: 10, flex: 1, minWidth: 280 }}
        />
        <button
          type="button"
          onClick={doSearch}
          disabled={searching}
          style={{
            padding: '10px 12px',
            cursor: 'pointer',
            border: '1px solid #ddd',
            borderRadius: 10,
            background: '#fff',
          }}
        >
          {searching ? 'Aranıyor...' : 'Ara'}
        </button>

        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            style={{
              padding: '10px 12px',
              cursor: 'pointer',
              border: '1px solid #ddd',
              borderRadius: 10,
              background: '#fff',
            }}
          >
            Temizle
          </button>
        )}
      </div>

      {searchErr && <div style={{ color: 'red', fontSize: 13 }}>{searchErr}</div>}

      <div
        id="map-picker"
        style={{
          height: 320,
          width: '100%',
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.12)',
        }}
      />

      <div style={{ fontSize: 12, opacity: 0.8 }}>
        Haritada bir noktaya tıklayarak konumu seçebilirsin.
        {value ? (
          <>
            {' '}
            Seçili: <b>{value.lat.toFixed(6)}, {value.lng.toFixed(6)}</b>
          </>
        ) : null}
      </div>
    </div>
  );
}
