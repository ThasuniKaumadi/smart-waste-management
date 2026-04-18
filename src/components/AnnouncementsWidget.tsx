'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

const PRIORITY_STYLE: Record<string, { color: string; bg: string; label: string; border: string }> = {
    normal: { color: '#00450d', bg: '#f0fdf4', label: 'Normal', border: 'rgba(0,69,13,0.1)' },
    important: { color: '#d97706', bg: '#fefce8', label: 'Important', border: 'rgba(217,119,6,0.15)' },
    urgent: { color: '#ba1a1a', bg: '#fef2f2', label: 'Urgent', border: 'rgba(186,26,26,0.15)' },
}

interface AnnouncementsWidgetProps {
    role: string
    district?: string
    compact?: boolean  // compact=true shows mini widget, false shows full page style
}

export default function AnnouncementsWidget({ role, district, compact = false }: AnnouncementsWidgetProps) {
    const [announcements, setAnnouncements] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState<string | null>(null)

    useEffect(() => { loadAnnouncements() }, [role, district])

    async function loadAnnouncements() {
        const supabase = createClient()
        let query = supabase
            .from('announcements')
            .select('*')
            .eq('archived', false)
            .order('created_at', { ascending: false })

        const { data } = await query
        // Filter client-side: show if target_roles includes this role OR target_roles is empty
        const filtered = (data || []).filter(a => {
            const roles = a.target_roles || []
            const roleMatch = roles.length === 0 || roles.includes(role)
            const districtMatch = !a.district || a.district === district
            return roleMatch && districtMatch
        })
        setAnnouncements(filtered)
        setLoading(false)
    }

    if (loading) return null
    if (announcements.length === 0) return null

    const urgentCount = announcements.filter(a => a.priority === 'urgent').length
    const importantCount = announcements.filter(a => a.priority === 'important').length

    if (compact) {
        return (
            <div style={{ marginBottom: '24px' }}>
                <style>{`.material-symbols-outlined{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1;}`}</style>
                {announcements.map(ann => {
                    const ps = PRIORITY_STYLE[ann.priority] || PRIORITY_STYLE.normal
                    const isExpanded = expanded === ann.id
                    return (
                        <div key={ann.id} style={{ marginBottom: '10px', borderRadius: '14px', border: `1px solid ${ps.border}`, background: ps.bg, overflow: 'hidden' }}>
                            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : ann.id)}>
                                <span className="material-symbols-outlined" style={{ color: ps.color, fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>campaign</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{ann.title}</p>
                                        {ann.priority !== 'normal' && (
                                            <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 7px', borderRadius: '99px', background: ps.color, color: 'white', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Manrope,sans-serif', flexShrink: 0 }}>{ps.label}</span>
                                        )}
                                    </div>
                                    {isExpanded && <p style={{ fontSize: '13px', color: '#41493e', marginTop: '6px', lineHeight: 1.5 }}>{ann.body}</p>}
                                    {!isExpanded && <p style={{ fontSize: '12px', color: ps.color, margin: 0, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{isExpanded ? 'expand_less' : 'expand_more'}</span>
                                        Tap to read
                                    </p>}
                                </div>
                                <span className="material-symbols-outlined" style={{ color: ps.color, fontSize: '16px', flexShrink: 0 }}>{isExpanded ? 'expand_less' : 'expand_more'}</span>
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div>
            <style>{`.material-symbols-outlined{font-family:'Material Symbols Outlined';font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1;}`}</style>
            <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 10px 40px -10px rgba(24,28,34,0.08)', border: '1px solid rgba(0,69,13,0.04)', overflow: 'hidden' }}>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(0,69,13,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>campaign</span>
                        </div>
                        <div>
                            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '14px', color: '#181c22', margin: 0 }}>Announcements</p>
                            <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>{announcements.length} active</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {urgentCount > 0 && <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: '#fef2f2', color: '#ba1a1a', fontFamily: 'Manrope,sans-serif' }}>{urgentCount} urgent</span>}
                        {importantCount > 0 && <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: '#fefce8', color: '#d97706', fontFamily: 'Manrope,sans-serif' }}>{importantCount} important</span>}
                    </div>
                </div>
                {announcements.map(ann => {
                    const ps = PRIORITY_STYLE[ann.priority] || PRIORITY_STYLE.normal
                    const isExpanded = expanded === ann.id
                    return (
                        <div key={ann.id} style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,69,13,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
                            onClick={() => setExpanded(isExpanded ? null : ann.id)}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f9f9ff')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0, background: ps.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ color: ps.color, fontSize: '18px' }}>campaign</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{ann.title}</p>
                                        {ann.priority !== 'normal' && (
                                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: ps.bg, color: ps.color, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Manrope,sans-serif' }}>{ps.label}</span>
                                        )}
                                        {ann.district && <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: '#eff6ff', color: '#1d4ed8', fontFamily: 'Manrope,sans-serif' }}>{ann.district}</span>}
                                    </div>
                                    {isExpanded ? (
                                        <p style={{ fontSize: '13px', color: '#41493e', lineHeight: 1.6, margin: '0 0 6px' }}>{ann.body}</p>
                                    ) : (
                                        <p style={{ fontSize: '13px', color: '#717a6d', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ann.body}</p>
                                    )}
                                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: isExpanded ? '4px 0 0' : '2px 0 0' }}>
                                        {new Date(ann.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                                <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '18px', flexShrink: 0 }}>{isExpanded ? 'expand_less' : 'expand_more'}</span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}