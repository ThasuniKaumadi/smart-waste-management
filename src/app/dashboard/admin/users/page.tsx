'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'
import { DISTRICTS, ROLE_LABELS } from '@/lib/types'

const ADMIN_ROLES = [
  'contractor',
  'recycling_partner',
  'facility_operator',
  'district_engineer',
  'engineer',
  'supervisor',
  'driver',
]

interface Profile {
  id: string
  full_name: string
  role: string
  district: string
  email?: string
  is_approved: boolean
  created_at: string
  organisation_name?: string
}

const ROLE_COLORS: Record<string, string> = {
  contractor: 'bg-blue-100 text-blue-700',
  recycling_partner: 'bg-green-100 text-green-700',
  facility_operator: 'bg-purple-100 text-purple-700',
  district_engineer: 'bg-orange-100 text-orange-700',
  engineer: 'bg-yellow-100 text-yellow-700',
  supervisor: 'bg-teal-100 text-teal-700',
  driver: 'bg-slate-100 text-slate-700',
  resident: 'bg-pink-100 text-pink-700',
  commercial_establishment: 'bg-indigo-100 text-indigo-700',
  admin: 'bg-red-100 text-red-700',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: '',
    district: '',
    address: '',
    organisation_name: '',
    phone: '',
  })

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    setUsers(data || [])
    setLoading(false)
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
    })

    if (signUpError) {
      setMessage('Error: ' + signUpError.message)
      setSaving(false)
      return
    }

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          full_name: formData.full_name,
          role: formData.role,
          district: formData.district,
          address: formData.address,
          organisation_name: formData.organisation_name,
          phone: formData.phone,
          is_approved: true,
        })

      if (profileError) {
        setMessage('Error creating profile: ' + profileError.message)
      } else {
        setMessage('User created successfully!')
        setShowForm(false)
        setFormData({
          full_name: '',
          email: '',
          password: '',
          role: '',
          district: '',
          address: '',
          organisation_name: '',
          phone: '',
        })
        loadUsers()
      }
    }
    setSaving(false)
  }

  async function toggleApproval(user: Profile) {
    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({ is_approved: !user.is_approved })
      .eq('id', user.id)
    loadUsers()
  }

  const filteredUsers = users.filter(u => {
    const matchesRole = filterRole === 'all' || u.role === filterRole
    const matchesSearch = u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesRole && matchesSearch
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between shadow">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="font-semibold text-lg">Smart Waste Management</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="bg-red-500 text-xs px-2 py-1 rounded-full">System Administrator</span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard/admin" className="text-blue-600 hover:underline text-sm">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
            <p className="text-slate-500 text-sm mt-1">
              {users.length} total users in the system
            </p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {showForm ? 'Cancel' : '+ Create Staff Account'}
          </Button>
        </div>

        {message && (
          <div className={`p-3 rounded-lg mb-4 text-sm ${
            message.startsWith('Error')
              ? 'bg-red-50 text-red-600 border border-red-200'
              : 'bg-green-50 text-green-600 border border-green-200'
          }`}>
            {message}
          </div>
        )}

        {showForm && (
          <Card className="mb-6 border-blue-200 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg text-slate-800">Create Staff Account</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    placeholder="Full name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="Min. 8 characters"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={8}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select onValueChange={(v) => setFormData({ ...formData, role: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ADMIN_ROLES.map(role => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role as keyof typeof ROLE_LABELS]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>District</Label>
                  <Select onValueChange={(v) => setFormData({ ...formData, district: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select district" />
                    </SelectTrigger>
                    <SelectContent>
                      {DISTRICTS.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    placeholder="+94 77 000 0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Address</Label>
                  <Input
                    placeholder="Address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={saving}
                  >
                    {saving ? 'Creating...' : 'Create Account'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4 mb-6">
          <Input
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
          <Select onValueChange={setFilterRole} defaultValue="all">
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {ADMIN_ROLES.map(role => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role as keyof typeof ROLE_LABELS]}
                </SelectItem>
              ))}
              <SelectItem value="resident">Resident</SelectItem>
              <SelectItem value="commercial_establishment">Commercial Establishment</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p>No users found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((user) => (
              <Card key={user.id} className="border-0 shadow-sm">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium text-sm">
                          {user.full_name?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-800 text-sm">
                            {user.full_name}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[user.role] || 'bg-slate-100 text-slate-700'}`}>
                            {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
                          </span>
                          {!user.is_approved && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5">
                          {user.district || 'No district'} |
                          Joined {new Date(user.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleApproval(user)}
                      className={user.is_approved
                        ? 'border-red-300 text-red-600 hover:bg-red-50'
                        : 'border-green-300 text-green-600 hover:bg-green-50'
                      }
                    >
                      {user.is_approved ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}