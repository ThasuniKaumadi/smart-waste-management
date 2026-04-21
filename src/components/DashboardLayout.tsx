'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface NavChild {
    label: string
    href: string
    icon: string
    description?: string
}

interface NavItem {
    label: string
    href: string
    icon: string
    section?: string
    children?: NavChild[]
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
    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [openDropdown, setOpenDropdown] = useState<string | null>(null)
    const hoverTimeout = useRef<NodeJS.Timeout | null>(null)

    async function handleLogout() {
        setLoggingOut(true)
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
    }

    function getInitials(name: string) {
        if (!name) return 'U'
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }

    function isActiveRoute(href: string) {
        if (pathname === href) return true
        const segments = href.split('/').filter(Boolean)
        if (segments.length >= 3) return pathname.startsWith(href + '/')
        return false
    }

    function isParentActive(item: NavItem) {
        if (isActiveRoute(item.href)) return true
        return item.children?.some(c => isActiveRoute(c.href)) ?? false
    }

    function handleMouseEnter(key: string) {
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
        setOpenDropdown(key)
    }

    function handleMouseLeave() {
        hoverTimeout.current = setTimeout(() => setOpenDropdown(null), 150)
    }

    function handleDropdownMouseEnter() {
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    }

    // Group nav items by section
    const sections: { title: string; items: NavItem[] }[] = []
    const ungrouped: NavItem[] = []
    navItems.forEach(item => {
        if (item.section) {
            const existing = sections.find(s => s.title === item.section)
            if (existing) existing.items.push(item)
            else sections.push({ title: item.section, items: [item] })
        } else {
            ungrouped.push(item)
        }
    })

    const SW = collapsed ? '64px' : '240px'

