'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { ROLE_LABELS } from '@/lib/types'
import { CMC_DISTRICTS, getWardsForDistrict } from '@/lib/districts'

const ADMIN_NAV = [
  { label: 'Overview',      href: '/dashboard/admin',               icon: 'dashboard'       },
  { label: 'Users',         href: '/dashboard/admin/users',         icon: 'manage_accounts' },
  { label: 'Billing',       href: '/dashboard/admin/billing',       icon: 'payments'        },
  { label: 'Billing Rates', href: '/dashboard/admin/billing-rates', icon: 'tune'            },
  { label: 'Blockchain',    href: '/dashboard/admin/blockchain',    icon: 'link'            },
  { label: 'Performance',   href: '/dashboard/admin/performance',   icon: 'analytics'       },
  { label: 'Reports',       href: '/dashboard/admin/reports',       icon: 'rate_review'     },
  { label: 'Profile',       href: '/dashboard/admin/profile',       icon: 'person'          },
]

const STAFF_ROLES = [
  { value: 'district_engineer', label: 'District Engineer', icon: 'person' },
  { value: 'engineer', label: 'Municipal Engineer', icon: 'person' },
  { value: 'contractor', label: 'Contractor', icon: 'local_shipping' },
  { value: 'recycling_partner', label: 'Recycler / Facility', icon: 'recycling' },
  { value: 'supervisor', label: 'Supervisor', icon: 'supervisor_account' },
  { value: 'driver', label: 'Driver', icon: 'drive_eta' },
]

const FACILITY_TYPES = [
  { value: 'recyclable', label: 'Recyclable Waste' },
  { value: 'non_recyclable', label: 'Non-Recyclable Waste' },
  { value: 'glass', label: 'Glass' },
  { value: 'e_waste', label: 'E-Waste' },
  { value: 'organic', label: 'Organic Waste' },
  { value: 'custom', label: 'Other / Custom' },
]

const ALL_ROLES = [
  'admin', 'resident', 'commercial_establishment', 'contractor', 'recycling_partner',
  'facility_operator', 'district_engineer', 'engineer', 'supervisor', 'driver',
]

const ROLE_STYLE: Record<string, { color: string; bg: string }> = {
  contractor: { color: '#1d4ed8', bg: '#eff6ff' },
  recycling_partner: { color: '#00450d', bg: '#f0fdf4' },
  district_engineer: { color: '#d97706', bg: '#fefce8' },
  engineer: { color: '#d97706', bg: '#fefce8' },
  supervisor: { color: '#0891b2', bg: '#ecfeff' },
  driver: { color: '#64748b', bg: '#f8fafc' },
  resident: { color: '#ec4899', bg: '#fdf2f8' },
  commercial_establishment: { color: '#6366f1', bg: '#eef2ff' },
  admin: { color: '#ba1a1a', bg: '#fef2f2' },
}

interface Profile {
  id: string
  full_name: string
  role: string
  district: string
  is_approved: boolean
  created_at: string
  organisation_name?: string
  phone?: string
}

