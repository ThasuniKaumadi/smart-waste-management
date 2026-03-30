'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface NavItem {
    label: string
    href: string
    icon: string
}

interface DashboardLayoutProps {
    children: React.ReactNode
    role: string
    userName?: string
    navItems: NavItem[]
    primaryAction?: {
        label: string
        href: string
        icon?: string
    }
}

export default function DashboardLayout({
    children,
    role,
    userName = '',
    navItems,
    primaryAction,
}: DashboardLayoutProps) {
    const pathname = usePathname()
    const router = useRouter()
    const [loggingOut, setLoggingOut] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)

    async function handleLogout() {
        setLoggingOut(true)
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
    }

    function getInitials(name: string) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'
    }

    const visibleNav = navItems.slice(0, 4)
    const overflowNav = navItems.slice(4)

    return (
        <div className="min-h-screen" style={{ background: '#f9f9ff', fontFamily: "'Inter', sans-serif" }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@400,0&display=swap');

        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block;
          vertical-align: middle;
          line-height: 1;
        }
        .font-headline { font-family: 'Manrope', sans-serif; }
        .font-label { font-family: 'Manrope', sans-serif; }

        .top-nav {
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 10px 40px -10px rgba(24,28,34,0.08);
        }

        .nav-link {
          font-family: 'Manrope', sans-serif;
          font-weight: 600;
          font-size: 13px;
          letter-spacing: -0.01em;
          color: #64748b;
          text-decoration: none;
          transition: all 0.3s cubic-bezier(0.05,0.7,0.1,1.0);
          padding-bottom: 2px;
          white-space: nowrap;
        }
        .nav-link:hover {
          color: #14532d;
          transform: translateY(-2px);
        }
        .nav-link.active {
          color: #15803d;
          border-bottom: 2px solid #16a34a;
        }

        .more-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 40px -10px rgba(24,28,34,0.12);
          border: 1px solid rgba(0,69,13,0.08);
          min-width: 160px;
          padding: 6px;
          z-index: 100;
          display: none;
        }
        .more-wrapper:hover .more-dropdown { display: block; }

        .more-btn {
          font-family: 'Manrope', sans-serif;
          font-weight: 600;
          font-size: 13px;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 2px;
          background: none;
          border: none;
          cursor: pointer;
          padding-bottom: 2px;
          transition: color 0.2s ease;
        }
        .more-btn:hover { color: #14532d; }

        .dropdown-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          font-family: 'Manrope', sans-serif;
          color: #64748b;
          text-decoration: none;
          transition: background 0.15s ease;
        }
        .dropdown-link:hover { background: #f0fdf4; color: #14532d; }
        .dropdown-link.active { color: #00450d; background: #f0fdf4; }

        .avatar-ring {
          background: linear-gradient(135deg, #00450d, #1b6d24);
          color: white;
          font-family: 'Manrope', sans-serif;
          font-weight: 800;
          font-size: 12px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,69,13,0.2);
          flex-shrink: 0;
        }

        .signout-btn {
          font-family: 'Manrope', sans-serif;
          font-size: 12px;
          font-weight: 700;
          color: #ba1a1a;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          padding: 6px 10px;
          border-radius: 8px;
          transition: background 0.2s;
          background: none;
          border: none;
          white-space: nowrap;
        }
        .signout-btn:hover { background: rgba(186,26,26,0.06); }

        .primary-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 99px;
          font-family: 'Manrope', sans-serif;
          font-weight: 700;
          font-size: 12px;
          background: #1b5e20;
          color: white;
          text-decoration: none;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(27,94,32,0.2);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .primary-btn:hover {
          background: #00450d;
          transform: scale(1.03);
        }

        /* Mobile drawer */
        .mobile-drawer {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
        }
        .mobile-drawer-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.3);
          backdrop-filter: blur(4px);
        }
        .mobile-drawer-panel {
          position: relative;
          width: 260px;
          background: white;
          height: 100%;
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          z-index: 10;
          box-shadow: 20px 0 60px rgba(0,0,0,0.15);
        }

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .page-enter { animation: fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

            {/* FLOATING PILL NAVBAR */}
            <header className="top-nav sticky top-4 mx-4 px-5 rounded-full z-50 flex items-center justify-between h-14"
                style={{ maxWidth: '1280px', marginLeft: 'auto', marginRight: 'auto', width: 'calc(100% - 2rem)' }}>

                {/* LEFT — brand + nav */}
                <div className="flex items-center gap-6 flex-shrink-0">
                    {/* Brand */}
                    <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
                        <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>eco</span>
                            <span className="font-headline font-black text-lg tracking-tighter" style={{ color: '#14532d' }}>
                                EcoLedger
                            </span>
                        </div>
                    </Link>

                    {/* Desktop nav */}
                    <nav className="hidden lg:flex items-center gap-5">
                        {visibleNav.map((item) => {
                            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                            return (
                                <Link key={item.href} href={item.href} className={`nav-link ${isActive ? 'active' : ''}`}>
                                    {item.label}
                                </Link>
                            )
                        })}

                        {overflowNav.length > 0 && (
                            <div className="more-wrapper relative">
                                <button className="more-btn">
                                    More
                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>expand_more</span>
                                </button>
                                <div className="more-dropdown">
                                    {overflowNav.map((item) => {
                                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                                        return (
                                            <Link key={item.href} href={item.href} className={`dropdown-link ${isActive ? 'active' : ''}`}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: isActive ? '#00450d' : '#94a3b8' }}>
                                                    {item.icon}
                                                </span>
                                                {item.label}
                                            </Link>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </nav>
                </div>

                {/* RIGHT — actions + user */}
                <div className="flex items-center gap-2 flex-shrink-0">

                    {/* Primary action — desktop only */}
                    {primaryAction && (
                        <Link href={primaryAction.href} className="primary-btn hidden lg:flex">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                                {primaryAction.icon || 'add'}
                            </span>
                            {primaryAction.label}
                        </Link>
                    )}

                    {/* Role badge */}
                    <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full"
                        style={{ background: '#f0fdf4' }}>
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#16a34a' }} />
                        <span className="font-label font-bold" style={{ fontSize: '10px', letterSpacing: '0.06em', color: '#14532d' }}>
                            {role}
                        </span>
                    </div>

                    {/* Notifications */}
                    <button className="p-1.5 rounded-full transition-colors hover:bg-slate-100 hidden md:block"
                        style={{ color: '#64748b' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>notifications</span>
                    </button>

                    {/* Divider */}
                    <div className="w-px h-6 hidden md:block" style={{ background: 'rgba(0,69,13,0.1)' }} />

                    {/* User info + signout */}
                    <div className="hidden md:flex items-center gap-2">
                        <div className="text-right hidden xl:block">
                            <p className="font-headline font-bold leading-none" style={{ fontSize: '12px', color: '#181c22' }}>
                                {userName || 'User'}
                            </p>
                            <p style={{ fontSize: '10px', color: '#717a6d', marginTop: '1px' }}>{role}</p>
                        </div>
                        <div className="avatar-ring">{getInitials(userName)}</div>
                        <button onClick={handleLogout} disabled={loggingOut} className="signout-btn">
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>logout</span>
                            <span className="hidden xl:block">{loggingOut ? '...' : 'Sign out'}</span>
                        </button>
                    </div>

                    {/* Mobile hamburger */}
                    <button
                        className="lg:hidden p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                        style={{ color: '#64748b' }}
                        onClick={() => setMobileOpen(true)}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>menu</span>
                    </button>
                </div>
            </header>

            {/* MOBILE DRAWER */}
            {mobileOpen && (
                <div className="mobile-drawer">
                    <div className="mobile-drawer-overlay" onClick={() => setMobileOpen(false)} />
                    <div className="mobile-drawer-panel">
                        <div className="flex items-center justify-between mb-6 px-2">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>eco</span>
                                <span className="font-headline font-black text-lg tracking-tighter" style={{ color: '#14532d' }}>
                                    EcoLedger
                                </span>
                            </div>
                            <button onClick={() => setMobileOpen(false)} style={{ color: '#64748b' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>close</span>
                            </button>
                        </div>

                        <div className="px-2 mb-4">
                            <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: '#f0fdf4' }}>
                                <div className="avatar-ring">{getInitials(userName)}</div>
                                <div>
                                    <p className="font-headline font-bold text-sm" style={{ color: '#181c22' }}>{userName || 'User'}</p>
                                    <p className="text-xs" style={{ color: '#717a6d' }}>{role}</p>
                                </div>
                            </div>
                        </div>

                        {navItems.map((item) => {
                            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setMobileOpen(false)}
                                    className={`dropdown-link ${isActive ? 'active' : ''}`}
                                    style={{ marginBottom: '2px' }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: isActive ? '#00450d' : '#94a3b8' }}>
                                        {item.icon}
                                    </span>
                                    {item.label}
                                </Link>
                            )
                        })}

                        {primaryAction && (
                            <Link
                                href={primaryAction.href}
                                onClick={() => setMobileOpen(false)}
                                className="primary-btn mt-4 justify-center"
                                style={{ borderRadius: '12px' }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                    {primaryAction.icon || 'add'}
                                </span>
                                {primaryAction.label}
                            </Link>
                        )}

                        <div className="mt-auto pt-4" style={{ borderTop: '1px solid rgba(0,69,13,0.08)' }}>
                            <button onClick={handleLogout} disabled={loggingOut} className="signout-btn w-full justify-center">
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
                                {loggingOut ? 'Signing out...' : 'Sign out'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MAIN CONTENT */}
            <main className="px-4 mt-6 pb-24 page-enter" style={{ maxWidth: '1280px', margin: '24px auto 96px' }}>
                {children}
            </main>

            {/* FOOTER */}
            <footer className="border-t py-8 px-6" style={{ background: '#f1f5f9', borderColor: 'rgba(0,69,13,0.06)' }}>
                <div className="flex flex-col md:flex-row justify-between items-center gap-4"
                    style={{ maxWidth: '1280px', margin: '0 auto' }}>
                    <div>
                        <span className="font-headline font-bold" style={{ color: '#14532d' }}>EcoLedger</span>
                        <p className="text-xs mt-1 uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                            © 2026 Colombo Municipal Council · All rights reserved
                        </p>
                    </div>
                    <div className="flex gap-6">
                        {['Privacy', 'Terms', 'Support'].map(l => (
                            <a key={l} href="#"
                                className="text-xs font-medium uppercase tracking-wider transition-colors hover:text-green-700"
                                style={{ color: '#94a3b8' }}>{l}
                            </a>
                        ))}
                    </div>
                </div>
            </footer>
        </div>
    )
}