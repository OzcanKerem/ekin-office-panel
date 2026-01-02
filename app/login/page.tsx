'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function login() {
    setErr('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) setErr(error.message);
    else router.push('/');
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        // ✅ Arka plan görseli
        backgroundImage: "url('/login-bg.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* ✅ Overlay (yazılar kaybolmasın diye) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(11, 27, 58, 0.58)',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'rgba(255,255,255,0.14)',
          border: '1px solid rgba(255,255,255,0.28)',
          borderRadius: 20,
          padding: 18,
          boxSizing: 'border-box',
          color: '#fff',
          position: 'relative',
          zIndex: 1,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
          <img
            src="/ekin-logo.png"
            alt="Ekin Logo"
            width={120}
            height={120}
            style={{
              borderRadius: 18,
              background: 'rgba(255,255,255,0.10)',
              padding: 10,
              border: '1px solid rgba(255,255,255,0.22)',
            }}
          />
        </div>

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Ekin Office Panel</div>
          <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 4 }}>
            Lütfen hesabınızla giriş yapın
          </div>
        </div>

        {/* Form */}
        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          <label style={{ fontSize: 12, opacity: 0.9 }}>Email</label>
          <input
            placeholder="ornek@firma.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.22)',
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          <label style={{ fontSize: 12, opacity: 0.9 }}>Şifre</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') login();
            }}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.22)',
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          <button
            onClick={login}
            disabled={loading}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 14,
              border: '1px solid rgba(0,0,0,0.06)',
              background: '#ffffff',
              color: '#0b1b3a',
              fontWeight: 900,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 6,
            }}
          >
            {loading ? 'Giriş yapılıyor…' : 'Giriş'}
          </button>

          {err && (
            <div
              style={{
                marginTop: 4,
                padding: 10,
                borderRadius: 12,
                background: 'rgba(255,0,0,0.12)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: '#fff',
                fontSize: 12.5,
              }}
            >
              {err}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11.5, opacity: 0.85 }}>
          © {new Date().getFullYear()} Ekin Automation Door Systems. All rights reserved.
        </div>
      </div>
    </div>
  );
}
