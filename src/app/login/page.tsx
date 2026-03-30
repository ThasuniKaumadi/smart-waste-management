'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { ROLE_DASHBOARDS } from '@/lib/types'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
      if (profile?.role) router.push(ROLE_DASHBOARDS[profile.role as keyof typeof ROLE_DASHBOARDS])
      else router.push('/dashboard')
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
    const titleEl = document.getElementById('session-title')
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
          display: inline-block;
          vertical-align: middle;
          line-height: 1;
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
          padding: 16px 52px 16px 24px;
          font-size: 14px;
          color: #181c22;
          font-family: 'Inter', sans-serif;
          transition: all 0.3s ease;
          outline: none;
          backdrop-filter: blur(4px);
        }
        .input-eco:focus {
          box-shadow: 0 0 0 2px rgba(27,94,32,0.12);
          background: rgba(255,255,255,0.9);
        }
        .input-eco::placeholder { color: rgba(65,73,62,0.35); }
        .eco-checkbox {
          width: 14px; height: 14px;
          border-radius: 4px;
          accent-color: #1B5E20;
          cursor: pointer;
        }
      `}</style>

      <canvas ref={canvasRef} className="absolute inset-0 z-0" />

      <header className="fixed top-0 w-full flex justify-between items-center px-12 py-8 z-50 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto cursor-pointer"
          style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '18px', letterSpacing: '-0.02em', color: '#1B5E20' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>eco</span>
          <span>EcoLedger</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 pointer-events-auto">
          {[
            { icon: 'language', label: 'CMC Network' },
            { icon: 'help_outline', label: 'Support' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5 cursor-pointer"
              style={{ color: 'rgba(27,94,32,0.5)', fontSize: '10px', fontFamily: 'Manrope, sans-serif', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </nav>
      </header>

      <main className="relative h-screen w-full flex overflow-hidden">

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
          </div>
        </section>

        <section className="flex-1 lg:flex-none lg:w-[42%] flex items-center justify-center relative z-20 px-6 md:px-12">
          <div className="glass-panel w-full max-w-md rounded-2xl p-12"
            style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.05)' }}>

            <div className="mb-10">
              <span id="access-protocol"
                style={{ fontFamily: 'Manrope, sans-serif', fontSize: '10px', fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(65,73,62,0.45)', display: 'block', marginBottom: '16px', opacity: 0 }}>
                Colombo Municipal Council · ClearPath
              </span>
              <h1 id="session-title" className="font-extrabold tracking-tight"
                style={{ fontFamily: 'Manrope, sans-serif', fontSize: '36px', color: '#181c22' }}>
                Welcome Back
              </h1>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1">
                <label style={{ fontFamily: 'Manrope, sans-serif', fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(65,73,62,0.55)', marginLeft: '4px', display: 'block' }}>
                  Email Address
                </label>
                <div className="relative">
                  <input type="email" placeholder="you@cmc.lk" value={email}
                    onChange={(e) => setEmail(e.target.value)} required className="input-eco" />
                  <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2"
                    style={{ color: 'rgba(65,73,62,0.3)', fontSize: '20px' }}>fingerprint</span>
                </div>
              </div>

              <div className="space-y-1">
                <label style={{ fontFamily: 'Manrope, sans-serif', fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(65,73,62,0.55)', marginLeft: '4px', display: 'block' }}>
                  Password
                </label>
                <div className="relative">
                  <input type="password" placeholder="••••••••••••" value={password}
                    onChange={(e) => setPassword(e.target.value)} required className="input-eco" />
                  <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2"
                    style={{ color: 'rgba(65,73,62,0.3)', fontSize: '20px' }}>encrypted</span>
                </div>
              </div>

              <div className="flex items-center justify-between px-1"
                style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(65,73,62,0.6)' }}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="eco-checkbox" />
                  <span>Keep me signed in</span>
                </label>
                <a href="#" style={{ color: 'rgba(65,73,62,0.6)' }} className="hover:text-green-800 transition-colors">
                  Forgot password?
                </a>
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
                  padding: '18px', marginTop: '8px', fontFamily: 'Manrope, sans-serif',
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
                    Signing in...
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-10 pt-7" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              <p className="text-center" style={{ fontSize: '11px', color: 'rgba(65,73,62,0.6)', fontWeight: 500 }}>
                Don&apos;t have an account?{' '}
                <Link href="/register" style={{ color: '#1B5E20', fontWeight: 700 }} className="hover:underline">
                  Register here
                </Link>
              </p>
              <p className="text-center mt-4 italic"
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