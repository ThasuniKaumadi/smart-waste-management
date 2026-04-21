'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const ADMIN_NAV = [
  { label: 'Home', href: '/dashboard/admin', icon: 'dashboard' },
  { label: 'Users', href: '/dashboard/admin/users', icon: 'manage_accounts' },
  { label: 'Billing', href: '/dashboard/admin/billing', icon: 'payments' },
  { label: 'Billing Rates', href: '/dashboard/admin/billing-rates', icon: 'tune' },
  { label: 'Blockchain', href: '/dashboard/admin/blockchain', icon: 'link' },
  { label: 'Performance', href: '/dashboard/admin/performance', icon: 'analytics' },
  { label: 'Disposal', href: '/dashboard/admin/disposal', icon: 'delete_sweep' },
  { label: 'Reports', href: '/dashboard/admin/reports', icon: 'rate_review' },
  { label: 'Profile', href: '/dashboard/admin/profile', icon: 'person' },
]

const CONTRACT = '0x5fddc7920b5b9c7f7c9fed119d05640cef9daa05'

export default function BlockchainViewerPage() {
  const [collections, setCollections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [filter, setFilter] = useState('all')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
      }
      const { data } = await supabase.from('collection_events').select('*').not('blockchain_tx', 'is', null).order('created_at', { ascending: false })
      setCollections(data || [])
      setLoading(false)
    }
    load()
  }, [])

  function copyContract() {
    navigator.clipboard.writeText(CONTRACT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filtered = collections.filter(e => filter === 'all' || e.status === filter)
  const completedCount = collections.filter(e => e.status === 'completed').length
  const skippedCount = collections.filter(e => e.status === 'skipped').length

  return (
    <DashboardLayout
      role="Admin"
      userName={profile?.full_name || ''}
      navItems={ADMIN_NAV}
      primaryAction={{ label: 'View on Polygonscan', href: `https://amoy.polygonscan.com/address/${CONTRACT}`, icon: 'open_in_new' }}
    >
      <style>{`
        .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); overflow:hidden; }
        .stat-card { background:white; border-radius:20px; padding:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); transition:transform 0.2s,box-shadow 0.2s; }
        .stat-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.09); }
        .tx-row { padding:16px 24px; border-bottom:1px solid rgba(0,69,13,0.04); transition:background 0.15s; display:flex; align-items:center; gap:16px; }
        .tx-row:hover { background:#f9fbf9; }
        .tx-row:last-child { border-bottom:none; }
        .filter-btn { padding:7px 16px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
        .filter-btn.active { background:#00450d; color:white; }
        .filter-btn:not(.active) { background:#f1f5f9; color:#64748b; }
        .filter-btn:not(.active):hover { background:#e2e8f0; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .a1{animation:fadeUp .4s ease .04s both} .a2{animation:fadeUp .4s ease .09s both}
        .a3{animation:fadeUp .4s ease .14s both} .a4{animation:fadeUp .4s ease .19s both}
        .live{animation:pulse 2s ease-in-out infinite}
      `}</style>

      {/* ── Heading ── */}
      <div className="a1" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 6px' }}>
              ⛓️ System Administration
            </p>
            <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 46, fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: '0 0 4px' }}>
              Blockchain <span style={{ color: '#7c3aed' }}>Logs</span>
            </h1>
            <p style={{ fontSize: 13, color: '#717a6d', margin: 0 }}>
              {new Date().toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              &nbsp;·&nbsp;Polygon Amoy Testnet
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 99, background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.15)' }}>
            <div className="live" style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c3aed' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', fontFamily: 'Manrope,sans-serif' }}>Polygon Amoy Testnet</span>
          </div>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Records', value: collections.length, icon: 'link', color: '#7c3aed', bg: '#faf5ff' },
          { label: 'Completed', value: completedCount, icon: 'check_circle', color: '#15803d', bg: '#f0fdf4' },
          { label: 'Skipped', value: skippedCount, icon: 'cancel', color: '#dc2626', bg: '#fef2f2' },
          { label: 'Verification', value: collections.length > 0 ? `${Math.round((completedCount / collections.length) * 100)}%` : '0%', icon: 'verified', color: '#1d4ed8', bg: '#eff6ff' },
        ].map(m => (
          <div key={m.label} className="stat-card">
            <div style={{ width: 36, height: 36, borderRadius: 10, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <span className="msf" style={{ color: m.color, fontSize: 18 }}>{m.icon}</span>
            </div>
            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 30, color: '#181c22', margin: '0 0 2px', lineHeight: 1 }}>{m.value}</p>
            <p style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'Manrope,sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{m.label}</p>
          </div>
        ))}
      </div>

      {/* ── Contract card ── */}
      <div className="a3" style={{ background: 'linear-gradient(135deg,#4c1d95,#7c3aed)', borderRadius: 20, padding: '22px 28px', color: 'white', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="msf" style={{ fontSize: 24, color: 'rgba(255,255,255,0.9)' }}>contract</span>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', margin: '0 0 4px', fontFamily: 'Manrope,sans-serif' }}>Smart Contract Address</p>
            <p style={{ fontSize: 13, fontFamily: 'monospace', color: 'white', margin: 0, letterSpacing: '0.02em' }}>{CONTRACT}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={copyContract} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '9px 16px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope,sans-serif', transition: 'background 0.2s' }}>
            <span className="msf" style={{ fontSize: 14 }}>{copied ? 'check' : 'content_copy'}</span>
            {copied ? 'Copied!' : 'Copy Address'}
          </button>
          <a href={`https://amoy.polygonscan.com/address/${CONTRACT}`} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', color: '#7c3aed', padding: '9px 16px', borderRadius: 99, fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'Manrope,sans-serif' }}>
            <span className="msf" style={{ fontSize: 14 }}>open_in_new</span>
            View on Polygonscan
          </a>
        </div>
      </div>

      {/* ── Transaction list ── */}
      <div className="card a4">
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(0,69,13,0.05)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 17, color: '#181c22', margin: 0 }}>Transaction Records</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {['all', 'completed', 'skipped'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`filter-btn ${filter === f ? 'active' : ''}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ width: 28, height: 28, border: '2px solid #7c3aed', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(124,58,237,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <span className="msf" style={{ color: '#7c3aed', fontSize: 28 }}>link_off</span>
            </div>
            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22', marginBottom: 4 }}>No blockchain records yet</p>
            <p style={{ fontSize: 13, color: '#94a3b8' }}>Collections logged on-chain will appear here</p>
          </div>
        ) : filtered.map(e => (
          <div key={e.id} className="tx-row">
            <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: e.status === 'completed' ? '#f0fdf4' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="msf" style={{ fontSize: 20, color: e.status === 'completed' ? '#15803d' : '#dc2626' }}>
                {e.status === 'completed' ? 'check_circle' : 'cancel'}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#181c22' }}>{e.address || 'Collection Stop'}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: e.status === 'completed' ? '#f0fdf4' : '#fef2f2', color: e.status === 'completed' ? '#15803d' : '#dc2626', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Manrope,sans-serif' }}>
                  {e.status}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="msf" style={{ fontSize: 13, color: '#7c3aed' }}>link</span>
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#7c3aed', letterSpacing: '0.02em' }}>
                  {e.blockchain_tx ? e.blockchain_tx.slice(0, 28) + '…' : 'N/A'}
                </span>
                {e.blockchain_tx && (
                  <a href={`https://amoy.polygonscan.com/tx/${e.blockchain_tx}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 4 }}>
                    <span className="msf" style={{ fontSize: 13, color: '#94a3b8' }}>open_in_new</span>
                  </a>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#41493e', margin: '0 0 2px' }}>
                {new Date(e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </p>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                {new Date(e.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(0,69,13,0.05)', background: '#fafbff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="msf" style={{ color: '#7c3aed', fontSize: 16 }}>verified</span>
            <p style={{ fontSize: 12, color: '#717a6d', margin: 0 }}>
              All transactions verified on <strong>Polygon Amoy</strong> testnet
            </p>
          </div>
          <p style={{ fontSize: 12, color: '#717a6d', margin: 0 }}>{filtered.length} of {collections.length} records</p>
        </div>
      </div>
    </DashboardLayout>
  )
}