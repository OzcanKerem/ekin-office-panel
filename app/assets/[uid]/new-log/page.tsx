'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useParams, useRouter } from 'next/navigation';

type ActionType = 'MONTAJ' | 'ARIZA' | 'BAKIM' | 'SATIS';

export default function NewLogPage() {
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

  const [action, setAction] = useState<ActionType>('ARIZA');
  const [note, setNote] = useState('');

  async function init() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.push('/login');
      return;
    }
    setLoading(false);
  }

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!uid) return;
    setErr('');

    if (!note.trim()) {
      setErr('Not boş olamaz.');
      return;
    }

    setSaving(true);

    const payload = {
      uid,
      action,
      note: note.trim(),
      // Foto ve gps şimdilik yok (istersen 2. turda ekleriz)
    };

    const { error } = await supabase.from('logs').insert(payload);

    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }

    router.push(`/assets/${encodeURIComponent(uid)}`);
  }

  if (!uid) {
    return (
      <div style={{ padding: 20 }}>
        <p>UID okunamadı.</p>
        <Link href="/">← Listeye dön</Link>
      </div>
    );
  }

  if (loading) return <div style={{ padding: 20 }}>Yükleniyor...</div>;

  return (
    <div style={{ padding: 20, maxWidth: 700 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Log Ekle</h1>

        <Link href={`/assets/${encodeURIComponent(uid)}`} style={{ marginLeft: 'auto' }}>
          ← Detaya dön
        </Link>
      </div>

      {err && <p style={{ color: 'red' }}>{err}</p>}

      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <label style={{ fontSize: 12, opacity: 0.8 }}>İş Türü</label>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as ActionType)}
          style={{ padding: 10, width: 220 }}
        >
          <option value="MONTAJ">MONTAJ</option>
          <option value="ARIZA">ARIZA</option>
          <option value="BAKIM">BAKIM</option>
          <option value="SATIS">EK ÜRÜN SATIŞI</option>
        </select>

        <label style={{ fontSize: 12, opacity: 0.8 }}>Not</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Yapılan işlem / açıklama"
          style={{ padding: 10, minHeight: 120 }}
        />

        <button onClick={save} disabled={saving} style={{ padding: 10, cursor: 'pointer' }}>
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
}
