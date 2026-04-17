'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { ROLE_DASHBOARDS } from '@/lib/types'
import { registerFCMToken } from '@/lib/fcm-registration'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) { setError(signInError.message); setLoading(false); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role) await registerFCMToken(user.id, profile.role)
      if (profile?.role) router.push(ROLE_DASHBOARDS[profile.role as keyof typeof ROLE_DASHBOARDS])
      else router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontFamily: "'Inter', sans-serif",
      background: '#f7faf7',
      position: 'relative',
      overflow: 'hidden',
      padding: '0 8vw',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Manrope:wght@400;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 48;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* Soft green background blobs */
        .bg-blob {
          position: fixed; border-radius: 50%;
          filter: blur(120px); pointer-events: none; z-index: 0;
        }
        .bg-blob-1 {
          width: 800px; height: 800px;
          top: -300px; left: -200px;
          background: radial-gradient(circle, rgba(0,69,13,0.06) 0%, transparent 70%);
        }
        .bg-blob-2 {
          width: 600px; height: 600px;
          bottom: -200px; right: 300px;
          background: radial-gradient(circle, rgba(46,125,50,0.05) 0%, transparent 70%);
        }
        .bg-blob-3 {
          width: 400px; height: 400px;
          top: 40%; right: 0;
          background: radial-gradient(circle, rgba(163,246,156,0.07) 0%, transparent 70%);
        }

        /* Left brand side */
        .brand-side {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding-right: 60px;
          position: relative;
          z-index: 1;
        }

        /* Glowing ring behind logo */
        .logo-glow {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 18px;
          margin-bottom: 32px;
          overflow: visible;
          padding-bottom: 8px;
        }
        .logo-glow::before {
          content: '';
          position: absolute;
          left: -20px; top: -20px;
          width: 120px; height: 120px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0,69,13,0.12) 0%, transparent 70%);
          animation: pulse 3s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.12); opacity: 0.7; }
        }

        /* Leaf icon shimmer */
        .leaf-icon {
          position: relative;
          font-size: 72px !important;
          color: #00450d;
          filter: drop-shadow(0 4px 24px rgba(0,69,13,0.3));
          animation: leafFloat 4s ease-in-out infinite;
          z-index: 1;
        }
        @keyframes leafFloat {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-8px) rotate(2deg); }
        }

        /* Brand name shimmer effect */
        .brand-name {
          font-family: 'Manrope', sans-serif;
          font-weight: 900;
          font-size: 58px;
          letter-spacing: -0.02em;
          line-height: 1.15;
          padding-bottom: 6px;
          background: linear-gradient(135deg, #00450d 0%, #1b5e20 40%, #43a047 70%, #00450d 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
          position: relative; z-index: 1;
        }
        @keyframes shimmer {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }

        /* Tagline */
        .tagline {
          font-size: 15px;
          color: #5a7a5a;
          line-height: 1.65;
          max-width: 520px;
          font-weight: 400;
          letter-spacing: 0.01em;
          white-space: nowrap;
        }

        /* Decorative line */
        .deco-line {
          width: 60px; height: 3px;
          background: linear-gradient(90deg, #00450d, #a3f69c);
          border-radius: 2px;
          margin: 28px 0;
        }

        /* Feature dots */
        .feature-item {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 12px;
        }
        .feature-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #00450d; flex-shrink: 0;
          box-shadow: 0 0 8px rgba(0,69,13,0.4);
        }

        /* LOGIN BOX */
        .login-box {
          position: relative; z-index: 1;
          width: 460px;
          flex-shrink: 0;
          background: white;
          border-radius: 24px;
          padding: 52px 48px;
          box-shadow:
            0 0 0 1px rgba(0,69,13,0.06),
            0 8px 32px rgba(0,0,0,0.06),
            0 32px 80px rgba(0,69,13,0.08),
            0 2px 8px rgba(0,0,0,0.04);
        }

        /* Subtle top border accent */
        .login-box::before {
          content: '';
          position: absolute;
          top: 0; left: 48px; right: 48px;
          height: 3px;
          background: linear-gradient(90deg, #00450d, #43a047, #a3f69c);
          border-radius: 0 0 3px 3px;
        }

        /* Inputs */
        .form-input {
          width: 100%;
          border: 1.5px solid #e4ede4;
          border-radius: 12px;
          padding: 15px 48px 15px 46px;
          font-size: 15px;
          color: #181c22;
          font-family: 'Inter', sans-serif;
          transition: all 0.2s ease;
          outline: none;
          background: #f9fbf9;
        }
        .form-input:focus {
          border-color: #00450d;
          background: white;
          box-shadow: 0 0 0 3px rgba(0,69,13,0.07);
        }
        .form-input::placeholder { color: #c0ccc0; }

        .sign-in-btn {
          width: 100%;
          background: linear-gradient(135deg, #00450d 0%, #1b5e20 100%);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 16px;
          font-family: 'Manrope', sans-serif;
          font-weight: 700;
          font-size: 15px;
          letter-spacing: 0.03em;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 16px rgba(0,69,13,0.2);
        }
        .sign-in-btn:hover:not(:disabled) {
          box-shadow: 0 8px 28px rgba(0,69,13,0.35);
          transform: translateY(-1px);
        }
        .sign-in-btn:active:not(:disabled) { transform: translateY(0); }
        .sign-in-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .input-icon {
          position: absolute; left: 15px; top: 50%; transform: translateY(-50%);
          color: #a8b8a8; pointer-events: none;
          display: flex; align-items: center;
        }
        .input-icon .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
          font-size: 19px !important;
        }
        .toggle-btn {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: #a8b8a8; display: flex; align-items: center;
          transition: color 0.2s; padding: 2px;
        }
        .toggle-btn .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
          font-size: 19px !important;
        }
        .toggle-btn:hover { color: #00450d; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fu { animation: fadeUp 0.65s cubic-bezier(0.16,1,0.3,1) both; }
        .fu-0 { animation-delay: 0.0s; }
        .fu-1 { animation-delay: 0.1s; }
        .fu-2 { animation-delay: 0.18s; }
        .fu-3 { animation-delay: 0.26s; }
        .fu-4 { animation-delay: 0.34s; }
        .fu-5 { animation-delay: 0.42s; }
        .fu-6 { animation-delay: 0.50s; }
        .fu-7 { animation-delay: 0.58s; }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 900px) {
          .brand-side { display: none; }
          .login-box { width: 100%; max-width: 460px; }
          body { justify-content: center; padding: 24px; }
        }
      `}</style>

      <div className="bg-blob bg-blob-1" />
      <div className="bg-blob bg-blob-2" />
      <div className="bg-blob bg-blob-3" />

      {/* ── LEFT: BRAND ── */}
      <div className="brand-side fu fu-0">
        {/* Logo + Name */}
        <div className="logo-glow">
          <span className="material-symbols-outlined leaf-icon">eco</span>
          <span className="brand-name">EcoLedger</span>
        </div>

        {/* Tagline */}
        <p className="tagline">
          Blockchain-Integrated Smart Waste Management System for Sri Lanka.
        </p>

        {/* Decorative line */}
        <div className="deco-line" />

        {/* Feature list */}
        {[
          'Polygon Amoy blockchain verification',
          'Real-time GPS vehicle tracking',
          'Smart exception alerts & notifications',
          'Automated billing & PayHere payments',
        ].map(f => (
          <div key={f} className="feature-item">
            <div className="feature-dot" />
            <span style={{ fontSize: '14px', color: '#5a7a5a', fontWeight: 500 }}>{f}</span>
          </div>
        ))}


      </div>

      {/* ── RIGHT: LOGIN BOX ── */}
      <div className="login-box">

        {/* Welcome */}
        <div className="fu fu-1" style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 900,
            fontSize: '34px',
            color: '#00450d',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            marginBottom: '6px',
          }}>
            Welcome back
          </h2>
          <p style={{ fontSize: '14px', color: '#94a8a4', fontWeight: 400 }}>
            Sign in to continue to your dashboard
          </p>
        </div>

        <form onSubmit={handleLogin}>

          {/* Email */}
          <div className="fu fu-2" style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block', fontSize: '13px', fontWeight: 700,
              color: '#2d3d2d', marginBottom: '8px', fontFamily: 'Manrope, sans-serif',
            }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <span className="input-icon">
                <span className="material-symbols-outlined">mail</span>
              </span>
              <input
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="form-input"
              />
            </div>
          </div>

          {/* Password */}
          <div className="fu fu-3" style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#2d3d2d', fontFamily: 'Manrope, sans-serif' }}>
                Password
              </label>
              <a href="#" style={{ fontSize: '12px', color: '#00450d', fontWeight: 600, textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                Forgot password?
              </a>
            </div>
            <div style={{ position: 'relative' }}>
              <span className="input-icon">
                <span className="material-symbols-outlined">lock</span>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="form-input"
              />
              <button type="button" className="toggle-btn" onClick={() => setShowPassword(!showPassword)}>
                <span className="material-symbols-outlined">
                  {showPassword ? 'visibility' : 'visibility_off'}
                </span>
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 14px', borderRadius: '10px',
              margin: '12px 0',
              background: 'rgba(186,26,26,0.06)',
              border: '1px solid rgba(186,26,26,0.15)',
              color: '#ba1a1a', fontSize: '14px',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', flexShrink: 0 }}>error</span>
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="fu fu-4" style={{ marginTop: '28px' }}>
            <button type="submit" disabled={loading} className="sign-in-btn">
              {loading ? (
                <>
                  <svg style={{ width: '18px', height: '18px', animation: 'spin 0.8s linear infinite' }} fill="none" viewBox="0 0 24 24">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="fu fu-5" style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '28px 0' }}>
          <div style={{ flex: 1, height: '1px', background: '#edf2ed' }} />
          <span style={{ fontSize: '12px', color: '#b8c8b8', fontWeight: 500 }}>or</span>
          <div style={{ flex: 1, height: '1px', background: '#edf2ed' }} />
        </div>

        {/* Register */}
        <div className="fu fu-6" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: '#94a8a4' }}>
            Don't have an account?{' '}
            <Link href="/register" style={{ color: '#00450d', fontWeight: 700, textDecoration: 'none', fontFamily: 'Manrope, sans-serif', fontSize: '14px' }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
              Register here
            </Link>
          </p>
        </div>

        {/* Footer */}
        <div className="fu fu-7" style={{ marginTop: '24px', textAlign: 'center' }}>
        </div>
      </div>
    </div>
  )
}