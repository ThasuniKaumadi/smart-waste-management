'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { ROLE_LABELS } from '@/lib/types'
import { CMC_DISTRICTS, getWardsForDistrict } from '@/lib/districts'

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

const STAFF_ROLES = [
  { value: 'district_engineer', label: 'District Engineer', icon: 'engineering' },
  { value: 'engineer', label: 'Municipal Engineer', icon: 'person' },
  { value: 'contractor', label: 'Contractor', icon: 'local_shipping' },
  { value: 'recycling_partner', label: 'Recycler / Facility', icon: 'recycling' },
  { value: 'supervisor', label: 'Supervisor', icon: 'supervisor_account' },
  { value: 'driver', label: 'Driver', icon: 'drive_eta' },
]

const WASTE_TYPES = [
  { value: 'recyclable', label: 'Recyclable Waste' },
  { value: 'non_recyclable', label: 'Non-Recyclable' },
  { value: 'glass', label: 'Glass' },
  { value: 'e_waste', label: 'E-Waste' },
  { value: 'organic', label: 'Organic Waste' },
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
  recycling_partner: { color: '#15803d', bg: '#f0fdf4' },
  district_engineer: { color: '#d97706', bg: '#fffbeb' },
  engineer: { color: '#d97706', bg: '#fffbeb' },
  supervisor: { color: '#0891b2', bg: '#ecfeff' },
  driver: { color: '#64748b', bg: '#f8fafc' },
  resident: { color: '#ec4899', bg: '#fdf2f8' },
  commercial_establishment: { color: '#6366f1', bg: '#eef2ff' },
  admin: { color: '#ba1a1a', bg: '#fef2f2' },
}

interface Profile {
  id: string; full_name: string; role: string; district: string
  is_approved: boolean; created_at: string
  organisation_name?: string; phone?: string
}

