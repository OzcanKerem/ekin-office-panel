'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useParams, useRouter } from 'next/navigation';

type JobType = 'MONTAJ' | 'ARIZA' | 'BAKIM' | 'SATIS';

type AssetRow = {
  uid: string;
  customer_name: string | null;
  customer_phone: string | null;
  product_type: string | null;
  address: string | null;
  installer_name: string | null;
  installer_phone: string | null;

  install_date: string | null;
  job_type: JobType | null;

  product_model: string | null;
  size: string | null;
  motor: string | null;
  extras: string | null;
  payments: string | null;

  latitude: number | null;
  longitude: number | null;

  contract_pdf_path: string | null;
};

type NominatimItem = {
  display_name: string;
  lat: string;
  lon: string;
};

export default function EditAssetPage() {
  const params = useParams();
  const router = useRouter();

  const uid = useMemo(() => {
    const raw = params?.uid;
    const u = Array.isArray(raw) ? raw[0] : raw;
    return u ? decodeURIComponent(u) : '';
  }, [params]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [productType, setProductType] = useState('');
  const [address, setAddress] = useState('');
  const [installerName, setInstallerName] = useState('');
  const [installerPhone, setInstallerPhone] = useState('');

  const [installDate, setInstallDate] = useState('');
  const [jobType, setJobType] = useState<JobType>('MONTAJ');

  const [productModel, setProductModel] = useState('');
  const [size, setSize] = useState('');
  const [motor, setMotor] = useState('');
  const [extras, setExtras] = useState('');
  const [payments, setPayments] = useState('');

  // ✅ Konum artık string input değil: state number/null
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const [contractPath, setContractPath] = useState<string | null>(null);
  const [newContractFile, setNewContractFile] = useState<File | null>(null);

  // ✅ Harita arama
  const [locQ, setLocQ] = useState('');
  const [locLoading, setLocLoading] = useState(false);
  const [locResults, setLocResults] = useState<NominatimItem[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // ✅ Leaflet dinamik import (SSR çakışmasın)
  const [leafletReady, setLeafletReady] = useState(false);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const L = await import('leaflet');
        // marker icon yolu (Next içinde “kayıp marker” olmasın)
        // @ts-ignore
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
        setLeafletReady(true);
      } catch (e) {
        // Leaflet yoksa: sayfa yine çalışsın, sadece harita gelmez
        console.error(e);
        setLeafletReady(false);
      }
    })();
  }, []);

  async function openContract(path: string) {
    const { data, error } = await supabase.storage
      .from('contracts')
      .createSignedUrl(path, 60 * 10);

    if (error || !data?.signedUrl) {
      setErr(error?.message || 'Sözleşme açılamadı.');
      return;
    }

    window.open(data.signedUrl, '_blank');
  }

  function setMapPoint(nextLat: number, nextLng: number) {
    setLat(nextLat);
    setLng(nextLng);

    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([nextLat, nextLng]);
      mapRef.current.setView([nextLat, nextLng], Math.max(mapRef.current.getZoom?.() ?? 16, 16));
    }
  }

  async function ensureMapMounted(initialLat: number, initialLng: number) {
    if (!leafletReady) return;

    const L = await import('leaflet');

    // Map zaten kuruluysa sadece konumu set et
    if (mapRef.current && markerRef.current) {
      setMapPoint(initialLat, initialLng);
      return;
    }

    const el = document.getElementById('ek-map');
    if (!el) return;

    const map = L.map(el, { zoomControl: true }).setView([initialLat, initialLng], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);

    marker.on('dragend', () => {
      const p = marker.getLatLng();
      setLat(p.lat);
      setLng(p.lng);
    });

    map.on('click', (e: any) => {
      const p = e.latlng;
      marker.setLatLng(p);
      setLat(p.lat);
      setLng(p.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;
  }

  async function searchLocation() {
    const q = locQ.trim();
    if (!q) return;

    setLocLoading(true);
    setLocResults([]);

    try {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          // Nominatim tarafında “User-Agent” isteyebilir; browser’da sınırlı
          'Accept': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Konum arama başarısız');
      const data = (await res.json()) as NominatimItem[];
      setLocResults(data);
    } catch (e: any) {
      if (e?.name !== 'AbortError') setErr('Konum aramada hata oluştu.');
    } finally {
      setLocLoading(false);
    }
  }

  async function load() {
    if (!uid) return;

    setErr('');
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.push('/login');
      return;
    }

    const { data, error } = await supabase
      .from('assets')
      .select(
        `
        uid,
        customer_name,
        customer_phone,
        product_type,
        address,
        installer_name,
        installer_phone,
        install_date,
        job_type,
        product_model,
        size,
        motor,
        extras,
        payments,
        latitude,
        longitude,
        contract_pdf_path
        `
      )
      .eq('uid', uid)
      .maybeSingle();

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    const a = data as AssetRow | null;
    if (!a) {
      setErr('Kayıt bulunamadı.');
      setLoading(false);
      return;
    }

    setCustomerName(a.customer_name ?? '');
    setCustomerPhone(a.customer_phone ?? '');
    setProductType(a.product_type ?? '');
    setAddress(a.address ?? '');
    setInstallerName(a.installer_name ?? '');
    setInstallerPhone(a.installer_phone ?? '');

    setInstallDate(a.install_date ?? '');
    setJobType((a.job_type ?? 'MONTAJ') as JobType);

    setProductModel(a.product_model ?? '');
    setSize(a.size ?? '');
    setMotor(a.motor ?? '');
    setExtras(a.extras ?? '');
    setPayments(a.payments ?? '');

    setLat(a.latitude ?? null);
    setLng(a.longitude ?? null);

    setContractPath(a.contract_pdf_path ?? null);
    setNewContractFile(null);

    setLoading(false);

    // Haritayı, veri geldikten sonra kur
    const initialLat = (a.latitude ?? 39.9208); // default Ankara
    const initialLng = (a.longitude ?? 32.8541);
    // Map DOM render olduktan sonra
    setTimeout(() => {
      ensureMapMounted(initialLat, initialLng);
    }, 0);
  }

  async function save() {
    if (!uid) return;

    setErr('');

    if (!installDate.trim()) {
      setErr('Montaj tarihi zorunlu.');
      return;
    }

    setSaving(true);

    let nextContractPath = contractPath;

    if (newContractFile) {
      if (newContractFile.type !== 'application/pdf') {
        setErr('Lütfen sadece PDF seç.');
        setSaving(false);
        return;
      }

      const fileNameSafe = newContractFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${uid}/contract_${Date.now()}_${fileNameSafe}`;

      const { error: upErr } = await supabase.storage.from('contracts').upload(path, newContractFile, {
        upsert: true,
        contentType: 'application/pdf',
      });

      if (upErr) {
        setErr('PDF yüklenemedi: ' + upErr.message);
        setSaving(false);
        return;
      }

      nextContractPath = path;
    }

    const payload: any = {
      customer_name: customerName.trim() || null,
      customer_phone: customerPhone.trim() || null,
      product_type: productType.trim() || null,
      address: address.trim() || null,
      installer_name: installerName.trim() || null,
      installer_phone: installerPhone.trim() || null,

      install_date: installDate.trim(),
      job_type: jobType,

      product_model: productModel.trim() || null,
      size: size.trim() || null,
      motor: motor.trim() || null,
      extras: extras.trim() || null,
      payments: payments.trim() || null,

      // ✅ artık map state
      latitude: lat,
      longitude: lng,

      contract_pdf_path: nextContractPath,
    };

    const { error } = await supabase.from('assets').update(payload).eq('uid', uid);

    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }

    router.push(`/assets/${encodeURIComponent(uid)}`);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  if (!uid) {
    return (
      <div style={{ padding: 20 }}>
        <p>UID okunamadı.</p>
        <Link href="/">← Listeye dön</Link>
      </div>
    );
  }

  if (loading) return <div style={{ padding: 20 }}>Yükleniyor...</div>;

  const pageBg: React.CSSProperties = {
    minHeight: '100vh',
    background: '#4b7dcc',
    padding: 18,
  };

  const shell: React.CSSProperties = {
    maxWidth: 1200,
    margin: '0 auto',
  };

  const topBar: React.CSSProperties = {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    marginBottom: 12,
  };

  const card: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: 14,
    border: '1px solid rgba(0,0,0,0.08)',
    boxShadow: '0 10px 26px rgba(0,0,0,0.14)',
    padding: 14,
  };

  const inputStyle: React.CSSProperties = {
    padding: 10,
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.14)',
    width: '100%',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = { fontSize: 12, opacity: 0.75, marginTop: 6 };

  const softBtn: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.14)',
    background: '#fff',
    cursor: 'pointer',
  };

  const primaryBtn: React.CSSProperties = {
    padding: 12,
    borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.10)',
    background: saving ? '#e9e9e9' : '#4287F5',
    color: saving ? '#333' : '#fff',
    cursor: saving ? 'not-allowed' : 'pointer',
    fontWeight: 700,
  };

  return (
    <div style={pageBg}>
      <div style={shell}>
        <div style={topBar}>
          <div style={{ color: '#fff' }}>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Düzenle</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{uid}</div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <Link
              href={`/assets/${encodeURIComponent(uid)}`}
              style={{ ...softBtn, textDecoration: 'none', color: 'inherit' }}
            >
              ← Detaya dön
            </Link>

            <button onClick={load} style={softBtn}>
              Yenile
            </button>
          </div>
        </div>

        {err && (
          <div style={{ ...card, background: '#fff5f5', borderColor: '#ffd4d4', color: '#b00020', marginBottom: 12 }}>
            {err}
          </div>
        )}

        {/* ✅ 1. Satır: Genel + Ürün Detayları (yan yana) */}
        <div className="grid2">
          <div style={card}>
            <h3 style={{ margin: 0, marginBottom: 10 }}>Genel</h3>

            <div style={labelStyle}>Müşteri Adı</div>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={inputStyle} />

            <div style={labelStyle}>Müşteri Telefon</div>
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={inputStyle} />

            <div style={labelStyle}>Ürün Tipi</div>
            <input value={productType} onChange={(e) => setProductType(e.target.value)} style={inputStyle} />

            <div style={labelStyle}>Adres</div>
            <input value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} />

            <div style={labelStyle}>Montaj Elemanı</div>
            <input value={installerName} onChange={(e) => setInstallerName(e.target.value)} style={inputStyle} />

            <div style={labelStyle}>Montaj Elemanı Telefon</div>
            <input value={installerPhone} onChange={(e) => setInstallerPhone(e.target.value)} style={inputStyle} />

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
              <div>
                <div style={labelStyle}>Montaj Tarihi (zorunlu)</div>
                <input
                  type="date"
                  value={installDate}
                  onChange={(e) => setInstallDate(e.target.value)}
                  style={{ ...inputStyle, width: 220 }}
                />
              </div>

              <div>
                <div style={labelStyle}>Yapılan İş</div>
                <select
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value as JobType)}
                  style={{ ...inputStyle, width: 240, background: '#fff' }}
                >
                  <option value="MONTAJ">MONTAJ</option>
                  <option value="ARIZA">ARIZA</option>
                  <option value="BAKIM">BAKIM</option>
                  <option value="SATIS">EK ÜRÜN SATIŞI</option>
                </select>
              </div>
            </div>
          </div>

          <div style={card}>
            <h3 style={{ margin: 0, marginBottom: 10 }}>Ürün Detayları</h3>

            <div style={labelStyle}>Ürün Modeli</div>
            <input value={productModel} onChange={(e) => setProductModel(e.target.value)} style={inputStyle} />

            <div style={labelStyle}>Ölçüsü</div>
            <input value={size} onChange={(e) => setSize(e.target.value)} style={inputStyle} />

            <div style={labelStyle}>Motor</div>
            <input value={motor} onChange={(e) => setMotor(e.target.value)} style={inputStyle} />

            <div style={labelStyle}>Ek ürünler</div>
            <textarea
              value={extras}
              onChange={(e) => setExtras(e.target.value)}
              style={{ ...inputStyle, minHeight: 86, resize: 'vertical' }}
            />

            <div style={labelStyle}>Ödemeler</div>
            <textarea
              value={payments}
              onChange={(e) => setPayments(e.target.value)}
              style={{ ...inputStyle, minHeight: 86, resize: 'vertical' }}
            />
          </div>
        </div>

        {/* ✅ 2. Satır: Sözleşme + Konum (altına, yan yana) */}
        <div className="grid2" style={{ marginTop: 12 }}>
          <div style={card}>
            <h3 style={{ margin: 0, marginBottom: 10 }}>Sözleşme (PDF)</h3>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {contractPath ? (
                <>
                  <button type="button" onClick={() => openContract(contractPath)} style={softBtn}>
                    Mevcut Sözleşmeyi Aç
                  </button>

                  <button type="button" onClick={() => setContractPath(null)} style={softBtn}>
                    Sözleşmeyi Kaldır (link)
                  </button>

                  <span style={{ fontSize: 12, opacity: 0.75 }}>Path: {contractPath}</span>
                </>
              ) : (
                <span style={{ fontSize: 12, opacity: 0.75 }}>Bu kayıtta sözleşme yok.</span>
              )}
            </div>

            <div style={{ marginTop: 10 }}>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.type !== 'application/pdf') {
                    setErr('Lütfen sadece PDF seç.');
                    setNewContractFile(null);
                    return;
                  }
                  setErr('');
                  setNewContractFile(f);
                }}
              />
            </div>

            {newContractFile && (
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 8 }}>
                Yeni PDF seçildi: <b>{newContractFile.name}</b>{' '}
                <button type="button" onClick={() => setNewContractFile(null)} style={{ marginLeft: 8 }}>
                  Kaldır
                </button>
              </div>
            )}
          </div>

          {/* ✅ Konum: Harita + Arama + İşaretleme */}
          <div style={card}>
            <h3 style={{ margin: 0, marginBottom: 10 }}>Konum</h3>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                value={locQ}
                onChange={(e) => setLocQ(e.target.value)}
                placeholder="Adres/yer ara (örn: Çankaya Caddesi)"
                style={inputStyle}
              />
              <button type="button" onClick={searchLocation} style={softBtn} disabled={locLoading}>
                {locLoading ? 'Aranıyor...' : 'Ara'}
              </button>
            </div>

            {locResults.length > 0 && (
              <div style={{ marginTop: 10, maxHeight: 140, overflow: 'auto', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10 }}>
                {locResults.map((r, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const nextLat = Number(r.lat);
                      const nextLng = Number(r.lon);
                      setMapPoint(nextLat, nextLng);
                      setLocResults([]);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: 10,
                      border: 'none',
                      background: '#fff',
                      cursor: 'pointer',
                      borderBottom: idx === locResults.length - 1 ? 'none' : '1px solid rgba(0,0,0,0.06)',
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.9 }}>{r.display_name}</div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>({r.lat}, {r.lon})</div>
                  </button>
                ))}
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <div
                id="ek-map"
                style={{
                  height: 320,
                  borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.10)',
                  overflow: 'hidden',
                  background: '#f5f5f5',
                }}
              />
              {!leafletReady && (
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
                  Harita yüklenemedi. (Leaflet kurulumu/importe bak)
                </div>
              )}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
              Seçili: <b>{lat == null || lng == null ? '-' : `${lat.toFixed(6)}, ${lng.toFixed(6)}`}</b>
              <span style={{ marginLeft: 10, opacity: 0.75 }}>
                (Haritada tıkla veya marker’ı sürükle)
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                style={softBtn}
                onClick={() => {
                  // default Ankara merkez
                  const dLat = 39.9208;
                  const dLng = 32.8541;
                  setMapPoint(dLat, dLng);
                }}
              >
                Ankara (varsayılan)
              </button>

              <button
                type="button"
                style={softBtn}
                onClick={() => {
                  setLat(null);
                  setLng(null);
                }}
              >
                Konumu Temizle
              </button>
            </div>
          </div>
        </div>

        {/* ✅ Kaydet butonu */}
        <div style={{ marginTop: 12 }}>
          <button onClick={save} disabled={saving} style={{ ...primaryBtn, width: '100%' }}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        @media (max-width: 980px) {
          .grid2 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
