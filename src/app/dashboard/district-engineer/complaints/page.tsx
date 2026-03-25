'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'

const COMPLAINT_TYPES: Record<string, string> = {
  missed_collection: 'Missed Collection',
  delayed_collection: 'Delayed Collection',
  illegal_dumping: 'Illegal Dumping',
  blocked_drainage: 'Blocked Drainage by Waste',
  collection_refusal: 'Collection Refusal',
  other: 'Other',
}

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
  district: string
  resolution_notes: string
  created_at: string
  profiles: {
    full_name: string
    address: string
  }
}

export default function EngineerComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState('')

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
      .select(`*, profiles(full_name, address)`)
      .eq('district', profileData?.district || '')
      .order('created_at', { ascending: false })

    setComplaints(complaintsData || [])
    setLoading(false)
  }

  async function updateStatus(complaint: Complaint, newStatus: string) {
    setUpdating(true)
    setMessage('')

    const supabase = createClient()
    const { error } = await supabase
      .from('complaints')
      .update({
        status: newStatus,
        resolution_notes: resolutionNotes,
      })
      .eq('id', complaint.id)

    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setMessage('Complaint updated successfully!')
      setSelectedComplaint(null)
      setResolutionNotes('')
      loadData()
    }
    setUpdating(false)
  }

  const filteredComplaints = filterStatus === 'all'
    ? complaints
    : complaints.filter(c => c.status === filterStatus)

  const counts = {
    all: complaints.length,
    submitted: complaints.filter(c => c.status === 'submitted').length,
    in_progress: complaints.filter(c => c.status === 'in_progress').length,
    resolved: complaints.filter(c => c.status === 'resolved').length,
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
          <span className="bg-blue-600 text-xs px-2 py-1 rounded-full">District Engineer</span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard/district-engineer" className="text-blue-600 hover:underline text-sm">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Complaints Management</h1>
            <p className="text-slate-500 text-sm mt-1">District: {profile?.district}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { key: 'all', label: 'All', color: 'bg-slate-600' },
            { key: 'submitted', label: 'Submitted', color: 'bg-yellow-500' },
            { key: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
            { key: 'resolved', label: 'Resolved', color: 'bg-green-500' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setFilterStatus(item.key)}
              className={`p-4 rounded-lg text-white text-left transition-opacity ${item.color} ${
                filterStatus === item.key ? 'opacity-100 shadow-md' : 'opacity-60'
              }`}
            >
              <p className="text-2xl font-bold">{counts[item.key as keyof typeof counts]}</p>
              <p className="text-xs mt-1 opacity-90">{item.label}</p>
            </button>
          ))}
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

        {selectedComplaint && (
          <Card className="mb-6 border-blue-200 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg text-slate-800">
                Update Complaint Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-slate-700">
                  {COMPLAINT_TYPES[selectedComplaint.complaint_type] || selectedComplaint.complaint_type}
                </p>
                <p className="text-sm text-slate-600 mt-1">{selectedComplaint.description}</p>
                <p className="text-xs text-slate-400 mt-1">
                  By: {selectedComplaint.profiles?.full_name}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Resolution Notes</label>
                <textarea
                  className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-20"
                  placeholder="Add notes about how this was resolved..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => updateStatus(selectedComplaint, 'in_progress')}
                  disabled={updating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Mark In Progress
                </Button>
                <Button
                  onClick={() => updateStatus(selectedComplaint, 'resolved')}
                  disabled={updating}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Mark Resolved
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedComplaint(null)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading complaints...</div>
        ) : filteredComplaints.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-lg">No complaints found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredComplaints.map((complaint) => (
              <Card key={complaint.id} className={`border-0 shadow-sm border-l-4 ${
                complaint.status === 'resolved' ? 'border-l-green-500' :
                complaint.status === 'in_progress' ? 'border-l-blue-500' :
                'border-l-yellow-500'
              }`}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium text-slate-800 text-sm">
                          {COMPLAINT_TYPES[complaint.complaint_type] || complaint.complaint_type}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[complaint.status]}`}>
                          {STATUS_LABELS[complaint.status]}
                        </span>
                      </div>
                      <p className="text-slate-600 text-sm">{complaint.description}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <p className="text-slate-400 text-xs">
                          By: {complaint.profiles?.full_name || 'Unknown'}
                        </p>
                        <p className="text-slate-400 text-xs">
                          {new Date(complaint.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </p>
                      </div>
                      {complaint.resolution_notes && (
                        <p className="text-slate-500 text-xs mt-2 italic">
                          Note: {complaint.resolution_notes}
                        </p>
                      )}
                    </div>
                    {complaint.status !== 'resolved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedComplaint(complaint)
                          setResolutionNotes(complaint.resolution_notes || '')
                        }}
                        className="ml-4 border-blue-300 text-blue-600"
                      >
                        Update
                      </Button>
                    )}
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