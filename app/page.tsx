'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

type JobType = 'MONTAJ' | 'ARIZA' | 'BAKIM' | 'SATIS';

type AssetRow = {
  uid: string;
  customer_name: string | null;
  customer_phone: string | null;
  product_type: string | null;
  install_date: string | null;
  job_type: JobType | null;
  warranty_end: string | null;
};

type WFilter = 'ALL' | 'EXPIRED' | 'DUE' | 'ACTIVE' | 'NODATE';

function warrantyDays(w: string | null) {
  if (!w) return null;
  const d = new Date(w);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function jobTypeText(v: JobType | null) {
  if (!v) return '-';
  if (v === 'SATIS') return 'EK ÜRÜN SATIŞI';
  return v;
}

export default function HomePage() {
  const [items, setItems] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filters (drawer içinde)
  const [q, setQ] = useState('');
  const [wFilter, setWFilter] = useState<WFilter>('ALL');
  const [dueDays, setDueDays] = useState<7 | 15 | 30 | 60>(30);
  const [jobFilter, setJobFilter] = useState<'ALL' | JobType>('ALL');

  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('assets')
        .select('uid, customer_name, customer_phone, product_type, install_date, job_type, warranty_end')
        .order('created_at', { ascending: false });

      if (!error) setItems((data ?? []) as AssetRow[]);
      setLoading(false);
    })();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function warrantyText(w: string | null) {
    const days = warrantyDays(w);
    if (days === null) return 'Tarih yok';
    if (days < 0) return 'GARANTİ BİTTİ';
    if (days <= dueDays) return `${days} gün kaldı`;
    return 'Aktif';
  }

  const stats = useMemo(() => {
    let total = items.length;
    let expired = 0;
    let due = 0;
    let active = 0;
    let nodate = 0;

    for (const r of items) {
      const days = warrantyDays(r.warranty_end);
      if (days === null) nodate++;
      else if (days < 0) expired++;
      else if (days <= dueDays) due++;
      else active++;
    }

    return { total, expired, due, active, nodate };
  }, [items, dueDays]);

  const filtered = items.filter((r) => {
    const s = q.trim().toLowerCase();
    const textOk =
      !s ||
      (r.uid ?? '').toLowerCase().includes(s) ||
      (r.customer_name ?? '').toLowerCase().includes(s) ||
      (r.customer_phone ?? '').toLowerCase().includes(s);

    if (!textOk) return false;

    if (jobFilter !== 'ALL') {
      if ((r.job_type ?? null) !== jobFilter) return false;
    }

    const days = warrantyDays(r.warranty_end);

    if (wFilter === 'ALL') return true;
    if (wFilter === 'NODATE') return days === null;
    if (days === null) return false;

    if (wFilter === 'EXPIRED') return days < 0;
    if (wFilter === 'DUE') return days >= 0 && days <= dueDays;
    if (wFilter === 'ACTIVE') return days > dueDays;

    return true;
  });

  const latest = useMemo(() => items.slice(0, 5), [items]);

  function DrawerButton(props: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
      <button
        onClick={props.onClick}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '10px 12px',
          border: '1px solid rgba(255,255,255,0.18)',
          background: props.active ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.10)',
          color: '#fff',
          borderRadius: 10,
          cursor: 'pointer',
        }}
      >
        {props.children}
      </button>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#4287F5',
        padding: 18,
        boxSizing: 'border-box',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: '#fff',
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Menü"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.28)',
            background: 'rgba(255,255,255,0.14)',
            color: '#fff',
            fontSize: 22,
            cursor: 'pointer',
          }}
        >
          ☰
        </button>

        <div style={{ fontWeight: 800, fontSize: 18 }}>Ekin Office Panel</div>

        <div style={{ marginLeft: 'auto', opacity: 0.9, fontSize: 13 }}>
          {loading ? 'Yükleniyor…' : `${items.length} kayıt`}
        </div>
      </div>

      {/* Main cards */}
      <div style={{ maxWidth: 1100, margin: '16px auto 0' }}>
        <div
          style={{
            background: 'rgba(255,255,255,0.14)',
            border: '1px solid rgba(255,255,255,0.24)',
            borderRadius: 18,
            padding: 16,
            color: '#fff',
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.9 }}>Ana Menü</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>Hızlı İşlemler</div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
              marginTop: 16,
            }}
          >
            <Link
              href="/new"
              style={{
                textDecoration: 'none',
                color: '#0b1b3a',
                background: '#fff',
                borderRadius: 18,
                padding: 18,
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.75 }}>Kayıt oluştur</div>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>+ Yeni Kayıt</div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.75 }}>
                Montaj / Arıza / Bakım / Satış
              </div>
            </Link>

            <Link
              href="/records"
              style={{
                textDecoration: 'none',
                color: '#0b1b3a',
                background: '#fff',
                borderRadius: 18,
                padding: 18,
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.75 }}>Liste ve arama</div>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>Kayıtlar</div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.75 }}>
                UID / Müşteri / Telefon
              </div>
            </Link>
          </div>

          <div style={{ marginTop: 14, fontSize: 12, opacity: 0.9 }}>
            Detaylar ve filtreler sol menüde.
          </div>
        </div>
      </div>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 50,
          }}
        />
      )}

      {/* Drawer */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          width: 360,
          transform: drawerOpen ? 'translateX(0)' : 'translateX(-110%)',
          transition: 'transform 180ms ease',
          background: '#2f63c2',
          zIndex: 60,
          padding: 14,
          paddingBottom: 28, // ✅ en alt kesilmesin
          boxSizing: 'border-box',
          color: '#fff',

          // ✅ SCROLL FIX
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Menü</div>
          <button
            onClick={() => setDrawerOpen(false)}
            style={{
              marginLeft: 'auto',
              width: 40,
              height: 40,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.22)',
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 18,
            }}
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          {/* Quick links */}
          <DrawerButton onClick={() => router.push('/new')}>+ Yeni Kayıt</DrawerButton>
          <DrawerButton onClick={() => router.push('/records')}>Kayıtlar (Liste)</DrawerButton>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.18)', margin: '6px 0' }} />

          {/* Filters */}
          <div style={{ fontWeight: 800, fontSize: 13, opacity: 0.95 }}>Arama</div>
          <input
            placeholder="UID / Müşteri / Telefon"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              padding: 10,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.22)',
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              outline: 'none',
            }}
          />

          <div style={{ fontWeight: 800, fontSize: 13, opacity: 0.95 }}>Yapılan İş</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <DrawerButton active={jobFilter === 'ALL'} onClick={() => setJobFilter('ALL')}>
              Hepsi
            </DrawerButton>
            <DrawerButton active={jobFilter === 'MONTAJ'} onClick={() => setJobFilter('MONTAJ')}>
              MONTAJ
            </DrawerButton>
            <DrawerButton active={jobFilter === 'ARIZA'} onClick={() => setJobFilter('ARIZA')}>
              ARIZA
            </DrawerButton>
            <DrawerButton active={jobFilter === 'BAKIM'} onClick={() => setJobFilter('BAKIM')}>
              BAKIM
            </DrawerButton>
            <DrawerButton active={jobFilter === 'SATIS'} onClick={() => setJobFilter('SATIS')}>
              EK ÜRÜN SATIŞI
            </DrawerButton>
          </div>

          <div style={{ fontWeight: 800, fontSize: 13, opacity: 0.95 }}>Garanti Eşiği</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[7, 15, 30, 60].map((n) => (
              <button
                key={n}
                onClick={() => setDueDays(n as 7 | 15 | 30 | 60)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.22)',
                  background: dueDays === n ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.10)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {n}g
              </button>
            ))}
          </div>

          <div style={{ fontWeight: 800, fontSize: 13, opacity: 0.95 }}>Garanti Özeti</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <DrawerButton active={wFilter === 'ALL'} onClick={() => setWFilter('ALL')}>
              Toplam: {stats.total}
            </DrawerButton>
            <DrawerButton active={wFilter === 'EXPIRED'} onClick={() => setWFilter('EXPIRED')}>
              Garanti Bitti: {stats.expired}
            </DrawerButton>
            <DrawerButton active={wFilter === 'DUE'} onClick={() => setWFilter('DUE')}>
              {dueDays} Gün İçinde: {stats.due}
            </DrawerButton>
            <DrawerButton active={wFilter === 'ACTIVE'} onClick={() => setWFilter('ACTIVE')}>
              Aktif: {stats.active}
            </DrawerButton>
            <DrawerButton active={wFilter === 'NODATE'} onClick={() => setWFilter('NODATE')}>
              Tarih Yok: {stats.nodate}
            </DrawerButton>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.18)', margin: '6px 0' }} />

          <div style={{ fontWeight: 800, fontSize: 13, opacity: 0.95 }}>Son Eklenen 5</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {latest.map((r) => (
              <Link
                key={r.uid}
                href={`/assets/${encodeURIComponent(r.uid)}`}
                style={{
                  textDecoration: 'none',
                  color: '#fff',
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: 'rgba(255,255,255,0.10)',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 13 }}>{r.uid}</div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  {jobTypeText(r.job_type)} • {r.customer_name ?? '-'}
                </div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>
                  {r.install_date ?? '-'} • {warrantyText(r.warranty_end)}
                </div>
              </Link>
            ))}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.18)', margin: '6px 0' }} />

          <DrawerButton onClick={logout}>Çıkış</DrawerButton>

          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 8 }}>
            Liste görünümü için “Kayıtlar” sayfasını aç.
          </div>
        </div>
      </div>

      {/* Small helper: filtered preview count (optional) */}
      <div
        style={{
          maxWidth: 1100,
          margin: '12px auto 0',
          color: 'rgba(255,255,255,0.92)',
          fontSize: 12,
          opacity: 0.95,
        }}
      >
        Filtreye göre eşleşen: <b>{filtered.length}</b>
      </div>
    </div>
  );
}
