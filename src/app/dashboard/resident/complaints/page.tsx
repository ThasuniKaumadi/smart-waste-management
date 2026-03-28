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
import { logComplaintOnChain } from '@/lib/blockchain'

const COMPLAINT_TYPES = [
  { value: 'missed_collection', label: 'Missed Collection' },
  { value: 'delayed_collection', label: 'Delayed Collection' },
  { value: 'illegal_dumping', label: 'Illegal Dumping' },
  { value: 'blocked_drainage', label: 'Blocked Drainage by Waste' },
  { value: 'collection_refusal', label: 'Collection Refusal' },
  { value: 'other', label: 'Other' },
]

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
}

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  in_progress: 'In Progress',
  resolved: 'Resolved',
}

interface Complaint {
  id: string
  description: string
  complaint_type: string
  status: string
  blockchain_tx: string
  created_at: string
}

export default function ResidentComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [formData, setFormData] = useState({
    complaint_type: '',
    description: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    setProfile(profileData)

    const { data: complaintsData } = await supabase
      .from('complaints')
      .select('*')
      .eq('submitted_by', user.id)
      .order('created_at', { ascending: false })

    setComplaints(complaintsData || [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    if (!formData.complaint_type || !formData.description) {
      setMessage('Please fill in all fields')
      setSaving(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: complaintData, error } = await supabase.from('complaints').insert({
      submitted_by: user?.id,
      district: profile?.district,
      complaint_type: formData.complaint_type,
      description: formData.description,
      status: 'submitted',
    }).select().single()

    if (!error && complaintData) {
      const txHash = await logComplaintOnChain(
        complaintData.id,
        profile?.district || ''
      )
      if (txHash) {
        await supabase
          .from('complaints')
          .update({ blockchain_tx: txHash })
          .eq('id', complaintData.id)
      }
    }

    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setMessage('Complaint submitted successfully!')
      setShowForm(false)
      setFormData({ complaint_type: '', description: '' })
      loadData()
    }
    setSaving(false)
  }

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
          <span className="text-blue-100 text-sm">{profile?.full_name}</span>
          <span className="bg-blue-600 text-xs px-2 py-1 rounded-full">Resident</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard/resident" className="text-blue-600 hover:underline text-sm">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">My Complaints</h1>
            <p className="text-slate-500 text-sm mt-1">District: {profile?.district}</p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {showForm ? 'Cancel' : '+ New Complaint'}
          </Button>
        </div>

        {message && (
          <div className={`p-3 rounded-lg mb-4 text-sm ${message.startsWith('Error')
            ? 'bg-red-50 text-red-600 border border-red-200'
            : 'bg-green-50 text-green-600 border border-green-200'
            }`}>
            {message}
          </div>
        )}

        {showForm && (
          <Card className="mb-6 border-blue-200 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg text-slate-800">Submit a Complaint</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Complaint Type</Label>
                  <Select onValueChange={(v) => setFormData({ ...formData, complaint_type: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select complaint type" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPLAINT_TYPES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea
                    className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-24"
                    placeholder="Describe your complaint in detail..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={saving}
                >
                  {saving ? 'Submitting...' : 'Submit Complaint'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading complaints...</div>
        ) : complaints.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-lg">No complaints submitted yet</p>
            <p className="text-sm mt-1">Click "New Complaint" to report an issue</p>
          </div>
        ) : (
          <div className="space-y-4">
            {complaints.map((complaint) => (
              <Card key={complaint.id} className="border-0 shadow-sm">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium text-slate-800 text-sm">
                          {COMPLAINT_TYPES.find(c => c.value === complaint.complaint_type)?.label || complaint.complaint_type}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[complaint.status]}`}>
                          {STATUS_LABELS[complaint.status]}
                        </span>
                      </div>
                      <p className="text-slate-600 text-sm">{complaint.description}</p>
                      <p className="text-slate-400 text-xs mt-2">
                        Submitted: {new Date(complaint.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </p>
                      {complaint.blockchain_tx && (
                        <p className="text-blue-500 text-xs mt-1 font-mono">
                          Blockchain TX: {complaint.blockchain_tx.slice(0, 20)}...
                        </p>
                      )}
                    </div>
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