    function renderNavItem(item: NavItem) {
        const active = isParentActive(item)
        const hasChildren = item.children && item.children.length > 0
        const isOpen = openDropdown === item.href

        return (
            <div
                key={item.href}
                style={{ position: 'relative' }}
                onMouseEnter={() => hasChildren && !collapsed && handleMouseEnter(item.href)}
                onMouseLeave={() => hasChildren && handleMouseLeave()}
            >
                <Link
                    href={item.href}
                    onClick={() => {
                        setMobileOpen(false)
                        if (hasChildren && !collapsed) {
                            setOpenDropdown(isOpen ? null : item.href)
                        }
                    }}
                    className={`sb-item${active ? ' active' : ''}`}
                    title={collapsed ? item.label : undefined}
                >
                    <span className="ms">{item.icon}</span>
                    {!collapsed && <span className="lbl">{item.label}</span>}
                    {!collapsed && hasChildren && (
                        <span className="ms sb-chevron" style={{ marginLeft: 'auto', fontSize: '16px', opacity: 0.4, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                            expand_more
                        </span>
                    )}
                </Link>

                {/* Dropdown panel */}
                {hasChildren && !collapsed && isOpen && (
                    <div
                        className="sb-dropdown"
                        onMouseEnter={handleDropdownMouseEnter}
                        onMouseLeave={handleMouseLeave}
                    >
                        <div className="sb-dropdown-grid">
                            {item.children!.map(child => {
                                const childActive = isActiveRoute(child.href)
                                return (
                                    <Link
                                        key={child.href}
                                        href={child.href}
                                        onClick={() => { setMobileOpen(false); setOpenDropdown(null) }}
                                        className={`sb-dropdown-item${childActive ? ' active' : ''}`}
                                    >
                                        <div className={`sb-dropdown-icon${childActive ? ' active' : ''}`}>
                                            <span className="ms">{child.icon}</span>
                                        </div>
                                        <div className="sb-dropdown-text">
                                            <div className="sb-dropdown-label">{child.label}</div>
                                            {child.description && (
                                                <div className="sb-dropdown-desc">{child.description}</div>
                                            )}
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f4f6f3', fontFamily: "'Inter', sans-serif" }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        * { box-sizing: border-box; }

        .ms {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
          display: inline-block; line-height: 1; vertical-align: middle; user-select: none;
        }

        /* ── Sidebar ── */
        .sb {
          position: fixed; top: 0; left: 0; bottom: 0; z-index: 50;
          background: #fff;
          border-right: 1px solid rgba(0,69,13,0.07);
          display: flex; flex-direction: column;
          transition: width 0.22s ease; overflow: visible;
        }

        /* ── Brand ── */
        .sb-brand {
          display: flex; align-items: center; gap: 10px;
          padding: 20px 16px 16px; flex-shrink: 0; min-height: 68px;
          border-bottom: 1px solid rgba(0,69,13,0.06);
        }
        .sb-logo {
          width: 34px; height: 34px; border-radius: 9px; background: #00450d;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .sb-logo .ms { color: #fff; font-size: 18px; }
        .sb-brand-text {
          font-family: 'Manrope', sans-serif; font-weight: 800; font-size: 16px;
          color: #00450d; white-space: nowrap; opacity: 1; transition: opacity 0.15s ease;
        }
        .sb-brand-text.hidden { opacity: 0; pointer-events: none; }

        /* ── Collapse toggle ── */
        .sb-toggle {
          position: absolute; top: 22px; right: -11px;
          width: 22px; height: 22px; border-radius: 50%;
          background: #fff; border: 1px solid rgba(0,69,13,0.15);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; z-index: 52; transition: border-color 0.15s;
        }
        .sb-toggle:hover { border-color: #00450d; }
        .sb-toggle .ms { font-size: 13px; color: #00450d; }

        /* ── Scroll area ── */
        .sb-scroll { flex: 1; overflow-y: auto; overflow-x: visible; padding: 12px 0 8px; }
        .sb-scroll::-webkit-scrollbar { width: 2px; }
        .sb-scroll::-webkit-scrollbar-thumb { background: rgba(0,69,13,0.12); border-radius: 2px; }

        /* ── Section label ── */
        .sb-section-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
          color: rgba(0,69,13,0.35); text-transform: uppercase;
          padding: 14px 18px 6px; white-space: nowrap; overflow: hidden;
          font-family: 'Inter', sans-serif;
        }
        .sb-section-label.hidden { opacity: 0; height: 0; padding: 0; }

        /* ── Nav item ── */
        .sb-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; margin: 1px 8px;
          border-radius: 8px; font-size: 13px; font-weight: 500;
          color: #6b7280; text-decoration: none;
          transition: all 0.15s ease; white-space: nowrap; overflow: hidden;
          position: relative; font-family: 'Inter', sans-serif;
        }
        .sb-item:hover { background: rgba(0,69,13,0.05); color: #00450d; }
        .sb-item.active { background: #edf7ee; color: #00450d; font-weight: 600; }
        .sb-item.active::after {
          content: ''; position: absolute; right: 0; top: 20%; bottom: 20%;
          width: 3px; border-radius: 2px 0 0 2px; background: #00450d;
        }
        .sb-item .ms { font-size: 18px; flex-shrink: 0; color: inherit; }
        .sb-item .lbl { overflow: hidden; text-overflow: ellipsis; flex: 1; }

        /* tooltip */
        .sb-item[title]:hover::before {
          content: attr(title);
          position: absolute; left: 58px; top: 50%; transform: translateY(-50%);
          background: #1a2e1a; color: #fff;
          font-size: 11.5px; font-weight: 500;
          padding: 4px 10px; border-radius: 6px; white-space: nowrap;
          pointer-events: none; z-index: 200;
        }

        /* ── Dropdown panel ── */
        .sb-dropdown {
          position: absolute; left: calc(100% + 10px); top: 0;
          width: 320px; z-index: 200;
          background: #fff;
          border: 1px solid rgba(0,69,13,0.08);
          border-radius: 14px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06);
          padding: 10px;
          animation: dropIn 0.15s ease both;
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .sb-dropdown::before {
          content: '';
          position: absolute; left: -6px; top: 16px;
          width: 10px; height: 10px;
          background: #fff;
          border-left: 1px solid rgba(0,69,13,0.08);
          border-bottom: 1px solid rgba(0,69,13,0.08);
          transform: rotate(45deg);
        }

        .sb-dropdown-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
        }
        .sb-dropdown-grid:has(> :only-child),
        .sb-dropdown-grid:has(> :nth-child(1):last-child) {
          grid-template-columns: 1fr;
        }

        .sb-dropdown-item {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 10px 10px; border-radius: 10px;
          text-decoration: none;
          transition: background 0.15s ease;
          color: inherit;
        }
        .sb-dropdown-item:hover { background: rgba(0,69,13,0.05); }
        .sb-dropdown-item.active { background: #edf7ee; }

        .sb-dropdown-icon {
          width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
          background: rgba(0,69,13,0.07);
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .sb-dropdown-icon .ms { font-size: 16px; color: #00450d; }
        .sb-dropdown-icon.active { background: #00450d; }
        .sb-dropdown-icon.active .ms { color: #fff; }
        .sb-dropdown-item:hover .sb-dropdown-icon { background: rgba(0,69,13,0.12); }
        .sb-dropdown-item.active:hover .sb-dropdown-icon { background: #005a10; }

        .sb-dropdown-text { min-width: 0; }
        .sb-dropdown-label {
          font-size: 12.5px; font-weight: 600; color: #1a2e1a;
          font-family: 'Manrope', sans-serif; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
        }
        .sb-dropdown-item.active .sb-dropdown-label { color: #00450d; }
        .sb-dropdown-desc {
          font-size: 11px; color: #9ca3af; margin-top: 1px;
          line-height: 1.4; font-family: 'Inter', sans-serif;
        }

        /* ── Primary action ── */
        .sb-action {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          margin: 4px 8px 0; padding: 10px 12px; border-radius: 8px;
          background: #00450d; color: #fff;
          font-size: 12.5px; font-weight: 700; text-decoration: none;
          white-space: nowrap; overflow: hidden;
          transition: background 0.15s; font-family: 'Inter', sans-serif;
        }
        .sb-action:hover { background: #005a10; }
        .sb-action .ms { font-size: 16px; flex-shrink: 0; }
        .sb-action-icon {
          width: 36px; height: 36px; border-radius: 8px; background: #00450d;
          display: flex; align-items: center; justify-content: center;
          margin: 8px auto 0; text-decoration: none; transition: background 0.15s;
        }
        .sb-action-icon:hover { background: #005a10; }
        .sb-action-icon .ms { color: #fff; font-size: 18px; }

        /* ── Divider ── */
        .sb-div { height: 1px; background: rgba(0,69,13,0.06); margin: 8px 12px; }

        /* ── Footer ── */
        .sb-foot { padding: 6px 8px 14px; flex-shrink: 0; border-top: 1px solid rgba(0,69,13,0.06); }
        .sb-user { display: flex; align-items: center; gap: 9px; padding: 8px 12px; border-radius: 8px; }
        .sb-avatar {
          width: 32px; height: 32px; border-radius: 8px; background: #00450d;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 11px; font-weight: 800;
          flex-shrink: 0; font-family: 'Manrope', sans-serif; letter-spacing: 0.02em;
        }
        .sb-user-info { overflow: hidden; flex: 1; min-width: 0; }
        .sb-user-name {
          font-size: 12.5px; font-weight: 600; color: #1a2e1a;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          font-family: 'Manrope', sans-serif;
        }
        .sb-user-role { font-size: 10px; font-weight: 600; letter-spacing: 0.06em; color: #3d7a47; text-transform: uppercase; }

        .sb-foot-btn {
          display: flex; align-items: center; gap: 9px;
          padding: 8px 12px; margin: 1px 0; border-radius: 8px;
          font-size: 12.5px; font-weight: 500; cursor: pointer;
          width: 100%; white-space: nowrap; overflow: hidden;
          transition: background 0.15s; font-family: 'Inter', sans-serif;
          background: none; border: none; text-decoration: none;
        }
        .sb-foot-btn .ms { font-size: 17px; flex-shrink: 0; }
        .sb-foot-btn.logout { color: #c0392b; }
        .sb-foot-btn.logout:hover { background: rgba(192,57,43,0.06); }

        /* ── Mobile topbar ── */
        .sb-topbar {
          display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 40;
          height: 54px; background: #fff; border-bottom: 1px solid rgba(0,69,13,0.07);
          padding: 0 16px; align-items: center; justify-content: space-between;
        }
        .sb-topbar-title { font-family: 'Manrope', sans-serif; font-weight: 800; font-size: 16px; color: #00450d; }
        .sb-topbar-btn { background: none; border: none; cursor: pointer; padding: 6px; display: flex; }
        .sb-topbar-btn .ms { font-size: 22px; color: #00450d; }

        /* ── Mobile overlay ── */
        .sb-overlay { display: none; position: fixed; inset: 0; z-index: 49; background: rgba(0,0,0,0.35); }

        /* ── Main ── */
        .sb-main { flex: 1; min-height: 100vh; padding: 28px 28px 48px; transition: margin-left 0.22s ease; }
        .sb-page { animation: fadeUp 0.25s ease both; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }

        @media (max-width: 768px) {
          .sb-topbar { display: flex !important; }
          .sb { transform: translateX(-100%); transition: transform 0.22s ease; width: 240px !important; overflow: hidden; }
          .sb.open { transform: translateX(0); }
          .sb-overlay { display: block !important; }
          .sb-toggle { display: none; }
          .sb-main { margin-left: 0 !important; padding-top: 68px; }
          .sb-dropdown { position: static; left: auto; top: auto; width: auto; box-shadow: none; border: none; border-radius: 0; padding: 0 0 0 28px; animation: none; background: transparent; }
          .sb-dropdown::before { display: none; }
          .sb-dropdown-grid { grid-template-columns: 1fr; gap: 0; }
          .sb-dropdown-item { padding: 7px 8px; border-radius: 6px; }
          .sb-dropdown-icon { width: 26px; height: 26px; }
          .sb-dropdown-icon .ms { font-size: 14px; }
          .sb-dropdown-label { font-size: 12px; }
          .sb-dropdown-desc { display: none; }
        }
      `}</style>

            {/* ── SIDEBAR ── */}
            <aside className={`sb${mobileOpen ? ' open' : ''}`} style={{ width: SW }}>

                <button className="sb-toggle" onClick={() => { setCollapsed(c => !c); setOpenDropdown(null) }}>
                    <span className="ms">{collapsed ? 'chevron_right' : 'chevron_left'}</span>
                </button>

                <div className="sb-brand">
                    <div className="sb-logo"><span className="ms">eco</span></div>
                    <span className={`sb-brand-text${collapsed ? ' hidden' : ''}`}>EcoLedger</span>
                </div>

                {primaryAction && (
                    collapsed ? (
                        <Link href={primaryAction.href} className="sb-action-icon" title={primaryAction.label}>
                            <span className="ms">{primaryAction.icon || 'add'}</span>
                        </Link>
                    ) : (
                        <Link href={primaryAction.href} className="sb-action" onClick={() => setMobileOpen(false)}>
                            <span className="ms">{primaryAction.icon || 'add'}</span>
                            {primaryAction.label}
                        </Link>
                    )
                )}

                <div className="sb-scroll">
                    {ungrouped.length > 0 && (
                        <>
                            {!collapsed && <div className="sb-section-label">Navigation</div>}
                            {ungrouped.map(item => renderNavItem(item))}
                        </>
                    )}
                    {sections.map(section => (
                        <div key={section.title}>
                            <div className={`sb-section-label${collapsed ? ' hidden' : ''}`}>{section.title}</div>
                            {section.items.map(item => renderNavItem(item))}
                        </div>
                    ))}
                </div>

                <div className="sb-foot">
                    <div className="sb-user">
                        <div className="sb-avatar">{getInitials(userName)}</div>
                        {!collapsed && (
                            <div className="sb-user-info">
                                <div className="sb-user-name">{userName || 'User'}</div>
                                <div className="sb-user-role">{role}</div>
                            </div>
                        )}
                    </div>
                    <button
                        className="sb-foot-btn logout"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        title={collapsed ? 'Sign out' : undefined}
                    >
                        <span className="ms">logout</span>
                        {!collapsed && (loggingOut ? 'Signing out…' : 'Sign out')}
                    </button>
                </div>
            </aside>

            {mobileOpen && <div className="sb-overlay" onClick={() => setMobileOpen(false)} />}

            <div className="sb-topbar">
                <button className="sb-topbar-btn" onClick={() => setMobileOpen(o => !o)}>
                    <span className="ms">menu</span>
                </button>
                <span className="sb-topbar-title">EcoLedger</span>
                <div className="sb-avatar">{getInitials(userName)}</div>
            </div>

            <main className="sb-main sb-page" style={{ marginLeft: SW }}>
                {children}
            </main>
        </div>
    )
}