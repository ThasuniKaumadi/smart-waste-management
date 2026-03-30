'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  DISTRICTS,
  ROLE_DASHBOARDS,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_ICONS,
  PUBLIC_ROLES,
  type UserRole
} from '@/lib/types'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '' as UserRole | '',
    district: '',
    address: '',
    organisationName: '',
    phone: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    if (!formData.role) { setError('Please select a role'); setLoading(false); return }
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); setLoading(false); return }
    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({ email: formData.email, password: formData.password })
    if (signUpError) { setError(signUpError.message); setLoading(false); return }
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: formData.fullName,
        role: formData.role,
        district: formData.district,
        address: formData.address,
        organisation_name: formData.organisationName,
        phone: formData.phone,
        is_approved: true,
      })
      if (profileError) { setError(profileError.message); setLoading(false); return }
      router.push(ROLE_DASHBOARDS[formData.role as UserRole])
    }
    setLoading(false)
  }

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement
    if (!canvas) return
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    if (!ctx) return

    let nodes: any[] = []
    let mouse = { x: null as number | null, y: null as number | null }
    let animFrameId: number

    class Node {
      x: number; y: number; size: number; vx: number; vy: number
      isBlock: boolean; pulse: number; pulseDir: number
      constructor(w: number, h: number) {
        this.x = Math.random() * w
        this.y = Math.random() * h
        this.size = Math.random() * 2 + 2
        this.vx = (Math.random() - 0.5) * 1.5
        this.vy = (Math.random() - 0.5) * 1.5
        this.isBlock = Math.random() > 0.8
        this.pulse = 0
        this.pulseDir = 0.05
      }
      update(w: number, h: number) {
        if (mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - this.x
          const dy = mouse.y - this.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 200) {
            const angle = Math.atan2(dy, dx)
            const force = (200 - dist) / 200
            this.vx -= Math.cos(angle) * force * 0.2
            this.vy -= Math.sin(angle) * force * 0.2
          }
        }
        this.x += this.vx; this.y += this.vy
        this.vx *= 0.99; this.vy *= 0.99
        if (this.x < 0 || this.x > w) this.vx *= -1
        if (this.y < 0 || this.y > h) this.vy *= -1
        this.pulse += this.pulseDir
        if (this.pulse > 1 || this.pulse < 0) this.pulseDir *= -1
      }
      draw(context: CanvasRenderingContext2D) {
        context.beginPath()
        if (this.isBlock) {
          const s = this.size * 2 + this.pulse * 2
          context.rect(this.x - s / 2, this.y - s / 2, s, s)
          context.fillStyle = `rgba(27,94,32,${0.4 + this.pulse * 0.2})`
          context.fill()
          context.strokeStyle = 'rgba(27,94,32,0.8)'
          context.lineWidth = 0.8
          context.stroke()
        } else {
          context.arc(this.x, this.y, this.size, 0, Math.PI * 2)
          context.fillStyle = '#1B5E20'
          context.fill()
        }
      }
    }

    function init() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      nodes = []
      const count = Math.floor((canvas.width * canvas.height) / 10000)
      for (let i = 0; i < count; i++) nodes.push(new Node(canvas.width, canvas.height))
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.lineWidth = 0.5
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 150) {
            const opacity = 1 - dist / 150
            ctx.strokeStyle = `rgba(27,94,32,${opacity * 0.15})`
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
            if (Math.random() > 0.995) {
              ctx.fillStyle = 'rgba(27,94,32,0.6)'
              ctx.beginPath()
              ctx.arc(nodes[i].x + dx / 2, nodes[i].y + dy / 2, 1, 0, Math.PI * 2)
              ctx.fill()
            }
          }
        }
      }
      nodes.forEach(n => { n.update(canvas.width, canvas.height); n.draw(ctx) })
      animFrameId = requestAnimationFrame(animate)
    }

    const onResize = () => init()
    const onMouseMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY }
    const onMouseOut = () => { mouse.x = null; mouse.y = null }

    window.addEventListener('resize', onResize)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseout', onMouseOut)

    init()
    animate()

    return () => {
      cancelAnimationFrame(animFrameId)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseout', onMouseOut)
    }
  }, [])

  useEffect(() => {
    const brandEl = document.getElementById('brand-text')
    const titleEl = document.getElementById('form-title')
    const subEl = document.getElementById('brand-subtext')
    const protEl = document.getElementById('access-protocol')

    function staggerChars(el: HTMLElement | null, baseDelay: number) {
      if (!el) return
      const text = el.innerText
      el.innerHTML = ''
      text.split('').forEach((char, i) => {
        const span = document.createElement('span')
        span.style.cssText = `display:inline-block;opacity:0;transform:translateY(20px);transition:opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${baseDelay + i * 0.02}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${baseDelay + i * 0.02}s`
        span.innerText = char === ' ' ? '\u00A0' : char
        el.appendChild(span)
      })
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.querySelectorAll('span').forEach(s => {
            (s as HTMLElement).style.opacity = '1';
            (s as HTMLElement).style.transform = 'translateY(0)'
          })
        })
      })
    }

    const t1 = setTimeout(() => staggerChars(brandEl, 0.1), 100)
    const t2 = setTimeout(() => staggerChars(titleEl, 0.3), 100)
    const t3 = setTimeout(() => {
      if (subEl) { subEl.style.transition = 'opacity 1s ease 0.8s'; subEl.style.opacity = '1' }
      if (protEl) { protEl.style.transition = 'opacity 1s ease 0.6s'; protEl.style.opacity = '1' }
    }, 200)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  return (
    <div className="relative h-screen w-full overflow-hidden bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Manrope:wght@400;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@400&display=swap');

        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .glass-panel {
          background: rgba(255,255,255,0.75);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(0,0,0,0.05);
        }
        .btn-glow:hover { box-shadow: 0 0 24px rgba(27,94,32,0.4); }
        .btn-click:active { transform: scale(0.97); }

        .input-eco {
          width: 100%;
          background: rgba(255,255,255,0.6);
          border: none;
          border-radius: 9999px;
          padding: 13px 20px;
          font-size: 13px;
          color: #181c22;
          font-family: 'Inter', sans-serif;
          transition: all 0.3s ease;
          outline: none;
        }
        .input-eco:focus {
          box-shadow: 0 0 0 2px rgba(27,94,32,0.12);
          background: rgba(255,255,255,0.95);
        }
        .input-eco::placeholder { color: rgba(65,73,62,0.35); }

        .select-eco {
          width: 100%;
          background: rgba(255,255,255,0.6);
          border: none;
          border-radius: 9999px;
          padding: 13px 20px;
          font-size: 13px;
          color: #181c22;
          font-family: 'Inter', sans-serif;
          transition: all 0.3s ease;
          outline: none;
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2341493e'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 16px center;
          background-size: 14px;
        }
        .select-eco:focus {
          box-shadow: 0 0 0 2px rgba(27,94,32,0.12);
          background-color: rgba(255,255,255,0.95);
        }

        .role-card {
          border: 1.5px solid rgba(255,255,255,0.6);
          border-radius: 16px;
          padding: 14px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16,1,0.3,1);
          background: rgba(255,255,255,0.5);
          backdrop-filter: blur(8px);
        }
        .role-card:hover {
          border-color: rgba(27,94,32,0.4);
          background: rgba(255,255,255,0.8);
          transform: translateY(-2px);
        }
        .role-card.selected {
          border-color: #1B5E20;
          background: rgba(255,255,255,0.9);
          box-shadow: 0 4px 16px rgba(27,94,32,0.12);
        }

        .step-dot {
          width: 26px; height: 26px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700;
          font-family: 'Manrope', sans-serif;
          transition: all 0.3s ease; flex-shrink: 0;
        }
        .step-dot.active { background: #1B5E20; color: white; }
        .step-dot.done { background: #2e7d32; color: white; }
        .step-dot.pending { background: rgba(255,255,255,0.5); color: rgba(65,73,62,0.5); border: 1px solid rgba(65,73,62,0.2); }

        @keyframes stepSlide {
          from { opacity: 0; transform: translateX(16px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .step-enter { animation: stepSlide 0.3s cubic-bezier(0.16,1,0.3,1) both; }

        .label-eco {
          font-family: 'Manrope', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(65,73,62,0.55);
          margin-left: 4px;
          display: block;
          margin-bottom: 6px;
        }
      `}</style>

      <canvas ref={canvasRef} className="absolute inset-0 z-0" />

      {/* Header */}
      <header className="fixed top-0 w-full flex justify-between items-center px-12 py-8 z-50 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto cursor-pointer"
          style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '18px', letterSpacing: '-0.02em', color: '#1B5E20' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>eco</span>
          <span>EcoLedger</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 pointer-events-auto">
          {[{ icon: 'language', label: 'CMC Network' }, { icon: 'help_outline', label: 'Support' }].map(item => (
            <div key={item.label} className="flex items-center gap-1.5 cursor-pointer"
              style={{ color: 'rgba(27,94,32,0.5)', fontSize: '10px', fontFamily: 'Manrope, sans-serif', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </nav>
      </header>

      <main className="relative h-screen w-full flex overflow-hidden">

        {/* LEFT — Branding */}
        <section className="hidden lg:flex flex-1 items-center justify-center relative z-10 px-24">
          <div className="max-w-2xl">
            <h2 id="brand-text" className="font-extrabold leading-tight tracking-tighter"
              style={{ fontFamily: 'Manrope, sans-serif', fontSize: '72px', color: '#1B5E20' }}>
              EcoLedger
            </h2>
            <p id="brand-subtext"
              style={{ marginTop: '24px', color: 'rgba(27,94,32,0.4)', fontFamily: 'Inter, sans-serif', fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', opacity: 0 }}>
              Blockchain-Integrated Waste Management · CMC
            </p>

            {/* Feature list */}
            <div className="mt-12 space-y-4">
              {[
                { icon: 'link', text: 'Every collection verified on Polygon blockchain' },
                { icon: 'location_on', text: 'Real-time GPS tracking across all 6 districts' },
                { icon: 'analytics', text: 'Live performance dashboards for CMC' },
                { icon: 'notifications', text: 'Instant notifications on collection updates' },
              ].map((f, i) => (
                <div key={f.text} className="flex items-center gap-3"
                  style={{ opacity: 0, animation: `fadeUp 0.6s ease ${0.8 + i * 0.1}s both` }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(27,94,32,0.08)' }}>
                    <span className="material-symbols-outlined" style={{ color: '#1B5E20', fontSize: '16px' }}>{f.icon}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'rgba(27,94,32,0.6)', fontFamily: 'Inter, sans-serif' }}>{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RIGHT — Register form */}
        <section className="flex-1 lg:flex-none lg:w-[48%] flex items-center justify-center relative z-20 px-6 md:px-10 overflow-y-auto">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-10 my-8"
            style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.05)' }}>

            <div className="mb-7">
              <span id="access-protocol"
                style={{ fontFamily: 'Manrope, sans-serif', fontSize: '10px', fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(65,73,62,0.45)', display: 'block', marginBottom: '12px', opacity: 0 }}>
                Colombo Municipal Council · ClearPath
              </span>
              <h1 id="form-title" className="font-extrabold tracking-tight"
                style={{ fontFamily: 'Manrope, sans-serif', fontSize: '32px', color: '#181c22' }}>
                Create Account
              </h1>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-3 mb-7">
              <div className={`step-dot ${step > 1 ? 'done' : 'active'}`}>{step > 1 ? '✓' : '1'}</div>
              <div className="flex-1 h-px transition-all duration-500"
                style={{ background: step > 1 ? '#1B5E20' : 'rgba(65,73,62,0.15)' }} />
              <div className={`step-dot ${step === 2 ? 'active' : 'pending'}`}>2</div>
              <span style={{ fontSize: '10px', fontWeight: 600, fontFamily: 'Manrope, sans-serif', color: 'rgba(65,73,62,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {step === 1 ? 'Select Role' : 'Your Details'}
              </span>
            </div>

            {/* STEP 1 — Role selection */}
            {step === 1 && (
              <div className="step-enter">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  {PUBLIC_ROLES.map((role) => (
                    <div key={role} onClick={() => setFormData({ ...formData, role })}
                      className={`role-card ${formData.role === role ? 'selected' : ''}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{ROLE_ICONS[role]}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h3 className="font-bold text-sm truncate"
                              style={{ fontFamily: 'Manrope, sans-serif', color: formData.role === role ? '#1B5E20' : '#181c22' }}>
                              {ROLE_LABELS[role]}
                            </h3>
                            {formData.role === role && (
                              <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ background: '#1B5E20' }}>
                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <p className="text-xs mt-0.5"
                            style={{ color: formData.role === role ? 'rgba(27,94,32,0.7)' : 'rgba(65,73,62,0.5)' }}>
                            {ROLE_DESCRIPTIONS[role]}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-2xl mb-5 text-center text-xs"
                  style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(65,73,62,0.1)', color: 'rgba(65,73,62,0.6)' }}>
                  🔒 CMC staff, contractors and recyclers are registered by the system administrator
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-4 text-sm"
                    style={{ background: 'rgba(186,26,26,0.06)', border: '1px solid rgba(186,26,26,0.15)', color: '#ba1a1a' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>error</span>
                    {error}
                  </div>
                )}

                <button
                  onClick={() => { if (!formData.role) { setError('Please select an account type'); return } setError(''); setStep(2) }}
                  className="btn-glow btn-click w-full flex items-center justify-center gap-3 transition-all duration-300"
                  style={{
                    background: '#1B5E20', color: 'white', borderRadius: '9999px',
                    padding: '16px', fontFamily: 'Manrope, sans-serif',
                    fontWeight: 700, letterSpacing: '0.08em', fontSize: '14px',
                    boxShadow: '0 8px 32px rgba(27,94,32,0.15)', border: 'none', cursor: 'pointer',
                  }}>
                  Continue
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
                </button>
              </div>
            )}

            {/* STEP 2 — Details */}
            {step === 2 && (
              <form onSubmit={handleRegister} className="step-enter space-y-4">

                {/* Selected role badge */}
                <div className="flex items-center gap-3 p-3 rounded-2xl mb-1"
                  style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(27,94,32,0.15)' }}>
                  <span className="text-xl">{ROLE_ICONS[formData.role as UserRole]}</span>
                  <p className="flex-1 text-sm font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#1B5E20' }}>
                    {ROLE_LABELS[formData.role as UserRole]}
                  </p>
                  <button type="button" onClick={() => setStep(1)}
                    className="text-xs font-bold hover:underline" style={{ color: 'rgba(65,73,62,0.6)' }}>
                    Change
                  </button>
                </div>

                <div>
                  <label className="label-eco">Full Name</label>
                  <input className="input-eco" placeholder="Your full name"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} required />
                </div>

                {formData.role === 'commercial_establishment' && (
                  <div>
                    <label className="label-eco">Business Name</label>
                    <input className="input-eco" placeholder="Your organisation name"
                      value={formData.organisationName}
                      onChange={(e) => setFormData({ ...formData, organisationName: e.target.value })} required />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-eco">Email</label>
                    <input type="email" className="input-eco" placeholder="you@cmc.lk"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                  </div>
                  <div>
                    <label className="label-eco">Phone</label>
                    <input className="input-eco" placeholder="+94 77 000 0000"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-eco">Password</label>
                    <input type="password" className="input-eco" placeholder="Min. 8 characters"
                      value={formData.password} minLength={8}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })} required />
                  </div>
                  <div>
                    <label className="label-eco">Confirm Password</label>
                    <input type="password" className="input-eco" placeholder="Repeat password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} required />
                  </div>
                </div>

                <div>
                  <label className="label-eco">District</label>
                  <select className="select-eco" value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}>
                    <option value="">Select your district</option>
                    {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label-eco">Address</label>
                  <input className="input-eco" placeholder="Your full address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm"
                    style={{ background: 'rgba(186,26,26,0.06)', border: '1px solid rgba(186,26,26,0.15)', color: '#ba1a1a' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>error</span>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="btn-glow btn-click w-full flex items-center justify-center gap-3 transition-all duration-300"
                  style={{
                    background: '#1B5E20', color: 'white', borderRadius: '9999px',
                    padding: '16px', fontFamily: 'Manrope, sans-serif',
                    fontWeight: 700, letterSpacing: '0.08em', fontSize: '14px',
                    boxShadow: '0 8px 32px rgba(27,94,32,0.15)', border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                  }}>
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>how_to_reg</span>
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="mt-6 pt-5" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              <p className="text-center" style={{ fontSize: '11px', color: 'rgba(65,73,62,0.6)', fontWeight: 500 }}>
                Already have an account?{' '}
                <Link href="/login" style={{ color: '#1B5E20', fontWeight: 700 }} className="hover:underline">
                  Sign in here
                </Link>
              </p>
              <p className="text-center mt-3 italic"
                style={{ fontSize: '10px', color: 'rgba(65,73,62,0.35)', lineHeight: 1.6 }}>
                Blockchain-verified · Polygon Amoy · CMC 2026
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 w-full flex justify-between items-center px-12 py-8 z-50 pointer-events-none">
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(27,94,32,0.3)' }}>
          © 2026 EcoLedger · Colombo Municipal Council
        </div>
        <div className="flex gap-8 pointer-events-auto">
          {['Privacy', 'Terms'].map(l => (
            <a key={l} href="#"
              style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(27,94,32,0.3)' }}
              className="hover:text-green-800 transition-colors">{l}
            </a>
          ))}
        </div>
      </footer>
    </div>
  )
}