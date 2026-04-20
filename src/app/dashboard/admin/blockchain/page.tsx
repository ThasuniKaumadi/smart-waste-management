'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const ADMIN_NAV = [
  { label: 'Overview',      href: '/dashboard/admin',               icon: 'dashboard'       },
  { label: 'Users',         href: '/dashboard/admin/users',         icon: 'manage_accounts' },
  { label: 'Billing',       href: '/dashboard/admin/billing',       icon: 'payments'        },
  { label: 'Billing Rates', href: '/dashboard/admin/billing-rates', icon: 'tune'            },
  { label: 'Blockchain',    href: '/dashboard/admin/blockchain',    icon: 'link'            },
  { label: 'Performance',   href: '/dashboard/admin/performance',   icon: 'analytics'       },
  { label: 'Disposal',      href: '/dashboard/admin/disposal',      icon: 'delete_sweep'    },
  { label: 'Reports',       href: '/dashboard/admin/reports',       icon: 'rate_review'     },
  { label: 'Profile',       href: '/dashboard/admin/profile',       icon: 'person'          },
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
      const { data } = await supabase
        .from('collection_events')
        .select('*')
        .not('blockchain_tx', 'is', null)
        .order('created_at', { ascending: false })
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

  const filtered = collections.filter(e => {
    if (filter === 'all') return true
    return e.status === filter
  })

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
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .font-headline { font-family: 'Manrope', sans-serif; }
        .bento-card {
          background: white; border-radius: 16px;
          box-shadow: 0 10px 40px -10px rgba(24,28,34,0.08);
          border: 1px solid rgba(0,69,13,0.04); overflow: hidden;
        }
        .bento-card:hover { transform: translateY(-2px); box-shadow: 0 20px 50px -15px rgba(24,28,34,0.12); }
        .tx-row {
          padding: 18px 24px; border-bottom: 1px solid rgba(0,69,13,0.04);
          transition: background 0.15s ease; display: flex; align-items: center; gap: 16px;
        }
        .tx-row:hover { background: #f9f9ff; }
        .tx-row:last-child { border-bottom: none; }
        .filter-btn { padding: 6px 16px; border-radius: 99px; font-size: 12px; font-weight: 700; font-family: 'Manrope', sans-serif; border: none; cursor: pointer; transition: all 0.2s ease; }
        .filter-btn.active { background: #00450d; color: white; }
        .filter-btn:not(.active) { background: #f1f5f9; color: #64748b; }
        .filter-btn:not(.active):hover { background: #e2e8f0; }
        .copy-btn { transition: all 0.2s ease; }
        .copy-btn:hover { background: rgba(124,58,237,0.12) !important; }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.10s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
        .s4 { animation: staggerIn 0.5s ease 0.20s both; }
      `}</style>

      {/* Hero */}
      <section className="mb-10 s1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase block mb-2"
              style={{ letterSpacing: '0.2em', color: '#717a6d', fontFamily: 'Manrope, sans-serif' }}>
              System Administration · Blockchain
            </span>
            <h1 className="font-headline font-extrabold tracking-tight"
              style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
              Blockchain <span style={{ color: '#7c3aed' }}>Logs</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: 'rgba(124,58,237,0.06)' }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#7c3aed' }} />
            <span className="text-sm font-medium" style={{ color: '#7c3aed', fontFamily: 'Inter, sans-serif' }}>
              Polygon Amoy Testnet
            </span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8 s2">
        {[
          { label: 'Total Records', value: collections.length, icon: 'link', color: '#7c3aed', bg: 'rgba(124,58,237,0.07)' },
          { label: 'Completed', value: completedCount, icon: 'check_circle', color: '#00450d', bg: 'rgba(0,69,13,0.07)' },
          { label: 'Skipped', value: skippedCount, icon: 'cancel', color: '#dc2626', bg: 'rgba(220,38,38,0.07)' },
          { label: 'Verification', value: collections.length > 0 ? `${Math.round((completedCount / collections.length) * 100)}%` : '0%', icon: 'verified', color: '#1d4ed8', bg: 'rgba(29,78,216,0.07)' },
        ].map(m => (
          <div key={m.label} className="bento-card p-5" style={{ transition: 'all 0.2s' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: m.bg }}>
              <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '18px' }}>{m.icon}</span>
            </div>
            <p className="font-headline font-extrabold text-2xl tracking-tight mb-0.5" style={{ color: '#181c22' }}>{m.value}</p>
            <p style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'Manrope, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{m.label}</p>
          </div>
        ))}
      </div>

      {/* Contract info card */}
      <div className="s3 mb-8" style={{ background: 'linear-gradient(135deg, #4c1d95, #7c3aed)', borderRadius: '16px', padding: '24px 28px', color: 'white', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '24px', color: 'rgba(255,255,255,0.9)' }}>contract</span>
          </div>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', margin: '0 0 4px', fontFamily: 'Manrope, sans-serif' }}>
              Smart Contract Address
            </p>
            <p style={{ fontSize: '13px', fontFamily: 'monospace', color: 'white', margin: 0, letterSpacing: '0.02em' }}>
              {CONTRACT}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={copyContract} className="copy-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '9px 16px', borderRadius: '99px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{copied ? 'check' : 'content_copy'}</span>
            {copied ? 'Copied!' : 'Copy Address'}
          </button>
          <a href={`https://amoy.polygonscan.com/address/${CONTRACT}`} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', color: '#7c3aed', padding: '9px 16px', borderRadius: '99px', fontSize: '12px', fontWeight: 700, textDecoration: 'none', fontFamily: 'Manrope, sans-serif' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
            View on Polygonscan
          </a>
        </div>
      </div>

      {/* Transaction list */}
      <div className="bento-card s4">
        <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-3"
          style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
          <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
            Transaction Records
          </h3>
          <div className="flex items-center gap-2">
            {['all', 'completed', 'skipped'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`filter-btn ${filter === f ? 'active' : ''}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(124,58,237,0.07)' }}>
              <span className="material-symbols-outlined" style={{ color: '#7c3aed', fontSize: '32px' }}>link_off</span>
            </div>
            <p className="font-headline font-bold text-lg mb-1" style={{ color: '#181c22' }}>No blockchain records yet</p>
            <p className="text-sm" style={{ color: '#94a3b8' }}>Collections logged on-chain will appear here</p>
          </div>
        ) : (
          <div>
            {filtered.map(e => (
              <div key={e.id} className="tx-row">
                {/* Icon */}
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0, background: e.status === 'completed' ? 'rgba(0,69,13,0.07)' : 'rgba(220,38,38,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: e.status === 'completed' ? '#00450d' : '#dc2626' }}>
                    {e.status === 'completed' ? 'check_circle' : 'cancel'}
                  </span>
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#181c22' }}>
                      {e.address || 'Collection Stop'}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: e.status === 'completed' ? 'rgba(0,69,13,0.08)' : 'rgba(220,38,38,0.08)', color: e.status === 'completed' ? '#00450d' : '#dc2626', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Manrope, sans-serif' }}>
                      {e.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#7c3aed' }}>link</span>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#7c3aed', letterSpacing: '0.02em' }}>
                      {e.blockchain_tx ? e.blockchain_tx.slice(0, 28) + '...' : 'N/A'}
                    </span>
                    {e.blockchain_tx && (
                      <a href={`https://amoy.polygonscan.com/tx/${e.blockchain_tx}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '13px', color: '#94a3b8' }}>open_in_new</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Date */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#41493e', margin: 0 }}>
                    {new Date(e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                  <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>
                    {new Date(e.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="px-8 py-4 flex items-center justify-between"
          style={{ borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9f9ff' }}>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined" style={{ color: '#7c3aed', fontSize: '16px' }}>verified</span>
            <p className="text-xs" style={{ color: '#717a6d' }}>
              All transactions verified on <strong>Polygon Amoy</strong> testnet
            </p>
          </div>
          <p className="text-xs" style={{ color: '#717a6d' }}>
            {filtered.length} of {collections.length} records
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}