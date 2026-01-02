'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type AssetRow = {
  uid: string;
  customer_name: string | null;
  customer_phone: string | null;
  product_type: string | null;
  address: string | null;
  installer_name: string | null;
  installer_phone: string | null;

  install_date: string | null;

  // ✅ Yeni: yapılan iş
  job_type: string | null;

  product_model: string | null;
  size: string | null;
  motor: string | null;
  extras: string | null;
  payments: string | null;

  warranty_end: string | null;

  latitude: number | null;
  longitude: number | null;

  created_at: string | null;

  // ✅ Yeni: sözleşme PDF path
  contract_pdf_path?: string | null;
};

type LogRow = {
  id: number;
  uid: string;
  action: string;
  note: string | null;
  photo_url: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  created_at: string | null;
};

function groupLogs(logs: LogRow[]) {
  const groups: Record<string, LogRow[]> = {
    MONTAJ: [],
    ARIZA: [],
    BAKIM: [],
    SATIS: [],
    DIGER: [],
  };

  for (const l of logs) {
    const a = (l.action || '').toUpperCase();
    if (groups[a]) groups[a].push(l);
    else groups.DIGER.push(l);
  }
  return groups;
}

function jobTypeText(v: string | null) {
  const t = (v ?? '').toUpperCase();
  if (t === 'MONTAJ') return 'MONTAJ';
  if (t === 'ARIZA') return 'ARIZA';
  if (t === 'BAKIM') return 'BAKIM';
  if (t === 'SATIS') return 'EK ÜRÜN SATIŞI';
  return v ?? '-';
}

