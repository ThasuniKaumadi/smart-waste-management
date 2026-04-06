'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  ROLE_DASHBOARDS,
  ROLE_LABELS,
  PUBLIC_ROLES,
  type UserRole
} from '@/lib/types'
import WardSelector from '@/components/WardSelector'

const ROLE_ICONS_MATERIAL: Record<string, string> = {
  resident: 'home',
  commercial_establishment: 'storefront',
}

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '' as UserRole | '',
    district: '',
    ward: '',
    address: '',
    phone: '',
    billing_cycle: 'monthly',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    if (!formData.role) { setError('Please select a role'); setLoading(false); return }
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); setLoading(false); return }
    if (!formData.ward) { setError('Please select your ward'); setLoading(false); return }

    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
    })
    if (signUpError) { setError(signUpError.message); setLoading(false); return }

    if (data.user) {
      const fullName = formData.role === 'commercial_establishment'
        ? formData.companyName
        : `${formData.firstName} ${formData.lastName}`.trim()

      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        role: formData.role,
        district: formData.district,
        ward: formData.ward,
        address: formData.address,
        organisation_name: formData.role === 'commercial_establishment' ? formData.companyName : null,
        phone: formData.phone,
        is_approved: true,
        billing_cycle: formData.role === 'commercial_establishment' ? formData.billing_cycle : null,
        billing_cycle_effective_from: formData.role === 'commercial_establishment' ? new Date().toISOString().split('T')[0] : null,
      })
      if (profileError) { setError(profileError.message); setLoading(false); return }
      router.push(ROLE_DASHBOARDS[formData.role as UserRole])
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', width: '100vw',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontFamily: "'Inter', sans-serif", background: '#f7faf7',
      position: 'relative', overflow: 'hidden', padding: '0 8vw',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Manrope:wght@400;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 48;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        * { box-sizing: border-box; }

        .bg-blob { position: fixed; border-radius: 50%; filter: blur(120px); pointer-events: none; z-index: 0; }
        .bg-blob-1 { width: 800px; height: 800px; top: -300px; left: -200px; background: radial-gradient(circle, rgba(0,69,13,0.06) 0%, transparent 70%); }
        .bg-blob-2 { width: 600px; height: 600px; bottom: -200px; right: 300px; background: radial-gradient(circle, rgba(46,125,50,0.05) 0%, transparent 70%); }
        .bg-blob-3 { width: 400px; height: 400px; top: 40%; right: 0; background: radial-gradient(circle, rgba(163,246,156,0.07) 0%, transparent 70%); }

        .brand-side {
          flex: 1; display: flex; flex-direction: column;
          justify-content: center; padding-right: 60px;
          position: relative; z-index: 1;
        }
        .logo-glow {
          position: relative; display: inline-flex;
          align-items: center; gap: 18px; margin-bottom: 32px;
          overflow: visible; padding-bottom: 8px;
        }
        .logo-glow::before {
          content: ''; position: absolute; left: -20px; top: -20px;
          width: 120px; height: 120px; border-radius: 50%;
          background: radial-gradient(circle, rgba(0,69,13,0.12) 0%, transparent 70%);
          animation: pulse 3s ease-in-out infinite;
        }
        @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.12); opacity: 0.7; } }
        .leaf-icon { font-size: 72px !important; color: #00450d; filter: drop-shadow(0 4px 24px rgba(0,69,13,0.3)); animation: leafFloat 4s ease-in-out infinite; z-index: 1; }
        @keyframes leafFloat { 0%, 100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-8px) rotate(2deg); } }
        .brand-name {
          font-family: 'Manrope', sans-serif; font-weight: 900; font-size: 58px;
          letter-spacing: -0.02em; line-height: 1.15; padding-bottom: 6px;
          background: linear-gradient(135deg, #00450d 0%, #1b5e20 40%, #43a047 70%, #00450d 100%);
          background-size: 200% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          animation: shimmer 4s linear infinite; position: relative; z-index: 1;
        }
        @keyframes shimmer { 0% { background-position: 0% center; } 100% { background-position: 200% center; } }
        .tagline { font-size: 15px; color: #5a7a5a; line-height: 1.65; font-weight: 400; letter-spacing: 0.01em; }
        .deco-line { width: 60px; height: 3px; background: linear-gradient(90deg, #00450d, #a3f69c); border-radius: 2px; margin: 28px 0; }
        .feature-item { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .feature-dot { width: 7px; height: 7px; border-radius: 50%; background: #00450d; flex-shrink: 0; box-shadow: 0 0 8px rgba(0,69,13,0.4); }

        .register-box {
          position: relative; z-index: 1; width: 500px; flex-shrink: 0;
          background: white; border-radius: 24px; padding: 48px 44px;
          box-shadow: 0 0 0 1px rgba(0,69,13,0.06), 0 8px 32px rgba(0,0,0,0.06), 0 32px 80px rgba(0,69,13,0.08);
          max-height: 92vh; overflow-y: auto;
          scrollbar-width: thin; scrollbar-color: #e0ede0 transparent;
        }
        .register-box::before {
          content: ''; position: absolute; top: 0; left: 48px; right: 48px; height: 3px;
          background: linear-gradient(90deg, #00450d, #43a047, #a3f69c);
          border-radius: 0 0 3px 3px;
        }

        .role-card {
          border: 1.5px solid #e8ede8; border-radius: 14px;
          padding: 16px; cursor: pointer; transition: all 0.2s ease; background: #fafcfa;
        }
        .role-card:hover { border-color: rgba(0,69,13,0.3); background: white; transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,69,13,0.08); }
        .role-card.selected { border-color: #00450d; background: white; box-shadow: 0 0 0 3px rgba(0,69,13,0.07), 0 4px 16px rgba(0,69,13,0.1); }

        .form-input {
          width: 100%; border: 1.5px solid #e4ede4; border-radius: 10px;
          padding: 13px 44px 13px 42px; font-size: 14px; color: #181c22;
          font-family: 'Inter', sans-serif; transition: all 0.2s ease; outline: none; background: #f9fbf9;
        }
        .form-input:focus { border-color: #00450d; background: white; box-shadow: 0 0 0 3px rgba(0,69,13,0.07); }
        .form-input::placeholder { color: #c0ccc0; }

        .form-input-plain {
          width: 100%; border: 1.5px solid #e4ede4; border-radius: 10px;
          padding: 13px 16px; font-size: 14px; color: #181c22;
          font-family: 'Inter', sans-serif; transition: all 0.2s ease; outline: none; background: #f9fbf9;
        }
        .form-input-plain:focus { border-color: #00450d; background: white; box-shadow: 0 0 0 3px rgba(0,69,13,0.07); }
        .form-input-plain::placeholder { color: #c0ccc0; }

        .submit-btn {
          width: 100%; background: linear-gradient(135deg, #00450d 0%, #1b5e20 100%);
          color: white; border: none; border-radius: 10px; padding: 15px;
          font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 15px;
          letter-spacing: 0.03em; cursor: pointer; transition: all 0.2s ease;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 16px rgba(0,69,13,0.2);
        }
        .submit-btn:hover:not(:disabled) { box-shadow: 0 8px 28px rgba(0,69,13,0.35); transform: translateY(-1px); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .input-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #a8b8a8; pointer-events: none; display: flex; align-items: center; }
        .input-icon .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24; font-size: 18px !important; }
        .toggle-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #a8b8a8; display: flex; align-items: center; transition: color 0.2s; padding: 2px; }
        .toggle-btn .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24; font-size: 18px !important; }
        .toggle-btn:hover { color: #00450d; }

        .field-label { display: block; font-size: 12px; font-weight: 700; color: #2d3d2d; margin-bottom: 7px; font-family: 'Manrope', sans-serif; }

        .step-dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; font-family: 'Manrope', sans-serif; transition: all 0.3s ease; flex-shrink: 0; }
        .step-dot.active { background: #00450d; color: white; }
        .step-dot.done { background: #2e7d32; color: white; }
        .step-dot.pending { background: #f0f4f0; color: #a8b8a8; border: 1.5px solid #e4ede4; }

        @keyframes stepSlide { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
        .step-enter { animation: stepSlide 0.3s cubic-bezier(0.16,1,0.3,1) both; }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .fu { animation: fadeUp 0.65s cubic-bezier(0.16,1,0.3,1) both; }
        .fu-0 { animation-delay: 0.0s; }
        .fu-1 { animation-delay: 0.08s; }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 900px) {
          .brand-side { display: none; }
          .register-box { width: 100%; max-width: 500px; }
        }
      `}</style>

      <div className="bg-blob bg-blob-1" />
      <div className="bg-blob bg-blob-2" />
      <div className="bg-blob bg-blob-3" />

      {/* LEFT — Brand */}
      <div className="brand-side fu fu-0">
        <div className="logo-glow">
          <span className="material-symbols-outlined leaf-icon">eco</span>
          <span className="brand-name">EcoLedger</span>
        </div>
        <p className="tagline">Blockchain-Integrated Smart Waste Management System for Sri Lanka.</p>
        <div className="deco-line" />
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

      {/* RIGHT — Register box */}
      <div className="register-box fu fu-1">

        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 900, fontSize: '32px', color: '#00450d', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '4px' }}>
            Create Account
          </h2>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <div className={`step-dot ${step > 1 ? 'done' : 'active'}`}>{step > 1 ? '✓' : '1'}</div>
          <div style={{ flex: 1, height: '2px', borderRadius: '1px', transition: 'background 0.4s', background: step > 1 ? '#00450d' : '#e4ede4' }} />
          <div className={`step-dot ${step === 2 ? 'active' : 'pending'}`}>2</div>
          <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: '#94a8a4', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {step === 1 ? 'Select Role' : 'Your Details'}
          </span>
        </div>

        {/* STEP 1 — Role selection */}
        {step === 1 && (
          <div className="step-enter">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              {PUBLIC_ROLES.map(role => (
                <div key={role}
                  onClick={() => setFormData({ ...formData, role })}
                  className={`role-card ${formData.role === role ? 'selected' : ''}`}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                      background: formData.role === role ? 'rgba(0,69,13,0.08)' : '#f0f4f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.2s',
                    }}>
                      <span className="material-symbols-outlined" style={{
                        fontSize: '22px',
                        color: formData.role === role ? '#00450d' : '#94a894',
                        fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                      }}>
                        {ROLE_ICONS_MATERIAL[role]}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', marginBottom: '4px' }}>
                        <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '13px', color: formData.role === role ? '#00450d' : '#181c22' }}>
                          {ROLE_LABELS[role]}
                        </h3>
                        {formData.role === role && (
                          <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#00450d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg style={{ width: '10px', height: '10px' }} fill="none" stroke="white" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <p style={{ fontSize: '12px', color: formData.role === role ? 'rgba(0,69,13,0.6)' : '#94a894', lineHeight: 1.4 }}>
                        {role === 'resident' ? 'Register as a household resident' : 'Register as a business or company'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', borderRadius: '10px', marginBottom: '16px', background: 'rgba(186,26,26,0.06)', border: '1px solid rgba(186,26,26,0.15)', color: '#ba1a1a', fontSize: '14px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', flexShrink: 0, fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}>error</span>
                {error}
              </div>
            )}

            <button
              onClick={() => { if (!formData.role) { setError('Please select an account type'); return } setError(''); setStep(2) }}
              className="submit-btn">
              Continue
              <span className="material-symbols-outlined" style={{ fontSize: '20px', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}>arrow_forward</span>
            </button>
          </div>
        )}

        {/* STEP 2 — Details */}
        {step === 2 && (
          <form onSubmit={handleRegister} className="step-enter" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Role badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', background: '#f0faf0', border: '1px solid rgba(0,69,13,0.12)', marginBottom: '4px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'rgba(0,69,13,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#00450d', fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                  {ROLE_ICONS_MATERIAL[formData.role as string]}
                </span>
              </div>
              <p style={{ flex: 1, fontSize: '14px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: '#00450d' }}>
                {ROLE_LABELS[formData.role as UserRole]}
              </p>
              <button type="button" onClick={() => setStep(1)}
                style={{ fontSize: '12px', fontWeight: 600, color: '#94a8a4', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                Change
              </button>
            </div>

            {/* Name fields */}
            {formData.role === 'resident' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="field-label">First Name</label>
                  <div style={{ position: 'relative' }}>
                    <span className="input-icon"><span className="material-symbols-outlined">person</span></span>
                    <input className="form-input" placeholder="First name"
                      value={formData.firstName}
                      onChange={e => setFormData({ ...formData, firstName: e.target.value })} required />
                  </div>
                </div>
                <div>
                  <label className="field-label">Last Name</label>
                  <div style={{ position: 'relative' }}>
                    <span className="input-icon"><span className="material-symbols-outlined">person</span></span>
                    <input className="form-input" placeholder="Last name"
                      value={formData.lastName}
                      onChange={e => setFormData({ ...formData, lastName: e.target.value })} required />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="field-label">Business / Company Name</label>
                <div style={{ position: 'relative' }}>
                  <span className="input-icon"><span className="material-symbols-outlined">storefront</span></span>
                  <input className="form-input" placeholder="Your business or company name"
                    value={formData.companyName}
                    onChange={e => setFormData({ ...formData, companyName: e.target.value })} required />
                </div>
              </div>
            )}

            {/* Email + Phone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="field-label">Email</label>
                <div style={{ position: 'relative' }}>
                  <span className="input-icon"><span className="material-symbols-outlined">mail</span></span>
                  <input type="email" className="form-input" placeholder="Enter your email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="field-label">Phone</label>
                <div style={{ position: 'relative' }}>
                  <span className="input-icon"><span className="material-symbols-outlined">phone</span></span>
                  <input className="form-input" placeholder="+94 77 000 0000"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Password */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="field-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <span className="input-icon"><span className="material-symbols-outlined">lock</span></span>
                  <input type={showPassword ? 'text' : 'password'} className="form-input"
                    placeholder="Min. 8 characters" value={formData.password} minLength={8}
                    onChange={e => setFormData({ ...formData, password: e.target.value })} required />
                  <button type="button" className="toggle-btn" onClick={() => setShowPassword(!showPassword)}>
                    <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="field-label">Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <span className="input-icon"><span className="material-symbols-outlined">lock</span></span>
                  <input type={showConfirm ? 'text' : 'password'} className="form-input"
                    placeholder="Repeat password" value={formData.confirmPassword}
                    onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} required />
                  <button type="button" className="toggle-btn" onClick={() => setShowConfirm(!showConfirm)}>
                    <span className="material-symbols-outlined">{showConfirm ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Ward selector */}
            <div>
              <label className="field-label">Ward *</label>
              <WardSelector
                value={formData.ward}
                onChange={(ward, district) => setFormData({ ...formData, ward, district })}
                placeholder="Search your ward..."
              />
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '5px', fontFamily: 'Inter, sans-serif' }}>
                Start typing your ward name — district will auto-fill
              </p>
            </div>

            {/* District auto-fill badge */}
            {formData.district && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.1)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#00450d', fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>
                  location_on
                </span>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#00450d', fontFamily: 'Manrope, sans-serif' }}>
                    District Auto-filled
                  </p>
                  <p style={{ fontSize: '13px', color: '#41493e' }}>{formData.district}</p>
                </div>
              </div>
            )}

            {/* Address */}
            <div>
              <label className="field-label">Address</label>
              <input className="form-input-plain" placeholder="Your full address"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })} />
            </div>
            {/* Billing cycle — commercial only */}
            {formData.role === 'commercial_establishment' && (
              <div>
                <label className="field-label">Billing Cycle *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {[
                    {
                      value: 'monthly',
                      label: 'Monthly',
                      icon: 'calendar_today',
                      desc: 'Billed every month. Pay in smaller amounts.',
                    },
                    {
                      value: 'quarterly',
                      label: 'Quarterly',
                      icon: 'date_range',
                      desc: 'Billed every 3 months. Less frequent payments.',
                    },
                  ].map(opt => (
                    <div key={opt.value}
                      onClick={() => setFormData({ ...formData, billing_cycle: opt.value })}
                      style={{
                        border: `1.5px solid ${formData.billing_cycle === opt.value ? '#00450d' : '#e4ede4'}`,
                        borderRadius: '12px', padding: '14px', cursor: 'pointer',
                        background: formData.billing_cycle === opt.value ? '#f0fdf4' : '#fafcfa',
                        transition: 'all 0.2s ease',
                        boxShadow: formData.billing_cycle === opt.value ? '0 0 0 3px rgba(0,69,13,0.07)' : 'none',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: formData.billing_cycle === opt.value ? 'rgba(0,69,13,0.1)' : '#f0f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: formData.billing_cycle === opt.value ? '#00450d' : '#94a894' }}>
                              {opt.icon}
                            </span>
                          </div>
                          <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '13px', color: formData.billing_cycle === opt.value ? '#00450d' : '#181c22' }}>
                            {opt.label}
                          </span>
                        </div>
                        {formData.billing_cycle === opt.value && (
                          <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#00450d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg style={{ width: '10px', height: '10px' }} fill="none" stroke="white" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <p style={{ fontSize: '11px', color: formData.billing_cycle === opt.value ? 'rgba(0,69,13,0.6)' : '#94a894', lineHeight: 1.4, margin: 0 }}>
                        {opt.desc}
                      </p>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px', fontFamily: 'Inter, sans-serif' }}>
                  You can request a change later from your billing dashboard.
                </p>
              </div>
            )}
            {/* Error */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(186,26,26,0.06)', border: '1px solid rgba(186,26,26,0.15)', color: '#ba1a1a', fontSize: '14px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', flexShrink: 0, fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}>error</span>
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} className="submit-btn" style={{ marginTop: '8px' }}>
              {loading ? (
                <>
                  <svg style={{ width: '18px', height: '18px', animation: 'spin 0.8s linear infinite' }} fill="none" viewBox="0 0 24 24">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}>how_to_reg</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Sign in link */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f0f4f0', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: '#94a8a4' }}>
            Already have an account?{' '}
            <Link href="/login"
              style={{ color: '#00450d', fontWeight: 700, textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}