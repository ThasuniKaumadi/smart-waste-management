'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const ROLE_NAV: Record<string, { label: string; href: string; icon: string }[]> = {
    admin: [
        { label: 'Overview', href: '/dashboard/admin', icon: 'dashboard' },
        { label: 'Users', href: '/dashboard/admin/users', icon: 'group' },
        { label: 'Blockchain', href: '/dashboard/admin/blockchain', icon: 'hub' },
        { label: 'Performance', href: '/dashboard/admin/performance', icon: 'bar_chart' },
        { label: 'Billing', href: '/dashboard/admin/billing', icon: 'receipt_long' },
        { label: 'Contracts', href: '/dashboard/admin/contracts', icon: 'description' },
    ],
    resident: [
        { label: 'Overview', href: '/dashboard/resident', icon: 'dashboard' },
        { label: 'Schedule', href: '/dashboard/resident/schedule', icon: 'calendar_today' },
        { label: 'Track Vehicle', href: '/dashboard/resident/track', icon: 'location_on' },
        { label: 'Report Issue', href: '/dashboard/resident/report', icon: 'report_problem' },
        ],
    commercial_establishment: [
        { label: 'Overview', href: '/dashboard/commercial', icon: 'dashboard' },
        { label: 'Billing', href: '/dashboard/commercial/billing', icon: 'receipt_long' },
        { label: 'Schedule', href: '/dashboard/commercial/schedule', icon: 'calendar_today' },
        ],
    driver: [
        { label: 'Overview', href: '/dashboard/driver', icon: 'dashboard' },
        { label: 'My Route', href: '/dashboard/driver/route', icon: 'route' },
        { label: 'Collections', href: '/dashboard/driver/collections', icon: 'delete' },
        { label: 'Reports', href: '/dashboard/driver/reports', icon: 'description' },
    ],
    supervisor: [
        { label: 'Overview', href: '/dashboard/supervisor', icon: 'dashboard' },
        { label: 'Drivers', href: '/dashboard/supervisor/drivers', icon: 'group' },
        { label: 'Routes', href: '/dashboard/supervisor/routes', icon: 'route' },
        { label: 'Reports', href: '/dashboard/supervisor/reports', icon: 'description' },
    ],
    contractor: [
        { label: 'Overview', href: '/dashboard/contractor', icon: 'dashboard' },
        { label: 'Routes', href: '/dashboard/contractor/routes', icon: 'route' },
        { label: 'Drivers', href: '/dashboard/contractor/drivers', icon: 'group' },
        { label: 'Billing', href: '/dashboard/contractor/billing', icon: 'receipt_long' },
    ],
    district_engineer: [
        { label: 'Overview', href: '/dashboard/district-engineer', icon: 'dashboard' },
        { label: 'Routes', href: '/dashboard/district-engineer/routes', icon: 'route' },
        { label: 'Schedules', href: '/dashboard/district-engineer/schedules', icon: 'calendar_today' },
        { label: 'Reports', href: '/dashboard/district-engineer/reports', icon: 'description' },
    ],
    engineer: [
        { label: 'Overview', href: '/dashboard/engineer', icon: 'dashboard' },
        { label: 'Reports', href: '/dashboard/engineer/reports', icon: 'description' },
    ],
    recycling_partner: [
        { label: 'Overview', href: '/dashboard/recycling-partner', icon: 'dashboard' },
        { label: 'Collections', href: '/dashboard/recycling-partner/collections', icon: 'recycling' },
        { label: 'Reports', href: '/dashboard/recycling-partner/reports', icon: 'description' },
    ],
    facility_operator: [
        { label: 'Overview', href: '/dashboard/facility-operator', icon: 'dashboard' },
        { label: 'Inventory', href: '/dashboard/facility-operator/inventory', icon: 'inventory_2' },
        { label: 'Reports', href: '/dashboard/facility-operator/reports', icon: 'description' },
    ],
}

