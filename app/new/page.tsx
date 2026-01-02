'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

// ✅ Yeni: Harita picker
import MapPicker from '@/app/components/MapPicker';

type JobType = 'MONTAJ' | 'ARIZA' | 'BAKIM' | 'SATIS';

export default function NewAssetPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // ✅ UID prefix sabit
  const UID_PREFIX = 'EKINOTOMASYON-2026-06-';

  // ✅ Kullanıcı sadece suffix (rakam) girsin
  const [uidSuffix, setUidSuffix] = useState('');

  // UID tam hali (kaydedilecek)
  const fullUid = useMemo(() => `${UID_PREFIX}${uidSuffix}`, [uidSuffix]);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [productType, setProductType] = useState('');
  const [address, setAddress] = useState('');
  const [installerName, setInstallerName] = useState('');
  const [installerPhone, setInstallerPhone] = useState('');

  const [installDate, setInstallDate] = useState(''); // YYYY-MM-DD

  // ✅ Yeni: Yapılan iş seçimi
  const [jobType, setJobType] = useState<JobType>('MONTAJ');

  const [productModel, setProductModel] = useState('');
  const [size, setSize] = useState('');
  const [motor, setMotor] = useState('');
  const [extras, setExtras] = useState('');
  const [payments, setPayments] = useState('');

  // ✅ Yeni: Haritadan seçilen konum
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // ✅ Yeni: PDF sözleşme dosyası
  const [contractFile, setContractFile] = useState<File | null>(null);

  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        return;
      }
      setLoading(false);
    })();
  }, [router]);

  // ✅ Sadece rakam kabul etsin
  function onUidSuffixChange(v: string) {
    const digits = v.replace(/\D/g, ''); // rakam dışını at
    setUidSuffix(digits);
  }

  async function save() {
    setErr('');

    // ✅ Suffix zorunlu (prefix zaten sabit)
    if (!uidSuffix.trim()) {
      setErr('UID zorunlu. (Sadece sonuna numara girin)');
      return;
    }

    if (!installDate.trim()) {
      setErr('Montaj tarihi zorunlu.');
      return;
    }

    setSaving(true);

    // 1) PDF varsa önce Storage'a yükle
    let contractPdfPath: string | null = null;

    if (contractFile) {
      const cleanUid = fullUid.trim();
      const fileNameSafe = contractFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${cleanUid}/contract_${Date.now()}_${fileNameSafe}`;

      const { error: upErr } = await supabase.storage
        .from('contracts')
        .upload(path, contractFile, {
          upsert: true,
          contentType: 'application/pdf',
        });

      if (upErr) {
        setErr('PDF yüklenemedi: ' + upErr.message);
        setSaving(false);
        return;
      }

      contractPdfPath = path;
    }

    // 2) Asset kaydını oluştur
    const payload: any = {
      uid: fullUid.trim(),
      customer_name: customerName.trim() || null,
      customer_phone: customerPhone.trim() || null,
      product_type: productType.trim() || null,
      address: address.trim() || null,
      installer_name: installerName.trim() || null,
      installer_phone: installerPhone.trim() || null,

      install_date: installDate.trim(),

      // ✅ yapılan iş
      job_type: jobType,

      product_model: productModel.trim() || null,
      size: size.trim() || null,
      motor: motor.trim() || null,
      extras: extras.trim() || null,
      payments: payments.trim() || null,

      // ✅ Konum haritadan
      latitude: location ? location.lat : null,
      longitude: location ? location.lng : null,

      // ✅ sözleşme PDF path
      contract_pdf_path: contractPdfPath,
    };

    const { error } = await supabase.from('assets').insert(payload);

    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }

    router.push(`/assets/${encodeURIComponent(fullUid.trim())}`);
  }

  if (loading) return <div style={{ padding: 20 }}>Yükleniyor...</div>;

  return (
    // ✅ Arka plan
    <div style={{ minHeight: '100vh', background: '#4287F5', padding: 20 }}>
      {/* ✅ İçerik kartı */}
      <div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>Yeni Kayıt</h1>
          <Link href="/" style={{ marginLeft: 'auto' }}>
            ← Listeye dön
          </Link>
        </div>

        {err && <p style={{ color: 'red' }}>{err}</p>}

        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {/* ✅ UID label üstte */}
          <label style={{ fontSize: 12, opacity: 0.8 }}>UID (zorunlu)</label>

          {/* ✅ UID: Prefix sabit + suffix input */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              value={UID_PREFIX}
              readOnly
              style={{
                padding: 10,
                width: 260,
                background: '#f3f3f3',
                border: '1px solid #ddd',
                borderRadius: 10,
                fontFamily: 'monospace',
              }}
            />

            <input
              placeholder="Numara (örn: 0001)"
              value={uidSuffix}
              inputMode="numeric"
              onChange={(e) => onUidSuffixChange(e.target.value)}
              style={{
                padding: 10,
                flex: 1,
                border: '1px solid #ddd',
                borderRadius: 10,
                fontFamily: 'monospace',
              }}
            />
          </div>

          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Kaydedilecek UID: <b>{fullUid}</b>
          </div>

          <label style={{ fontSize: 12, opacity: 0.8 }}>Montaj Tarihi (zorunlu)</label>
          <input
            type="date"
            value={installDate}
            onChange={(e) => setInstallDate(e.target.value)}
            style={{ padding: 10, width: 220 }}
          />

          {/* ✅ Yapılan İş */}
          <label style={{ fontSize: 12, opacity: 0.8 }}>Yapılan İş</label>
          <select
            value={jobType}
            onChange={(e) => setJobType(e.target.value as JobType)}
            style={{ padding: 10, width: 240 }}
          >
            <option value="MONTAJ">MONTAJ</option>
            <option value="ARIZA">ARIZA</option>
            <option value="BAKIM">BAKIM</option>
            <option value="SATIS">EK ÜRÜN SATIŞI</option>
          </select>

          <input
            placeholder="Müşteri Adı"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            style={{ padding: 10 }}
          />
          <input
            placeholder="Müşteri Telefon"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            style={{ padding: 10 }}
          />
          <input
            placeholder="Ürün Tipi"
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
            style={{ padding: 10 }}
          />
          <input
            placeholder="Adres"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={{ padding: 10 }}
          />
          <input
            placeholder="Montaj Elemanı"
            value={installerName}
            onChange={(e) => setInstallerName(e.target.value)}
            style={{ padding: 10 }}
          />
          <input
            placeholder="Montaj Elemanı Telefon"
            value={installerPhone}
            onChange={(e) => setInstallerPhone(e.target.value)}
            style={{ padding: 10 }}
          />

          <hr />

          <h3 style={{ margin: '6px 0' }}>Ürün Detayları</h3>

          <input
            placeholder="Ürün Modeli"
            value={productModel}
            onChange={(e) => setProductModel(e.target.value)}
            style={{ padding: 10 }}
          />
          <input
            placeholder="Ölçüsü"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            style={{ padding: 10 }}
          />
          <input
            placeholder="Motor"
            value={motor}
            onChange={(e) => setMotor(e.target.value)}
            style={{ padding: 10 }}
          />

          <textarea
            placeholder="Ek ürünler (örn:fotosel, lamba, 10 adet kumanda.)"
            value={extras}
            onChange={(e) => setExtras(e.target.value)}
            style={{ padding: 10, minHeight: 80 }}
          />

          <textarea
            placeholder="Ödemeler"
            value={payments}
            onChange={(e) => setPayments(e.target.value)}
            style={{ padding: 10, minHeight: 80 }}
          />

          <hr />

          <h3 style={{ margin: '6px 0' }}>Sözleşme (PDF)</h3>

          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f && f.type !== 'application/pdf') {
                setErr('Lütfen sadece PDF seç.');
                setContractFile(null);
                return;
              }
              setErr('');
              setContractFile(f);
            }}
          />

          {contractFile && (
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              Seçilen: <b>{contractFile.name}</b>{' '}
              <button type="button" onClick={() => setContractFile(null)} style={{ marginLeft: 8 }}>
                Kaldır
              </button>
            </div>
          )}

          <hr />

          <h3 style={{ margin: '6px 0' }}>Konum (Haritadan Seç)</h3>

          <MapPicker value={location} onChange={setLocation} />

          {location && (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
              Seçilen: <b>{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</b>
              <button type="button" onClick={() => setLocation(null)} style={{ marginLeft: 10 }}>
                Temizle
              </button>
            </div>
          )}

          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: 10,
              cursor: 'pointer',
              background: '#0b3d91',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              marginTop: 6,
            }}
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