function WardMultiSelect({ selected, onChange, district }: {
  selected: string[]; onChange: (wards: string[]) => void; district: string
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
      <div onClick={() => setOpen(!open)} style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e4e9e0', borderRadius: 10, fontSize: 14, color: '#181c22', fontFamily: 'Inter,sans-serif', background: '#fafbf9', cursor: 'pointer', minHeight: 44, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', boxSizing: 'border-box' }}>
        {selected.length === 0
          ? <span style={{ color: '#9ca3af' }}>Select wards (optional)</span>
          : selected.map(w => (
            <span key={w} style={{ background: '#f0fdf4', color: '#15803d', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
              {w}<span onClick={e => { e.stopPropagation(); toggle(w) }} style={{ cursor: 'pointer', opacity: 0.6 }}>×</span>
            </span>
          ))
        }
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'white', border: '1px solid rgba(0,69,13,0.1)', borderRadius: 12, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: 220, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
            <input type="text" placeholder="Search wards…" value={query} onChange={e => setQuery(e.target.value)} onClick={e => e.stopPropagation()} style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #e4e9e0', borderRadius: 8, fontSize: 13, fontFamily: 'Inter,sans-serif', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {!district ? (
              <div style={{ padding: 12, textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>Select a district first</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 12, textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>No wards found</div>
            ) : filtered.map(ward => (
              <div key={ward} onClick={() => toggle(ward)} style={{ padding: '9px 14px', fontSize: 13, fontFamily: 'Inter,sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: selected.includes(ward) ? '#f0fdf4' : 'white', color: selected.includes(ward) ? '#15803d' : '#181c22' }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${selected.includes(ward) ? '#15803d' : '#e4e9e0'}`, background: selected.includes(ward) ? '#15803d' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {selected.includes(ward) && <svg style={{ width: 9, height: 9 }} fill="none" stroke="white" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
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

const EMPTY_FORM = {
  firstName: '', lastName: '', email: '', password: '', role: '',
  district: '', phone: '',
  contractor_name: '', contractor_email: '', contractor_phone: '',
  contractor_address: '', contractor_district: '', business_registration_number: '',
  contract_number: '', contract_start_date: '', contract_end_date: '',
  contract_value: '', payment_terms: 'monthly',
  kpi_collection_rate: '95', kpi_ontime_rate: '90', kpi_complaint_limit: '10',
  terms_and_conditions: '',
  facility_name: '', facility_type: '', facility_type_custom: '',
  facility_address: '', facility_email: '', facility_phone: '',
  license_number: '', license_expiry: '', contractor_id: '', vehicle_registration: '',
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
  const [wasteTypes, setWasteTypes] = useState<string[]>([])
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editData, setEditData] = useState({ full_name: '', district: '', phone: '', organisation_name: '', role: '' })
  const [formData, setFormData] = useState(EMPTY_FORM)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)
    const { data: usersData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(usersData || [])
    const { data: contractorData } = await supabase.from('profiles').select('id,full_name,organisation_name,role,district,is_approved,created_at').eq('role', 'contractor')
    setContractors(contractorData || [])
    setLoading(false)
  }

  function resetForm() { setFormData(EMPTY_FORM); setAssignedWards([]); setWasteTypes([]) }

  function openEdit(user: Profile) {
    setEditingUser(user)
    setEditData({ full_name: user.full_name || '', district: user.district || '', phone: (user as any).phone || '', organisation_name: user.organisation_name || '', role: user.role || '' })
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault()
    if (!editingUser) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ full_name: editData.full_name, district: editData.district || null, phone: editData.phone || null, organisation_name: editData.organisation_name || null, role: editData.role }).eq('id', editingUser.id)
    if (error) setMessage('Error: ' + error.message)
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
    const loginEmail = formData.role === 'contractor' ? formData.contractor_email : formData.role === 'recycling_partner' ? formData.facility_email : formData.email
    const { data, error: signUpError } = await supabase.auth.signUp({ email: loginEmail, password: formData.password })
    if (signUpError) { setMessage('Error: ' + signUpError.message); setSaving(false); return }
    if (data.user) {
      const fullName = isPersonRole ? `${formData.firstName.trim()} ${formData.lastName.trim()}` : formData.role === 'contractor' ? formData.contractor_name : formData.facility_name
      const facilityTypeValue = formData.facility_type === 'custom' ? formData.facility_type_custom : formData.facility_type
      const profileInsert: any = { id: data.user.id, full_name: fullName, role: formData.role, is_approved: true }
      if (['district_engineer', 'supervisor'].includes(formData.role)) profileInsert.district = formData.district || null
      if (formData.role === 'supervisor') { profileInsert.assigned_wards = assignedWards.length > 0 ? assignedWards : null; profileInsert.phone = formData.phone || null }
      if (['district_engineer', 'engineer'].includes(formData.role)) profileInsert.phone = formData.phone || null
      if (formData.role === 'contractor') { profileInsert.organisation_name = formData.contractor_name || null; profileInsert.address = formData.contractor_address || null; profileInsert.phone = formData.contractor_phone || null; profileInsert.district = formData.contractor_district || null; profileInsert.business_registration_number = formData.business_registration_number || null }
      if (formData.role === 'recycling_partner') { profileInsert.organisation_name = formData.facility_name || null; profileInsert.address = formData.facility_address || null; profileInsert.phone = formData.facility_phone || null; profileInsert.waste_profile = wasteTypes.length > 0 ? wasteTypes.join\(', '\) : null }
      if (formData.role === 'driver') { profileInsert.phone = formData.phone || null; profileInsert.address = [formData.license_number, formData.vehicle_registration].filter(Boolean).join(' | ') || null }
      const { error: profileError } = await supabase.from('profiles').insert(profileInsert)
      if (profileError) {
        setMessage('Error creating profile: ' + profileError.message)
      } else {
        if (formData.role === 'contractor' && formData.contract_start_date && formData.contract_end_date) {
          await supabase.from('contracts').insert({ contractor_id: data.user.id, contract_number: formData.contract_number || `CMC-${Date.now()}`, start_date: formData.contract_start_date, end_date: formData.contract_end_date, monthly_payment_amount: parseFloat(formData.contract_value) || 0, payment_terms: formData.payment_terms || 'monthly', kpi_collection_rate: parseFloat(formData.kpi_collection_rate) || 95, kpi_ontime_rate: parseFloat(formData.kpi_ontime_rate) || 90, kpi_complaint_limit: parseInt(formData.kpi_complaint_limit) || 10, terms_and_conditions: formData.terms_and_conditions || null, districts_covered: formData.contractor_district ? [formData.contractor_district] : [], status: 'active' })
        }
        setMessage('Staff account created successfully!')
        setShowForm(false); resetForm(); loadData()
      }
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

  function toggleWasteType(val: string) {
    setWasteTypes(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
  }

  return (
    <DashboardLayout role="Admin" userName={profile?.full_name || ''} navItems={ADMIN_NAV}
      primaryAction={{ label: 'Create Staff Account', href: '#', icon: 'person_add' }}>
      <style>{`
        .msf { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .card { background:white; border-radius:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); overflow:hidden; }
        .stat-card { background:white; border-radius:20px; padding:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid rgba(0,69,13,0.05); transition:transform 0.2s,box-shadow 0.2s; }
        .stat-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.09); }
        .form-field { width:100%; padding:11px 14px; border:1.5px solid #e4e9e0; border-radius:10px; font-size:14px; color:#181c22; font-family:'Inter',sans-serif; background:#fafbf9; transition:all 0.2s; outline:none; box-sizing:border-box; }
        .form-field:focus { border-color:#00450d; background:white; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .form-field::placeholder { color:#9ca3af; }
        .select-field { width:100%; padding:11px 14px; border:1.5px solid #e4e9e0; border-radius:10px; font-size:14px; color:#181c22; font-family:'Inter',sans-serif; background:#fafbf9; transition:all 0.2s; outline:none; cursor:pointer; appearance:none; box-sizing:border-box; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23717a6d'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; background-size:14px; }
        .select-field:focus { border-color:#00450d; background-color:white; box-shadow:0 0 0 3px rgba(0,69,13,0.08); }
        .field-label { display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#41493e; font-family:'Manrope',sans-serif; margin-bottom:7px; }
        .submit-btn { background:#00450d; color:white; border:none; border-radius:12px; padding:13px 24px; font-family:'Manrope',sans-serif; font-weight:700; font-size:14px; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:8px; }
        .submit-btn:hover { background:#1b5e20; box-shadow:0 4px 16px rgba(0,69,13,0.25); transform:translateY(-1px); }
        .submit-btn:disabled { opacity:0.6; cursor:not-allowed; transform:none; }
        .role-chip { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:99px; font-size:10px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .role-pill { display:flex; align-items:center; gap:8px; padding:9px 14px; border-radius:10px; border:1.5px solid #e4e9e0; cursor:pointer; transition:all 0.2s; background:#fafbf9; font-size:13px; font-family:'Manrope',sans-serif; font-weight:600; color:#64748b; white-space:nowrap; }
        .role-pill:hover { border-color:#00450d; background:#f9fdf9; color:#181c22; }
        .role-pill.selected { border-color:#00450d; background:#f0fdf4; color:#00450d; }
        .user-row { padding:16px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; transition:background 0.15s; }
        .user-row:hover { background:#f9fbf9; }
        .user-row:last-child { border-bottom:none; }
        .filter-btn { padding:7px 16px; border-radius:99px; font-size:12px; font-weight:700; font-family:'Manrope',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
        .filter-btn.active { background:#00450d; color:white; }
        .filter-btn:not(.active) { background:#f1f5f9; color:#64748b; }
        .filter-btn:not(.active):hover { background:#e2e8f0; }
        .action-btn { padding:6px 14px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; transition:all 0.2s; border:1.5px solid; white-space:nowrap; }
        .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; }
        .section-box { background:#f0fdf4; border-radius:14px; padding:18px 20px; border:1px solid rgba(0,69,13,0.1); grid-column:1 / -1; }
        .section-box-label { font-size:11px; font-weight:700; color:#15803d; font-family:'Manrope',sans-serif; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:16px; display:flex; align-items:center; gap:6px; }
        .check-pill { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:99px; border:1.5px solid #e4e9e0; font-size:12px; font-weight:600; font-family:'Manrope',sans-serif; cursor:pointer; transition:all 0.15s; background:white; color:#64748b; }
        .check-pill.selected { border-color:#00450d; background:#f0fdf4; color:#15803d; }
        .toast { border-radius:14px; padding:14px 18px; font-size:13px; font-family:'Inter',sans-serif; display:flex; align-items:center; gap:10px; margin-bottom:20px; }
        .toast-ok  { background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; }
        .toast-err { background:#fef2f2; border:1px solid #fecaca; color:#dc2626; }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        .a1{animation:fadeUp .4s ease .04s both} .a2{animation:fadeUp .4s ease .09s both} .a3{animation:fadeUp .4s ease .14s both}
        .slide-down { animation:slideDown 0.3s ease both; }
        .modal-overlay { animation:fadeIn 0.2s ease; }
        @media (max-width:768px) { .form-grid { grid-template-columns:1fr; } }
      `}</style>

      {/* ── Heading ── */}
      <div className="a1" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: '#94a3b8', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', margin: '0 0 6px' }}>
              👥 System Administration
            </p>
            <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 46, fontWeight: 800, color: '#181c22', lineHeight: 1.05, margin: '0 0 4px' }}>
              User <span style={{ color: '#00450d' }}>Management</span>
            </h1>
            <p style={{ fontSize: 13, color: '#717a6d', margin: 0 }}>
              {new Date().toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button onClick={() => { setShowForm(!showForm); if (showForm) resetForm() }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, background: showForm ? '#f1f5f9' : '#00450d', color: showForm ? '#64748b' : 'white', border: 'none', cursor: 'pointer', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, transition: 'all 0.2s' }}>
            <span className="msf" style={{ fontSize: 18 }}>{showForm ? 'close' : 'person_add'}</span>
            {showForm ? 'Cancel' : 'Create Staff Account'}
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="a2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Users', value: users.length, icon: 'group', color: '#15803d', bg: '#f0fdf4' },
          { label: 'Staff', value: users.filter(u => !['resident', 'commercial_establishment'].includes(u.role)).length, icon: 'badge', color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Active', value: users.filter(u => u.is_approved).length, icon: 'check_circle', color: '#15803d', bg: '#f0fdf4' },
          { label: 'Inactive', value: users.filter(u => !u.is_approved).length, icon: 'cancel', color: '#ba1a1a', bg: '#fef2f2' },
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

      {/* ── Toast ── */}
      {message && (
        <div className={`toast ${message.startsWith('Error') ? 'toast-err' : 'toast-ok'}`}>
          <span className="msf" style={{ fontSize: 18 }}>{message.startsWith('Error') ? 'error' : 'check_circle'}</span>
          {message}
        </div>
      )}

      {/* ── Create form ── */}
      {showForm && (
        <div className="card slide-down" style={{ marginBottom: 24 }}>
          <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(0,69,13,0.05)' }}>
            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 17, color: '#181c22', margin: 0 }}>Create Staff Account</h3>
            <p style={{ fontSize: 13, color: '#717a6d', margin: '4px 0 0' }}>Select a user type then fill in the details.</p>
          </div>
          <form onSubmit={handleCreateUser} style={{ padding: 28 }}>

            {/* Role selector */}
            <div style={{ marginBottom: 28 }}>
              <label className="field-label">User Type *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {STAFF_ROLES.map(role => (
                  <div key={role.value} onClick={() => { setFormData({ ...EMPTY_FORM, role: role.value }); setAssignedWards([]); setWasteTypes([]) }}
                    className={`role-pill ${formData.role === role.value ? 'selected' : ''}`}>
                    <span className="msf" style={{ fontSize: 16 }}>{role.icon}</span>
                    {role.label}
                    {formData.role === role.value && (
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#00450d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg style={{ width: 8, height: 8 }} fill="none" stroke="white" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Person roles */}
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
              <div style={{ marginBottom: 20 }} className="slide-down">
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
                  <label className="field-label">Assigned Wards <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(Optional)</span></label>
                  <WardMultiSelect selected={assignedWards} onChange={setAssignedWards} district={formData.district} />
                </div>
              </div>
            )}

            {isDriver && (
              <div className="form-grid slide-down">
                <div><label className="field-label">Driving Licence Number *</label><input type="text" className="form-field" placeholder="e.g. B1234567" value={formData.license_number} onChange={e => setFormData({ ...formData, license_number: e.target.value })} /></div>
                <div><label className="field-label">Licence Expiry Date</label><input type="date" className="form-field" value={formData.license_expiry} min={new Date().toISOString().split('T')[0]} onChange={e => setFormData({ ...formData, license_expiry: e.target.value })} /></div>
                <div><label className="field-label">Vehicle Registration</label><input type="text" className="form-field" placeholder="e.g. WP CAB-1234" value={formData.vehicle_registration} onChange={e => setFormData({ ...formData, vehicle_registration: e.target.value })} /></div>
                <div>
                  <label className="field-label">Assigned Contractor</label>
                  {contractors.length === 0 ? (
                    <div style={{ padding: '12px 14px', borderRadius: 10, background: '#fffbeb', border: '1px solid rgba(217,119,6,0.2)', fontSize: 13, color: '#92400e' }}>⚠ No contractor accounts found.</div>
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
                <div><label className="field-label">Company Name *</label><input type="text" className="form-field" placeholder="e.g. Lanka Waste Services Ltd" value={formData.contractor_name} onChange={e => setFormData({ ...formData, contractor_name: e.target.value })} required /></div>
                <div><label className="field-label">Company Email *</label><input type="email" className="form-field" placeholder="company@example.com" value={formData.contractor_email} onChange={e => setFormData({ ...formData, contractor_email: e.target.value })} required /></div>
                <div><label className="field-label">Phone</label><input type="text" className="form-field" placeholder="+94 11 000 0000" value={formData.contractor_phone} onChange={e => setFormData({ ...formData, contractor_phone: e.target.value })} /></div>
                <div><label className="field-label">Password *</label><input type="password" className="form-field" placeholder="Min. 8 characters" value={formData.password} minLength={8} onChange={e => setFormData({ ...formData, password: e.target.value })} required /></div>
                <div><label className="field-label">Business Registration No.</label><input type="text" className="form-field" placeholder="e.g. PV 12345" value={formData.business_registration_number} onChange={e => setFormData({ ...formData, business_registration_number: e.target.value })} /></div>
                <div>
                  <label className="field-label">Operating District</label>
                  <select className="select-field" value={formData.contractor_district} onChange={e => setFormData({ ...formData, contractor_district: e.target.value })}>
                    <option value="">Select district</option>
                    {CMC_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}><label className="field-label">Company Address</label><input type="text" className="form-field" placeholder="123 Main Street, Colombo 03" value={formData.contractor_address} onChange={e => setFormData({ ...formData, contractor_address: e.target.value })} /></div>
                <div className="section-box">
                  <div className="section-box-label">
                    <span className="msf" style={{ fontSize: 16 }}>description</span>
                    Contract Details
                    <span style={{ fontWeight: 400, color: '#717a6d', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(optional — can be added later)</span>
                  </div>
                  <div className="form-grid" style={{ marginBottom: 0 }}>
                    <div><label className="field-label">Contract Number</label><input type="text" className="form-field" placeholder="e.g. CMC-2024-001" value={formData.contract_number} onChange={e => setFormData({ ...formData, contract_number: e.target.value })} /></div>
                    <div><label className="field-label">Monthly Value (LKR)</label><input type="number" className="form-field" placeholder="e.g. 500000" value={formData.contract_value} onChange={e => setFormData({ ...formData, contract_value: e.target.value })} /></div>
                    <div><label className="field-label">Start Date</label><input type="date" className="form-field" value={formData.contract_start_date} onChange={e => setFormData({ ...formData, contract_start_date: e.target.value })} /></div>
                    <div><label className="field-label">End Date</label><input type="date" className="form-field" value={formData.contract_end_date} onChange={e => setFormData({ ...formData, contract_end_date: e.target.value })} /></div>
                    <div>
                      <label className="field-label">Payment Terms</label>
                      <select className="select-field" value={formData.payment_terms} onChange={e => setFormData({ ...formData, payment_terms: e.target.value })}>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="annually">Annually</option>
                      </select>
                    </div>
                    <div><label className="field-label">KPI — Complaint Limit</label><input type="number" className="form-field" placeholder="10" value={formData.kpi_complaint_limit} onChange={e => setFormData({ ...formData, kpi_complaint_limit: e.target.value })} /></div>
                    <div><label className="field-label">KPI — Collection Rate (%)</label><input type="number" className="form-field" placeholder="95" value={formData.kpi_collection_rate} onChange={e => setFormData({ ...formData, kpi_collection_rate: e.target.value })} /></div>
                    <div><label className="field-label">KPI — On-time Rate (%)</label><input type="number" className="form-field" placeholder="90" value={formData.kpi_ontime_rate} onChange={e => setFormData({ ...formData, kpi_ontime_rate: e.target.value })} /></div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="field-label">Terms &amp; Conditions</label>
                      <textarea className="form-field" placeholder="Enter contract terms and conditions…" value={formData.terms_and_conditions} onChange={e => setFormData({ ...formData, terms_and_conditions: e.target.value })} rows={3} style={{ resize: 'vertical' }} />
                    </div>
                  </div>
                </div>
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
                <div className="section-box">
                  <div className="section-box-label">
                    <span className="msf" style={{ fontSize: 16 }}>recycling</span>
                    Waste Types Accepted
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {WASTE_TYPES.map(t => (
                      <div key={t.value} onClick={() => toggleWasteType(t.value)} className={`check-pill ${wasteTypes.includes(t.value) ? 'selected' : ''}`}>
                        {wasteTypes.includes(t.value) && <svg style={{ width: 10, height: 10 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        {t.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <button type="submit" disabled={saving || !formData.role} className="submit-btn">
                {saving ? (
                  <><div style={{ width: 16, height: 16, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />Creating…</>
                ) : (
                  <><span className="msf" style={{ fontSize: 18 }}>person_add</span>Create Staff Account</>
                )}
              </button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }}
                style={{ padding: '13px 24px', borderRadius: 12, border: '1.5px solid #e4e9e0', background: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#64748b' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── User list ── */}
      <div className="card a3">
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(0,69,13,0.05)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 17, color: '#181c22', margin: 0 }}>All Users</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <span className="msf" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#94a3b8' }}>search</span>
              <input type="text" placeholder="Search by name…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 34, paddingRight: 12, paddingTop: 7, paddingBottom: 7, border: '1.5px solid #e4e9e0', borderRadius: 99, fontSize: 13, fontFamily: 'Inter,sans-serif', outline: 'none', background: '#fafbf9', width: 180, color: '#181c22' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {['all', 'district_engineer', 'supervisor', 'driver', 'contractor', 'resident'].map(f => (
                <button key={f} onClick={() => setFilterRole(f)} className={`filter-btn ${filterRole === f ? 'active' : ''}`}>
                  {f === 'all' ? 'All' : f === 'district_engineer' ? 'DE' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ width: 28, height: 28, border: '2px solid #00450d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <span className="msf" style={{ color: '#00450d', fontSize: 28 }}>group</span>
            </div>
            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 15, color: '#181c22' }}>No users found</p>
          </div>
        ) : filteredUsers.map(user => {
          const rs = ROLE_STYLE[user.role] || { color: '#64748b', bg: '#f8fafc' }
          return (
            <div key={user.id} className="user-row">
              <div style={{ width: 40, height: 40, borderRadius: 12, background: rs.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: 15, color: rs.color }}>{user.full_name?.charAt(0)?.toUpperCase() || '?'}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#181c22', fontFamily: 'Manrope,sans-serif', margin: 0 }}>{user.full_name}</p>
                  <span className="role-chip" style={{ background: rs.bg, color: rs.color }}>{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}</span>
                  {!user.is_approved && <span className="role-chip" style={{ background: '#fef2f2', color: '#ba1a1a' }}>Inactive</span>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, fontSize: 12, color: '#94a3b8' }}>
                  {user.district && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msf" style={{ fontSize: 13 }}>location_on</span>{user.district}</span>}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span className="msf" style={{ fontSize: 13 }}>calendar_today</span>Joined {new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => openEdit(user)} className="action-btn" style={{ borderColor: 'rgba(0,69,13,0.2)', color: '#15803d', background: 'white' }}>Edit</button>
                <button onClick={() => toggleApproval(user)} className="action-btn" style={{ borderColor: user.is_approved ? 'rgba(186,26,26,0.2)' : 'rgba(0,69,13,0.2)', color: user.is_approved ? '#ba1a1a' : '#15803d', background: 'white' }}>
                  {user.is_approved ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          )
        })}

        <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(0,69,13,0.05)', background: '#fafbf9', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="msf" style={{ color: '#00450d', fontSize: 16 }}>info</span>
          <p style={{ fontSize: 12, color: '#717a6d', margin: 0 }}>Showing {filteredUsers.length} of {users.length} users</p>
        </div>
      </div>

      {/* ── Edit modal ── */}
      {editingUser && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', borderRadius: 24, padding: 32, width: '100%', maxWidth: 500, boxShadow: '0 24px 80px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 20, color: '#181c22', margin: 0 }}>Edit Profile</h2>
                <p style={{ fontSize: 13, color: '#717a6d', margin: '3px 0 0' }}>{editingUser.full_name}</p>
              </div>
              <button onClick={() => setEditingUser(null)} style={{ background: '#f4f6f3', border: 'none', borderRadius: 10, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="msf" style={{ fontSize: 18, color: '#717a6d' }}>close</span>
              </button>
            </div>
            <form onSubmit={handleEditUser} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div><label className="field-label">Full Name</label><input className="form-field" value={editData.full_name} onChange={e => setEditData({ ...editData, full_name: e.target.value })} required /></div>
              <div>
                <label className="field-label">Role</label>
                <select className="select-field" value={editData.role} onChange={e => setEditData({ ...editData, role: e.target.value })}>
                  {ALL_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">District</label>
                <select className="select-field" value={editData.district} onChange={e => setEditData({ ...editData, district: e.target.value })}>
                  <option value="">— None —</option>
                  {CMC_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div><label className="field-label">Phone</label><input className="form-field" placeholder="+94 77 000 0000" value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} /></div>
              <div><label className="field-label">Organisation Name</label><input className="form-field" placeholder="Company or org name" value={editData.organisation_name} onChange={e => setEditData({ ...editData, organisation_name: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" disabled={saving} className="submit-btn" style={{ flex: 1, justifyContent: 'center' }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditingUser(null)} style={{ padding: '13px 20px', borderRadius: 12, border: '1.5px solid #e4e9e0', background: 'white', fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#64748b' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}