export default function AccountPage() {
    const router = useRouter()
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [changingPassword, setChangingPassword] = useState(false)
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const [fullName, setFullName] = useState('')
    const [phone, setPhone] = useState('')
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    useEffect(() => { loadProfile() }, [])

    async function loadProfile() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (p) {
            setProfile(p)
            setFullName(p.full_name || '')
            setPhone(p.phone || '')
        }
        setLoading(false)
    }

    async function handleSaveProfile() {
        setSaving(true)
        setMsg(null)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { error } = await supabase.from('profiles')
            .update({ full_name: fullName, phone })
            .eq('id', user.id)
        setMsg(error
            ? { type: 'error', text: 'Failed to update profile.' }
            : { type: 'success', text: 'Profile updated successfully.' }
        )
        setSaving(false)
        if (!error) loadProfile()
    }

    async function handleChangePassword() {
        if (newPassword !== confirmPassword) {
            setMsg({ type: 'error', text: 'New passwords do not match.' }); return
        }
        if (newPassword.length < 8) {
            setMsg({ type: 'error', text: 'Password must be at least 8 characters.' }); return
        }
        setChangingPassword(true)
        setMsg(null)
        const supabase = createClient()
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        setMsg(error
            ? { type: 'error', text: 'Failed to update password. Please try again.' }
            : { type: 'success', text: 'Password changed successfully.' }
        )
        setChangingPassword(false)
        if (!error) { setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }
    }

    const navItems = ROLE_NAV[profile?.role] || []

    return (
        <DashboardLayout role={profile?.role || ''} userName={fullName} navItems={navItems}>
            <style>{`
        .acc-wrap { max-width: 640px; }
        .acc-card { background: #fff; border-radius: 14px; border: 1px solid rgba(0,69,13,0.07); padding: 28px; margin-bottom: 20px; }
        .acc-heading { font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 15px; color: #1a2e1a; margin-bottom: 18px; display: flex; align-items: center; gap: 8px; }
        .acc-heading .ms { font-size: 18px; color: #00450d; }
        .acc-field { margin-bottom: 16px; }
        .acc-label { font-size: 12px; font-weight: 600; color: #6b7280; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 6px; }
        .acc-input { width: 100%; padding: 9px 12px; border-radius: 8px; border: 1px solid rgba(0,69,13,0.15); font-size: 13.5px; color: #1a2e1a; background: #fff; font-family: 'Inter', sans-serif; outline: none; transition: border-color 0.15s; }
        .acc-input:focus { border-color: #00450d; }
        .acc-input:disabled { background: #f9fafb; color: #9ca3af; cursor: not-allowed; }
        .acc-btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 18px; border-radius: 8px; background: #00450d; color: #fff; font-size: 13px; font-weight: 600; border: none; cursor: pointer; transition: background 0.15s; font-family: 'Inter', sans-serif; }
        .acc-btn:hover { background: #005a10; }
        .acc-btn:disabled { background: #9ca3af; cursor: not-allowed; }
        .acc-btn .ms { font-size: 16px; }
        .acc-msg { padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; margin-bottom: 16px; }
        .acc-msg.success { background: #f0fdf4; color: #15803d; border: 1px solid rgba(0,69,13,0.12); }
        .acc-msg.error { background: #fef2f2; color: #dc2626; border: 1px solid rgba(220,38,38,0.12); }
        .acc-readonly { display: flex; flex-direction: column; gap: 10px; }
        .acc-readonly-item { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid rgba(0,69,13,0.05); }
        .acc-readonly-item:last-child { border-bottom: none; }
        .acc-readonly-key { font-size: 12.5px; color: #6b7280; font-weight: 500; }
        .acc-readonly-val { font-size: 13px; color: #1a2e1a; font-weight: 600; font-family: 'Manrope', sans-serif; }
        .acc-role-pill { background: #edf7ee; color: #00450d; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 10px; border-radius: 20px; }
      `}</style>

            <div className="acc-wrap">
                {/* Page title */}
                <div style={{ marginBottom: '24px' }}>
                    <h1 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '22px', color: '#1a2e1a', marginBottom: '4px' }}>
                        Account Settings
                    </h1>
                    <p style={{ fontSize: '13.5px', color: '#6b7280' }}>Manage your profile and security settings</p>
                </div>

                {loading ? (
                    <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading…</div>
                ) : (
                    <>
                        {msg && <div className={`acc-msg ${msg.type}`}>{msg.text}</div>}

                        {/* Account info (read-only) */}
                        <div className="acc-card">
                            <div className="acc-heading">
                                <span className="ms">badge</span>
                                Account Info
                            </div>
                            <div className="acc-readonly">
                                <div className="acc-readonly-item">
                                    <span className="acc-readonly-key">Email</span>
                                    <span className="acc-readonly-val">{profile?.email || '—'}</span>
                                </div>
                                <div className="acc-readonly-item">
                                    <span className="acc-readonly-key">Role</span>
                                    <span className="acc-role-pill">{profile?.role?.replace(/_/g, ' ') || '—'}</span>
                                </div>
                                {profile?.district && (
                                    <div className="acc-readonly-item">
                                        <span className="acc-readonly-key">District</span>
                                        <span className="acc-readonly-val">{profile.district}</span>
                                    </div>
                                )}
                                {profile?.ward && (
                                    <div className="acc-readonly-item">
                                        <span className="acc-readonly-key">Ward</span>
                                        <span className="acc-readonly-val">{profile.ward}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Edit profile */}
                        <div className="acc-card">
                            <div className="acc-heading">
                                <span className="ms">person</span>
                                Profile Details
                            </div>
                            <div className="acc-field">
                                <div className="acc-label">Full Name</div>
                                <input className="acc-input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
                            </div>
                            <div className="acc-field">
                                <div className="acc-label">Phone Number</div>
                                <input className="acc-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+94 77 000 0000" />
                            </div>
                            <button className="acc-btn" onClick={handleSaveProfile} disabled={saving}>
                                <span className="ms">save</span>
                                {saving ? 'Saving…' : 'Save Changes'}
                            </button>
                        </div>

                        {/* Change password */}
                        <div className="acc-card">
                            <div className="acc-heading">
                                <span className="ms">lock</span>
                                Change Password
                            </div>
                            <div className="acc-field">
                                <div className="acc-label">New Password</div>
                                <input className="acc-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 8 characters" />
                            </div>
                            <div className="acc-field">
                                <div className="acc-label">Confirm New Password</div>
                                <input className="acc-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat new password" />
                            </div>
                            <button className="acc-btn" onClick={handleChangePassword} disabled={changingPassword}>
                                <span className="ms">key</span>
                                {changingPassword ? 'Updating…' : 'Update Password'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    )
}