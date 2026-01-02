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

export default function RecordsPage() {
  const [items, setItems] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [wFilter, setWFilter] = useState<WFilter>('ALL');
  const [dueDays, setDueDays] = useState<7 | 15 | 30 | 60>(30);
  const [jobFilter, setJobFilter] = useState<'ALL' | JobType>('ALL');

  const router = useRouter();

  async function load() {
    setLoading(true);

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
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function DueButton(props: { v: 7 | 15 | 30 | 60 }) {
    const active = dueDays === props.v;
    return (
      <button
        onClick={() => setDueDays(props.v)}
        style={{
          padding: '6px 10px',
          borderRadius: 12,
          border: '1px solid rgba(0,0,0,0.08)',
          background: active ? '#eef6ff' : '#fff',
          cursor: 'pointer',
        }}
      >
        {props.v} gün
      </button>
    );
  }

  function JobButton(props: { v: 'ALL' | JobType; label: string }) {
    const active = jobFilter === props.v;
    return (
      <button
        onClick={() => setJobFilter(props.v)}
        style={{
          padding: '6px 10px',
          borderRadius: 12,
          border: '1px solid rgba(0,0,0,0.08)',
          background: active ? '#eef6ff' : '#fff',
          cursor: 'pointer',
        }}
      >
        {props.label}
      </button>
    );
  }

  function StatChip(props: { label: string; active: boolean; onClick: () => void }) {
    return (
      <button
        onClick={props.onClick}
        style={{
          padding: '7px 10px',
          borderRadius: 999,
          border: '1px solid rgba(0,0,0,0.10)',
          background: props.active ? '#eef6ff' : '#fff',
          cursor: 'pointer',
        }}
      >
        {props.label}
      </button>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f6f8fb' }}>
      {/* Header */}
      <div
        style={{
          background: '#4287F5',
          color: '#fff',
          padding: '18px 18px 14px',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link
            href="/"
            style={{
              textDecoration: 'none',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.12)',
            }}
          >
            ← Ana Menü
          </Link>

          <div style={{ fontWeight: 900, fontSize: 18 }}>Kayıtlar</div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <button
              onClick={load}
              style={{
                padding: '8px 12px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Yenile
            </button>
            <button
              onClick={logout}
              style={{
                padding: '8px 12px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Çıkış
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 18 }}>
        <div
          style={{
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: 16,
            padding: 14,
          }}
        >
          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              placeholder="Ara: UID / Müşteri / Telefon"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{
                width: 340,
                padding: 10,
                borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.10)',
              }}
            />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Yapılan İş:</span>
              <JobButton v="ALL" label="Hepsi" />
              <JobButton v="MONTAJ" label="MONTAJ" />
              <JobButton v="ARIZA" label="ARIZA" />
              <JobButton v="BAKIM" label="BAKIM" />
              <JobButton v="SATIS" label="EK ÜRÜN SATIŞI" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Garanti Süresi:</span>
              <DueButton v={7} />
              <DueButton v={15} />
              <DueButton v={30} />
              <DueButton v={60} />
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatChip label={`Toplam: ${stats.total}`} active={wFilter === 'ALL'} onClick={() => setWFilter('ALL')} />
              <StatChip
                label={`Garanti Bitti: ${stats.expired}`}
                active={wFilter === 'EXPIRED'}
                onClick={() => setWFilter('EXPIRED')}
              />
              <StatChip
                label={`${dueDays} Gün İçinde: ${stats.due}`}
                active={wFilter === 'DUE'}
                onClick={() => setWFilter('DUE')}
              />
              <StatChip
                label={`Aktif: ${stats.active}`}
                active={wFilter === 'ACTIVE'}
                onClick={() => setWFilter('ACTIVE')}
              />
              <StatChip
                label={`Tarih Yok: ${stats.nodate}`}
                active={wFilter === 'NODATE'}
                onClick={() => setWFilter('NODATE')}
              />
            </div>
          </div>
        </div>

        <div style={{ height: 12 }} />

        {/* Table */}
        <div
          style={{
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: 16,
            padding: 10,
          }}
        >
          {loading ? (
            <p style={{ padding: 10 }}>Yükleniyor...</p>
          ) : (
            <table
              border={0}
              cellPadding={10}
              style={{ width: '100%', borderCollapse: 'collapse' }}
            >
              <thead>
                <tr style={{ background: '#f4f7ff' }}>
                  <th style={{ textAlign: 'left' }}>UID</th>
                  <th style={{ textAlign: 'left' }}>Yapılan İş</th>
                  <th style={{ textAlign: 'left' }}>Müşteri</th>
                  <th style={{ textAlign: 'left' }}>Telefon</th>
                  <th style={{ textAlign: 'left' }}>Ürün</th>
                  <th style={{ textAlign: 'left' }}>Montaj Tarihi</th>
                  <th style={{ textAlign: 'left' }}>Garanti</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.uid} style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <td>
                      <Link href={`/assets/${encodeURIComponent(r.uid)}`} style={{ fontWeight: 800 }}>
                        {r.uid}
                      </Link>
                    </td>
                    <td>{jobTypeText(r.job_type)}</td>
                    <td>{r.customer_name ?? '-'}</td>
                    <td>{r.customer_phone ?? '-'}</td>
                    <td>{r.product_type ?? '-'}</td>
                    <td>{r.install_date ?? '-'}</td>
                    <td>{warrantyText(r.warranty_end)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ padding: 12, opacity: 0.75 }}>Filtreye uygun kayıt bulunamadı.</div>
          )}
        </div>
      </div>
    </div>
  );
}
