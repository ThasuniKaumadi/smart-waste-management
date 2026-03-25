'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { DISTRICTS } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const WASTE_TYPES = [
  { value: 'organic', label: 'Organic Waste', color: 'bg-green-100 text-green-800' },
  { value: 'non_recyclable', label: 'Non-Recyclable Waste', color: 'bg-red-100 text-red-800' },
  { value: 'recyclable', label: 'Recyclable Waste', color: 'bg-blue-100 text-blue-800' },
  { value: 'e_waste', label: 'E-Waste', color: 'bg-purple-100 text-purple-800' },
  { value: 'bulk', label: 'Bulk Waste', color: 'bg-orange-100 text-orange-800' },
]

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'twice_weekly', label: 'Twice a Week' },
  { value: 'weekly', label: 'Once a Week' },
]

interface Schedule {
  id: string
  district: string
  waste_type: string
  collection_day: string
  collection_time: string
  frequency: string
  notes: string
  published: boolean
  created_at: string
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [formData, setFormData] = useState({
    district: '',
    waste_type: '',
    collection_day: '',
    collection_time: '08:00',
    frequency: 'weekly',
    notes: '',
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
    setFormData(prev => ({ ...prev, district: profileData?.district || '' }))

    const { data: schedulesData } = await supabase
      .from('schedules')
      .select('*')
      .eq('district', profileData?.district || '')
      .order('collection_day', { ascending: true })

    setSchedules(schedulesData || [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('schedules').insert({
      ...formData,
      created_by: user?.id,
      published: false,
    })

    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setMessage('Schedule created successfully!')
      setShowForm(false)
      setFormData(prev => ({
        ...prev,
        waste_type: '',
        collection_day: '',
        collection_time: '08:00',
        frequency: 'weekly',
        notes: '',
      }))
      loadData()
    }
    setSaving(false)
  }

  async function togglePublish(schedule: Schedule) {
    const supabase = createClient()
    const { error } = await supabase
      .from('schedules')
      .update({ published: !schedule.published })
      .eq('id', schedule.id)

    if (!error) loadData()
  }

  async function deleteSchedule(id: string) {
    const supabase = createClient()
    await supabase.from('schedules').delete().eq('id', id)
    loadData()
  }

  const getWasteType = (value: string) =>
    WASTE_TYPES.find(w => w.value === value)

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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Collection Schedules</h1>
            <p className="text-slate-500 text-sm mt-1">District: {profile?.district}</p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {showForm ? 'Cancel' : '+ New Schedule'}
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
              <CardTitle className="text-lg text-slate-800">Create New Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Waste Type</Label>
                  <Select onValueChange={(v) => setFormData({ ...formData, waste_type: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select waste type" />
                    </SelectTrigger>
                    <SelectContent>
                      {WASTE_TYPES.map(w => (
                        <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Collection Day</Label>
                  <Select onValueChange={(v) => setFormData({ ...formData, collection_day: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map(day => (
                        <SelectItem key={day} value={day}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Collection Time</Label>
                  <Input
                    type="time"
                    value={formData.collection_time}
                    onChange={(e) => setFormData({ ...formData, collection_time: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    defaultValue="weekly"
                    onValueChange={(v) => setFormData({ ...formData, frequency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Notes (optional)</Label>
                  <Input
                    placeholder="Any additional notes for residents"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Create Schedule'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading schedules...</div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-lg">No schedules created yet</p>
            <p className="text-sm mt-1">Click "New Schedule" to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {schedules.map((schedule) => {
              const wasteType = getWasteType(schedule.waste_type)
              return (
                <Card key={schedule.id} className={`border-l-4 ${schedule.published ? 'border-l-green-500' : 'border-l-slate-300'}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${wasteType?.color}`}>
                          {wasteType?.label}
                        </span>
                        <div>
                          <p className="font-medium text-slate-800">
                            {schedule.collection_day} at {schedule.collection_time}
                          </p>
                          <p className="text-sm text-slate-500">
                            {FREQUENCIES.find(f => f.value === schedule.frequency)?.label}
                            {schedule.notes && ` — ${schedule.notes}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          schedule.published
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {schedule.published ? 'Published' : 'Draft'}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => togglePublish(schedule)}
                          className={schedule.published ? 'border-orange-300 text-orange-600' : 'border-green-300 text-green-600'}
                        >
                          {schedule.published ? 'Unpublish' : 'Publish'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteSchedule(schedule.id)}
                          className="border-red-300 text-red-600"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}