export default function AssetDetailPage() {
  const params = useParams();
  const uid = useMemo(() => {
    const raw = params?.uid;
    const u = Array.isArray(raw) ? raw[0] : raw;
    return u ? decodeURIComponent(u) : '';
  }, [params]);

  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState<AssetRow | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [err, setErr] = useState('');

  // Rol: admin / office (Sil butonu için)
  const [role, setRole] = useState<'admin' | 'office' | null>(null);

  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string>('');

  async function openPhoto(path: string) {
    const signed = await supabase.storage.from('site-photos').createSignedUrl(path, 60 * 10);
    if (!signed.data?.signedUrl) return;

    setPhotoUrl(signed.data.signedUrl);
    setPhotoOpen(true);
  }

  // ✅ Yeni: sözleşme aç/indir
  async function openContract(path: string) {
    setErr('');
    const { data, error } = await supabase.storage.from('contracts').createSignedUrl(path, 60 * 10);

    if (error || !data?.signedUrl) {
      setErr(error?.message || 'Sözleşme açılamadı.');
      return;
    }

    window.open(data.signedUrl, '_blank');
  }

  // ✅ Yeni: Konumu haritada aç
  function openMap(lat: number, lng: number) {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank');
  }

  async function load() {
    setLoading(true);

    const a = await supabase.from('assets').select().eq('uid', uid).maybeSingle();

    if (!a.data) {
      setLoading(false);
      setAsset(null);
      return;
    }

    setAsset(a.data as any);

    const l = await supabase
      .from('logs')
      .select()
      .eq('uid', uid)
      .order('created_at', { ascending: false })
      .limit(200);

    setLogs(((l.data as any[]) ?? []) as any);
    setLoading(false);
  }

  async function loadLogs() {
    const l = await supabase
      .from('logs')
      .select()
      .eq('uid', uid)
      .order('created_at', { ascending: false })
      .limit(20);

    setLogs(((l.data as any[]) ?? []) as any);
  }

  async function deleteAsset() {
    if (!uid) return;
    const ok = confirm(`Bu kaydı sileceksin:\n${uid}\n\nDevam edilsin mi?`);
    if (!ok) return;

    setErr('');

    const { error: logErr } = await supabase.from('logs').delete().eq('uid', uid);
    if (logErr) {
      setErr('Log silme hatası: ' + logErr.message);
      return;
    }

    const { error: aErr } = await supabase.from('assets').delete().eq('uid', uid);
    if (aErr) {
      setErr('Kayıt silme hatası: ' + aErr.message);
      return;
    }

    window.location.href = '/';
  }

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        window.location.href = '/login';
        return;
      }

      // Rolü oku (profiles.user_id -> auth.users.id)
      try {
        const userId = sessionData.session.user.id;
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();
        if (!profErr) setRole((prof?.role as any) ?? null);
      } catch (_) {}

      await load();
    })();
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

  if (loading) {
    return <div style={{ padding: 20 }}>Yükleniyor...</div>;
  }

  if (!asset) {
    return (
      <div style={{ padding: 20 }}>
        <p>Kayıt bulunamadı: {uid}</p>
        <Link href="/">← Listeye dön</Link>
        {err && <p style={{ color: 'red' }}>{err}</p>}
      </div>
    );
  }

  const groups = groupLogs(logs);

  function LogTable({ rows }: { rows: LogRow[] }) {
    if (rows.length === 0) return <p style={{ margin: 0, fontSize: 13 }}>Kayıt yok.</p>;

    return (
      <table border={1} cellPadding={6} style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Not</th>
            <th>Foto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={(l as any).id ?? (l.created_at ?? Math.random())}>
              <td>{(l as any).created_at ?? '-'}</td>
              <td>{(l as any).note ?? ''}</td>
              <td>
                {(l as any).photo_url ? (
                  <button onClick={() => openPhoto((l as any).photo_url)}>Aç</button>
                ) : (
                  '-'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // ✅ Kart stili
  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: 12,
    padding: 14,
    boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
  };

  // ✅ Küçük tipografi
  const pStyle: React.CSSProperties = { margin: '6px 0', fontSize: 13, lineHeight: 1.35 };
  const h1Style: React.CSSProperties = { margin: 0, fontSize: 20 };
  const h2Style: React.CSSProperties = { margin: 0, fontSize: 18 };
  const h3Style: React.CSSProperties = { marginTop: 0, fontSize: 15 };

  const lat = (asset as any).latitude as number | null;
  const lng = (asset as any).longitude as number | null;
  const hasLoc = typeof lat === 'number' && typeof lng === 'number';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#4287F5',
        padding: 20,
      }}
    >
      {/* Üst bar */}
      <div
        style={{
          ...cardStyle,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          fontSize: 13,
        }}
      >
        <h1 style={h1Style}>UID: {(asset as any).uid}</h1>

        <Link href="/" style={{ marginLeft: 'auto', fontSize: 13 }}>
          ← Listeye dön
        </Link>

        <Link
          href={`/assets/${encodeURIComponent((asset as any).uid)}/edit`}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 10, fontSize: 13 }}
        >
          Düzenle
        </Link>

        <Link
          href={`/assets/${encodeURIComponent((asset as any).uid)}/new-log`}
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 10, fontSize: 13 }}
        >
          + Log Ekle
        </Link>

        <button onClick={load} style={{ padding: '8px 12px', borderRadius: 10, fontSize: 13 }}>
          Yenile
        </button>

        {role === 'admin' && (
          <button onClick={deleteAsset} style={{ padding: '8px 12px', borderRadius: 10, fontSize: 13 }}>
            Sil
          </button>
        )}
      </div>

      {err && (
        <div style={{ ...cardStyle, marginTop: 12 }}>
          <p style={{ color: 'red', margin: 0, fontSize: 13 }}>{err}</p>
        </div>
      )}

      {/* Genel + Ürün Detayları yan yana */}
      <div
        style={{
          marginTop: 12,
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(2, minmax(320px, 1fr))',
          alignItems: 'start',
        }}
      >
        <div style={cardStyle}>
          <h3 style={h3Style}>Genel</h3>

          <p style={pStyle}>
            <b>Yapılan İş:</b> {jobTypeText((asset as any).job_type)}
          </p>
          <p style={pStyle}>
            <b>Müşteri:</b> {(asset as any).customer_name ?? '-'}
          </p>
          <p style={pStyle}>
            <b>Telefon:</b> {(asset as any).customer_phone ?? '-'}
          </p>
          <p style={pStyle}>
            <b>Ürün Tipi:</b> {(asset as any).product_type ?? '-'}
          </p>
          <p style={pStyle}>
            <b>Adres:</b> {(asset as any).address ?? '-'}
          </p>
          <p style={pStyle}>
            <b>Montaj Elemanı:</b> {(asset as any).installer_name ?? '-'}
          </p>
          <p style={pStyle}>
            <b>Montaj Tel:</b> {(asset as any).installer_phone ?? '-'}
          </p>
          <p style={pStyle}>
            <b>Montaj Tarihi:</b> {(asset as any).install_date ?? '-'}
          </p>
          <p style={pStyle}>
            <b>Garanti Bitiş:</b> {(asset as any).warranty_end ?? '-'}
          </p>

          {/* ✅ Konum: Haritada Aç */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            <b style={{ fontSize: 13 }}>Konum:</b>
            {hasLoc ? (
              <>
                <button
                  onClick={() => openMap(lat!, lng!)}
                  style={{ padding: '6px 10px', cursor: 'pointer', borderRadius: 10, fontSize: 13 }}
                >
                  Haritada Aç
                </button>
                <span style={{ fontSize: 12, opacity: 0.75 }}>
                  ({lat}, {lng})
                </span>
              </>
            ) : (
              <span style={{ fontSize: 13 }}>-</span>
            )}
          </div>

          {/* Sözleşme PDF */}
          <p style={{ ...pStyle, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <b>Sözleşme (PDF):</b>{' '}
            {(asset as any).contract_pdf_path ? (
              <>
                <span style={{ fontSize: 12, opacity: 0.75 }}>{(asset as any).contract_pdf_path}</span>
                <button
                  onClick={() => openContract((asset as any).contract_pdf_path)}
                  style={{ padding: '6px 10px', cursor: 'pointer', borderRadius: 10, fontSize: 13 }}
                >
                  Aç / İndir
                </button>
              </>
            ) : (
              <span>-</span>
            )}
          </p>
        </div>

        <div style={cardStyle}>
          <h3 style={h3Style}>Ürün Detayları</h3>
          <p style={pStyle}>
            <b>Model:</b> {(asset as any).product_model ?? '-'}
          </p>
          <p style={pStyle}>
            <b>Ölçü:</b> {(asset as any).size ?? '-'}
          </p>
          <p style={pStyle}>
            <b>Motor:</b> {(asset as any).motor ?? '-'}
          </p>
          <p style={pStyle}>
            <b>Ek Ürünler:</b> {(asset as any).extras ?? '-'}
          </p>
          <p style={pStyle}>
            <b>Ödemeler:</b> {(asset as any).payments ?? '-'}
          </p>
        </div>
      </div>

      {/* Loglar */}
      <div style={{ marginTop: 16 }}>
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <h2 style={h2Style}>İş Türüne Göre Loglar</h2>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(2, minmax(340px, 1fr))',
            alignItems: 'start',
          }}
        >
          <div style={cardStyle}>
            <h3 style={h3Style}>MONTAJ ({groups.MONTAJ.length})</h3>
            <LogTable rows={groups.MONTAJ as any} />
          </div>

          <div style={cardStyle}>
            <h3 style={h3Style}>ARIZA ({groups.ARIZA.length})</h3>
            <LogTable rows={groups.ARIZA as any} />
          </div>

          <div style={cardStyle}>
            <h3 style={h3Style}>BAKIM ({groups.BAKIM.length})</h3>
            <LogTable rows={groups.BAKIM as any} />
          </div>

          <div style={cardStyle}>
            <h3 style={h3Style}>EK ÜRÜN SATIŞI ({groups.SATIS.length})</h3>
            <LogTable rows={groups.SATIS as any} />
          </div>

          {groups.DIGER.length > 0 && (
            <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
              <h3 style={h3Style}>DİĞER ({groups.DIGER.length})</h3>
              <LogTable rows={groups.DIGER as any} />
            </div>
          )}
        </div>
      </div>

      {photoOpen && (
        <div
          onClick={() => setPhotoOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', padding: 12, maxWidth: 900, width: '100%', borderRadius: 12 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
              <b>Foto</b>
              <button onClick={() => setPhotoOpen(false)}>Kapat</button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="photo" style={{ width: '100%' }} />
          </div>
        </div>
      )}

      {/* Responsive: dar ekranda kartlar alt alta */}
      <style jsx>{`
        @media (max-width: 920px) {
          div[style*='grid-template-columns: repeat(2, minmax(320px, 1fr))'] {
            grid-template-columns: 1fr !important;
          }
          div[style*='grid-template-columns: repeat(2, minmax(340px, 1fr))'] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