function WardMultiSelect({ selected, onChange, district }: {
  selected: string[]
  onChange: (wards: string[]) => void
  district: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wards = district ? getWardsForDistrict(district) : []
  const filtered = wards.filter(w => w.toLowerCase().includes(query.toLowerCase()))

  function toggle(ward: string) {
    onChange(selected.includes(ward) ? selected.filter(w => w !== ward) : [...selected, ward])
  }

  return (
    <div style={{ position: 'relative' }}>
      <div onClick={() => setOpen(!open)} style={{
        width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb',
        borderRadius: '10px', fontSize: '14px', color: '#181c22',
        fontFamily: 'Inter, sans-serif', background: '#fafafa', cursor: 'pointer',
        minHeight: '44px', display: 'flex', flexWrap: 'wrap', gap: '4px',
        alignItems: 'center', boxSizing: 'border-box',
      }}>
        {selected.length === 0
          ? <span style={{ color: '#9ca3af' }}>Select wards (optional)</span>
          : selected.map(w => (
            <span key={w} style={{ background: '#f0fdf4', color: '#00450d', padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {w}
              <span onClick={e => { e.stopPropagation(); toggle(w) }} style={{ cursor: 'pointer', opacity: 0.6 }}>×</span>
            </span>
          ))
        }
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'white', border: '1px solid rgba(0,69,13,0.1)', borderRadius: '12px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: '220px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
            <input type="text" placeholder="Search wards..." value={query}
              onChange={e => setQuery(e.target.value)} onClick={e => e.stopPropagation()}
              style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {!district ? (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>Select a district first</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>No wards found</div>
            ) : filtered.map(ward => (
              <div key={ward} onClick={() => toggle(ward)} style={{
                padding: '9px 14px', fontSize: '13px', fontFamily: 'Inter, sans-serif',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                background: selected.includes(ward) ? '#f0fdf4' : 'white',
                color: selected.includes(ward) ? '#00450d' : '#181c22',
              }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${selected.includes(ward) ? '#00450d' : '#e5e7eb'}`, background: selected.includes(ward) ? '#00450d' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {selected.includes(ward) && (
                    <svg style={{ width: '9px', height: '9px' }} fill="none" stroke="white" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                {ward}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminUsersPage() {
  const [profile, setProfile] = useState<any>(null)
  const [users, setUsers] = useState<Profile[]>([])
  const [contractors, setContractors] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [assignedWards, setAssignedWards] = useState<string[]>([])

  // Edit state
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editData, setEditData] = useState({
    full_name: '', district: '', phone: '', organisation_name: '', role: '',
  })

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', password: '', role: '',
    district: '', phone: '',
    contractor_name: '', contractor_address: '', contractor_email: '', contractor_phone: '',
    facility_name: '', facility_type: '', facility_type_custom: '',
    facility_address: '', facility_email: '', facility_phone: '',
    license_number: '', license_expiry: '', contractor_id: '',
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)
    const { data: usersData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(usersData || [])
    const { data: contractorData } = await supabase.from('profiles').select('id, full_name, organisation_name, role, district, is_approved, created_at').eq('role', 'contractor')
    setContractors(contractorData || [])
    setLoading(false)
  }

  function resetForm() {
    setFormData({
      firstName: '', lastName: '', email: '', password: '', role: '',
      district: '', phone: '', contractor_name: '', contractor_address: '',
      contractor_email: '', contractor_phone: '', facility_name: '', facility_type: '',
      facility_type_custom: '', facility_address: '', facility_email: '', facility_phone: '',
      license_number: '', license_expiry: '', contractor_id: '',
    })
    setAssignedWards([])
  }

  function openEdit(user: Profile) {
    setEditingUser(user)
    setEditData({
      full_name: user.full_name || '',
      district: user.district || '',
      phone: (user as any).phone || '',
      organisation_name: user.organisation_name || '',
      role: user.role || '',
    })
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault()
    if (!editingUser) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({
      full_name: editData.full_name,
      district: editData.district || null,
      phone: editData.phone || null,
      organisation_name: editData.organisation_name || null,
      role: editData.role,
    }).eq('id', editingUser.id)
    if (error) { setMessage('Error: ' + error.message) }
    else { setMessage('Profile updated successfully!'); setEditingUser(null); loadData() }
    setSaving(false)
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.role) { setMessage('Please select a user type'); return }
    const isPersonRole = ['district_engineer', 'engineer', 'supervisor', 'driver'].includes(formData.role)
    if (isPersonRole && !formData.firstName.trim()) { setMessage('Please enter first name'); return }
    if (isPersonRole && !formData.lastName.trim()) { setMessage('Please enter last name'); return }
    if (formData.role === 'district_engineer' && !formData.district) { setMessage('Please select a district'); return }
    if (formData.role === 'driver' && !formData.license_number) { setMessage('Please enter the license number'); return }

    setSaving(true); setMessage('')
    const supabase = createClient()

    const loginEmail = formData.role === 'contractor'
      ? formData.contractor_email
      : formData.role === 'recycling_partner'
        ? formData.facility_email
        : formData.email

    const { data, error: signUpError } = await supabase.auth.signUp({ email: loginEmail, password: formData.password })
    if (signUpError) { setMessage('Error: ' + signUpError.message); setSaving(false); return }

    if (data.user) {
      const fullName = isPersonRole
        ? `${formData.firstName.trim()} ${formData.lastName.trim()}`
        : formData.role === 'contractor' ? formData.contractor_name : formData.facility_name

      const facilityTypeValue = formData.facility_type === 'custom' ? formData.facility_type_custom : formData.facility_type

      const profileInsert: any = { id: data.user.id, full_name: fullName, role: formData.role, is_approved: true }

      if (['district_engineer', 'supervisor'].includes(formData.role)) profileInsert.district = formData.district || null
      if (formData.role === 'supervisor') { profileInsert.assigned_wards = assignedWards.length > 0 ? assignedWards : null; profileInsert.phone = formData.phone || null }
      if (['district_engineer', 'engineer'].includes(formData.role)) profileInsert.phone = formData.phone || null
      if (formData.role === 'contractor') { profileInsert.organisation_name = formData.contractor_name || null; profileInsert.address = formData.contractor_address || null; profileInsert.phone = formData.contractor_phone || null }
      if (formData.role === 'recycling_partner') { profileInsert.organisation_name = formData.facility_name || null; profileInsert.facility_type = facilityTypeValue || null; profileInsert.address = formData.facility_address || null; profileInsert.phone = formData.facility_phone || null }
      if (formData.role === 'driver') { profileInsert.phone = formData.phone || null; profileInsert.license_number = formData.license_number || null; profileInsert.license_expiry = formData.license_expiry || null; profileInsert.contractor_id = formData.contractor_id || null }

      const { error: profileError } = await supabase.from('profiles').insert(profileInsert)
      if (profileError) { setMessage('Error creating profile: ' + profileError.message) }
      else { setMessage('Staff account created successfully!'); setShowForm(false); resetForm(); loadData() }
    }
    setSaving(false)
  }

  async function toggleApproval(user: Profile) {
    const supabase = createClient()
    await supabase.from('profiles').update({ is_approved: !user.is_approved }).eq('id', user.id)
    loadData()
  }

  const filteredUsers = users.filter(u => {
    const matchesRole = filterRole === 'all' || u.role === filterRole
    const matchesSearch = !searchQuery || u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesRole && matchesSearch
  })

  const isDE = formData.role === 'district_engineer'
  const isEngineer = formData.role === 'engineer'
  const isSupervisor = formData.role === 'supervisor'
  const isDriver = formData.role === 'driver'
  const isContractor = formData.role === 'contractor'
  const isRecycler = formData.role === 'recycling_partner'
  const isPersonRole = isDE || isEngineer || isSupervisor || isDriver

  return (
    <DashboardLayout
      role="Admin"
      userName={profile?.full_name || ''}
      navItems={ADMIN_NAV}
      primaryAction={{ label: 'Create Staff Account', href: '#', icon: 'person_add' }}
    >
      <style>{`
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; vertical-align: middle; line-height: 1;
        }
        .font-headline { font-family: 'Manrope', sans-serif; }
        .bento-card { background: white; border-radius: 16px; box-shadow: 0 10px 40px -10px rgba(24,28,34,0.08); border: 1px solid rgba(0,69,13,0.04); overflow: hidden; }
        .form-field { width: 100%; padding: 11px 14px; border: 1.5px solid #e5e7eb; border-radius: 10px; font-size: 14px; color: #181c22; font-family: 'Inter', sans-serif; background: #fafafa; transition: all 0.2s ease; outline: none; box-sizing: border-box; }
        .form-field:focus { border-color: #00450d; background: white; box-shadow: 0 0 0 3px rgba(0,69,13,0.08); }
        .form-field::placeholder { color: #9ca3af; }
        .select-field { width: 100%; padding: 11px 14px; border: 1.5px solid #e5e7eb; border-radius: 10px; font-size: 14px; color: #181c22; font-family: 'Inter', sans-serif; background: #fafafa; transition: all 0.2s ease; outline: none; cursor: pointer; appearance: none; box-sizing: border-box; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23717a6d'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; background-size: 14px; }
        .select-field:focus { border-color: #00450d; background-color: white; box-shadow: 0 0 0 3px rgba(0,69,13,0.08); }
        .field-label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #374151; font-family: 'Manrope', sans-serif; margin-bottom: 7px; }
        .submit-btn { background: #00450d; color: white; border: none; border-radius: 10px; padding: 13px 24px; font-family: 'Manrope', sans-serif; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 8px; }
        .submit-btn:hover { background: #1b5e20; box-shadow: 0 4px 16px rgba(0,69,13,0.25); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .role-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 99px; font-size: 10px; font-weight: 700; font-family: 'Manrope', sans-serif; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }
        .role-pill { display: flex; align-items: center; gap: 8px; padding: 9px 14px; border-radius: 10px; border: 1.5px solid #e5e7eb; cursor: pointer; transition: all 0.2s ease; background: #fafafa; font-size: 13px; font-family: 'Manrope', sans-serif; font-weight: 600; color: #64748b; white-space: nowrap; }
        .role-pill:hover { border-color: #00450d; background: #f9fdf9; color: #181c22; }
        .role-pill.selected { border-color: #00450d; background: #f0fdf4; color: #00450d; }
        .user-row { padding: 16px 24px; border-bottom: 1px solid rgba(0,69,13,0.04); display: flex; align-items: center; gap: 16px; transition: background 0.2s ease; }
        .user-row:hover { background: #f9f9ff; }
        .user-row:last-child { border-bottom: none; }
        .filter-btn { padding: 6px 16px; border-radius: 99px; font-size: 12px; font-weight: 700; font-family: 'Manrope', sans-serif; border: none; cursor: pointer; transition: all 0.2s ease; }
        .filter-btn.active { background: #00450d; color: white; }
        .filter-btn:not(.active) { background: #f1f5f9; color: #64748b; }
        .filter-btn:not(.active):hover { background: #e2e8f0; }
        .action-btn { padding: 6px 14px; border-radius: 99px; font-size: 11px; font-weight: 700; font-family: 'Manrope', sans-serif; cursor: pointer; transition: all 0.2s ease; border: 1.5px solid; white-space: nowrap; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .modal-overlay { animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @media (max-width: 768px) { .form-grid { grid-template-columns: 1fr; } }
        @keyframes staggerIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .s1 { animation: staggerIn 0.5s ease 0.05s both; }
        .s2 { animation: staggerIn 0.5s ease 0.1s both; }
        .s3 { animation: staggerIn 0.5s ease 0.15s both; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .slide-down { animation: slideDown 0.3s ease both; }
      `}</style>

      {/* Hero */}
      <section className="mb-10 s1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <h1 className="font-headline font-extrabold tracking-tight"
            style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
            User <span style={{ color: '#1b5e20' }}>Management</span>
          </h1>
          <button onClick={() => { setShowForm(!showForm); if (showForm) resetForm() }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: showForm ? '#f1f5f9' : '#00450d', color: showForm ? '#64748b' : 'white', border: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', transition: 'all 0.2s ease' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{showForm ? 'close' : 'person_add'}</span>
            {showForm ? 'Cancel' : 'Create Staff Account'}
          </button>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8 s2">
        {[
          { label: 'Total Users', value: users.length, icon: 'group', color: '#00450d', bg: '#f0fdf4' },
          { label: 'Staff', value: users.filter(u => !['resident', 'commercial_establishment'].includes(u.role)).length, icon: 'badge', color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Active', value: users.filter(u => u.is_approved).length, icon: 'check_circle', color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Inactive', value: users.filter(u => !u.is_approved).length, icon: 'cancel', color: '#ba1a1a', bg: '#fef2f2' },
        ].map(m => (
          <div key={m.label} className="bento-card p-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: m.bg }}>
              <span className="material-symbols-outlined" style={{ color: m.color, fontSize: '18px' }}>{m.icon}</span>
            </div>
            <p className="font-headline font-extrabold text-2xl tracking-tight mb-0.5" style={{ color: '#181c22' }}>{m.value}</p>
            <p style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'Manrope, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{m.label}</p>
          </div>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div className="mb-6 flex items-center gap-3 p-4 rounded-xl text-sm"
          style={{ background: message.startsWith('Error') ? '#fef2f2' : '#f0fdf4', border: `1px solid ${message.startsWith('Error') ? 'rgba(186,26,26,0.2)' : 'rgba(0,69,13,0.15)'}`, color: message.startsWith('Error') ? '#ba1a1a' : '#00450d' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{message.startsWith('Error') ? 'error' : 'check_circle'}</span>
          {message}
        </div>
      )}

      {/* CREATE FORM */}
      {showForm && (
        <div className="bento-card mb-8 slide-down">
          <div className="px-8 py-6" style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
            <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Create Staff Account</h3>
            <p className="text-sm mt-1" style={{ color: '#717a6d' }}>Select a user type then fill in the details.</p>
          </div>
          <form onSubmit={handleCreateUser} className="p-8">
            <div style={{ marginBottom: '28px' }}>
              <label className="field-label">User Type *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '2px' }}>
                {STAFF_ROLES.map(role => (
                  <div key={role.value}
                    onClick={() => { setFormData({ ...formData, role: role.value, district: '' }); setAssignedWards([]) }}
                    className={`role-pill ${formData.role === role.value ? 'selected' : ''}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{role.icon}</span>
                    {role.label}
                    {formData.role === role.value && (
                      <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#00450d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg style={{ width: '8px', height: '8px' }} fill="none" stroke="white" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {isPersonRole && (
              <div className="form-grid slide-down">
                <div><label className="field-label">First Name *</label><input type="text" className="form-field" placeholder="e.g. Kasun" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} required /></div>
                <div><label className="field-label">Last Name *</label><input type="text" className="form-field" placeholder="e.g. Perera" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} required /></div>
                <div><label className="field-label">Work Email *</label><input type="email" className="form-field" placeholder="name@cmc.lk" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required /></div>
                <div><label className="field-label">Phone</label><input type="text" className="form-field" placeholder="+94 77 000 0000" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
                <div><label className="field-label">Password *</label><input type="password" className="form-field" placeholder="Min. 8 characters" value={formData.password} minLength={8} onChange={e => setFormData({ ...formData, password: e.target.value })} required /></div>
              </div>
            )}

            {isDE && (
              <div style={{ marginBottom: '20px' }} className="slide-down">
                <label className="field-label">Assigned District *</label>
                <select className="select-field" value={formData.district} onChange={e => setFormData({ ...formData, district: e.target.value })} required>
                  <option value="">Select district</option>
                  {CMC_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}

            {isSupervisor && (
              <div className="form-grid slide-down">
                <div>
                  <label className="field-label">District (Optional)</label>
                  <select className="select-field" value={formData.district} onChange={e => { setFormData({ ...formData, district: e.target.value }); setAssignedWards([]) }}>
                    <option value="">Select district</option>
                    {CMC_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Assigned Wards <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(Optional)</span></label>
                  <WardMultiSelect selected={assignedWards} onChange={setAssignedWards} district={formData.district} />
                </div>
              </div>
            )}

            {isDriver && (
              <div className="form-grid slide-down">
                <div><label className="field-label">Driving License Number *</label><input type="text" className="form-field" placeholder="e.g. B1234567" value={formData.license_number} onChange={e => setFormData({ ...formData, license_number: e.target.value })} /></div>
                <div><label className="field-label">License Expiry Date</label><input type="date" className="form-field" value={formData.license_expiry} min={new Date().toISOString().split('T')[0]} onChange={e => setFormData({ ...formData, license_expiry: e.target.value })} /></div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="field-label">Assigned Contractor</label>
                  {contractors.length === 0 ? (
                    <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#fefce8', border: '1px solid rgba(217,119,6,0.2)', fontSize: '13px', color: '#92400e' }}>⚠ No contractor accounts found.</div>
                  ) : (
                    <select className="select-field" value={formData.contractor_id} onChange={e => setFormData({ ...formData, contractor_id: e.target.value })}>
                      <option value="">Select contractor</option>
                      {contractors.map(c => <option key={c.id} value={c.id}>{c.organisation_name || c.full_name}</option>)}
                    </select>
                  )}
                </div>
              </div>
            )}

            {isContractor && (
              <div className="form-grid slide-down">
                <div><label className="field-label">Contractor / Company Name *</label><input type="text" className="form-field" placeholder="e.g. Lanka Waste Services Ltd" value={formData.contractor_name} onChange={e => setFormData({ ...formData, contractor_name: e.target.value })} required /></div>
                <div><label className="field-label">Company Email *</label><input type="email" className="form-field" placeholder="company@example.com" value={formData.contractor_email} onChange={e => setFormData({ ...formData, contractor_email: e.target.value })} required /></div>
                <div><label className="field-label">Phone</label><input type="text" className="form-field" placeholder="+94 11 000 0000" value={formData.contractor_phone} onChange={e => setFormData({ ...formData, contractor_phone: e.target.value })} /></div>
                <div><label className="field-label">Password *</label><input type="password" className="form-field" placeholder="Min. 8 characters" value={formData.password} minLength={8} onChange={e => setFormData({ ...formData, password: e.target.value })} required /></div>
                <div style={{ gridColumn: '1 / -1' }}><label className="field-label">Company Address</label><input type="text" className="form-field" placeholder="123 Main Street, Colombo 03" value={formData.contractor_address} onChange={e => setFormData({ ...formData, contractor_address: e.target.value })} /></div>
              </div>
            )}

            {isRecycler && (
              <div className="form-grid slide-down">
                <div><label className="field-label">Facility / Organisation Name *</label><input type="text" className="form-field" placeholder="e.g. EcoRecycle Lanka Pvt Ltd" value={formData.facility_name} onChange={e => setFormData({ ...formData, facility_name: e.target.value })} required /></div>
                <div><label className="field-label">Facility Email *</label><input type="email" className="form-field" placeholder="facility@example.com" value={formData.facility_email} onChange={e => setFormData({ ...formData, facility_email: e.target.value })} required /></div>
                <div>
                  <label className="field-label">Facility Type</label>
                  <select className="select-field" value={formData.facility_type} onChange={e => setFormData({ ...formData, facility_type: e.target.value })}>
                    <option value="">Select type</option>
                    {FACILITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                {formData.facility_type === 'custom' ? (
                  <div><label className="field-label">Custom Type Description</label><input type="text" className="form-field" placeholder="Describe the facility type" value={formData.facility_type_custom} onChange={e => setFormData({ ...formData, facility_type_custom: e.target.value })} /></div>
                ) : (
                  <div><label className="field-label">Phone</label><input type="text" className="form-field" placeholder="+94 11 000 0000" value={formData.facility_phone} onChange={e => setFormData({ ...formData, facility_phone: e.target.value })} /></div>
                )}
                {formData.facility_type === 'custom' && <div><label className="field-label">Phone</label><input type="text" className="form-field" placeholder="+94 11 000 0000" value={formData.facility_phone} onChange={e => setFormData({ ...formData, facility_phone: e.target.value })} /></div>}
                <div><label className="field-label">Password *</label><input type="password" className="form-field" placeholder="Min. 8 characters" value={formData.password} minLength={8} onChange={e => setFormData({ ...formData, password: e.target.value })} required /></div>
                <div style={{ gridColumn: '1 / -1' }}><label className="field-label">Facility Address</label><input type="text" className="form-field" placeholder="123 Industrial Zone, Colombo" value={formData.facility_address} onChange={e => setFormData({ ...formData, facility_address: e.target.value })} /></div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              <button type="submit" disabled={saving || !formData.role} className="submit-btn">
                {saving ? (<><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Creating...</>) : (<><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>Create Staff Account</>)}
              </button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }}
                style={{ padding: '13px 24px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', color: '#64748b' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* USER LIST */}
      <div className="bento-card s3">
        <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-3"
          style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
          <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>All Users</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: '#94a3b8' }}>search</span>
              <input type="text" placeholder="Search by name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '34px', paddingRight: '12px', paddingTop: '7px', paddingBottom: '7px', border: '1.5px solid #e5e7eb', borderRadius: '99px', fontSize: '13px', fontFamily: 'Inter, sans-serif', outline: 'none', background: '#fafafa', width: '180px', color: '#181c22' }} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {['all', 'district_engineer', 'supervisor', 'driver', 'contractor', 'resident'].map(f => (
                <button key={f} onClick={() => setFilterRole(f)} className={`filter-btn ${filterRole === f ? 'active' : ''}`}>
                  {f === 'all' ? 'All' : f === 'district_engineer' ? 'DE' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#f0fdf4' }}>
              <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>group</span>
            </div>
            <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No users found</p>
          </div>
        ) : (
          <div>
            {filteredUsers.map(user => {
              const rs = ROLE_STYLE[user.role] || { color: '#64748b', bg: '#f8fafc' }
              return (
                <div key={user.id} className="user-row">
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: rs.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '15px', color: rs.color }}>
                      {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#181c22', fontFamily: 'Manrope, sans-serif' }}>{user.full_name}</p>
                      <span className="role-chip" style={{ background: rs.bg, color: rs.color }}>
                        {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
                      </span>
                      {!user.is_approved && <span className="role-chip" style={{ background: '#fef2f2', color: '#ba1a1a' }}>Inactive</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: '#94a3b8' }}>
                      {user.district && <span className="flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>location_on</span>{user.district}</span>}
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>calendar_today</span>Joined {new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => openEdit(user)} className="action-btn"
                      style={{ borderColor: 'rgba(0,69,13,0.2)', color: '#00450d', background: 'white' }}>
                      Edit
                    </button>
                    <button onClick={() => toggleApproval(user)} className="action-btn"
                      style={{ borderColor: user.is_approved ? 'rgba(186,26,26,0.2)' : 'rgba(0,69,13,0.2)', color: user.is_approved ? '#ba1a1a' : '#00450d', background: 'white' }}>
                      {user.is_approved ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="px-8 py-4 flex items-center gap-3" style={{ borderTop: '1px solid rgba(0,69,13,0.06)', background: '#f9f9ff' }}>
          <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '16px' }}>info</span>
          <p className="text-xs" style={{ color: '#717a6d' }}>Showing {filteredUsers.length} of {users.length} users</p>
        </div>
      </div>

      {/* EDIT PROFILE MODAL */}
      {editingUser && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '20px', color: '#181c22', margin: 0 }}>Edit Profile</h2>
                <p style={{ fontSize: '13px', color: '#717a6d', margin: '2px 0 0' }}>{editingUser.full_name}</p>
              </div>
              <button onClick={() => setEditingUser(null)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#717a6d' }}>close</span>
              </button>
            </div>

            <form onSubmit={handleEditUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="field-label">Full Name</label>
                <input className="form-field" value={editData.full_name} onChange={e => setEditData({ ...editData, full_name: e.target.value })} required />
              </div>
              <div>
                <label className="field-label">Role</label>
                <select className="select-field" value={editData.role} onChange={e => setEditData({ ...editData, role: e.target.value })}>
                  {ALL_ROLES.map(r => (
                    <option key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">District</label>
                <select className="select-field" value={editData.district} onChange={e => setEditData({ ...editData, district: e.target.value })}>
                  <option value="">— None —</option>
                  {CMC_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Phone</label>
                <input className="form-field" placeholder="+94 77 000 0000" value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Organisation Name</label>
                <input className="form-field" placeholder="Company or org name" value={editData.organisation_name} onChange={e => setEditData({ ...editData, organisation_name: e.target.value })} />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="submit" disabled={saving} className="submit-btn" style={{ flex: 1, justifyContent: 'center' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditingUser(null)}
                  style={{ padding: '13px 20px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: 'white', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '14px', cursor: 'pointer', color: '#64748b' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}