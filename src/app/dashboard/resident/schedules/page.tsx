'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

const WASTE_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  organic: { label: 'Organic Waste', color: 'text-green-700', bg: 'bg-green-100' },
  non_recyclable: { label: 'Non-Recyclable Waste', color: 'text-red-700', bg: 'bg-red-100' },
  recyclable: { label: 'Recyclable Waste', color: 'text-blue-700', bg: 'bg-blue-100' },
  e_waste: { label: 'E-Waste', color: 'text-purple-700', bg: 'bg-purple-100' },
  bulk: { label: 'Bulk Waste', color: 'text-orange-700', bg: 'bg-orange-100' },
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const FREQUENCIES: Record<string, string> = {
  daily: 'Daily',
  twice_weekly: 'Twice a week',
  weekly: 'Once a week',
}

interface Schedule {
  id: string
  district: string
  waste_type: string
  collection_day: string
  collection_time: string
  frequency: string
  notes: string
}

export default function ResidentSchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    loadSchedules()
  }, [])

  async function loadSchedules() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    setProfile(profileData)

    const { data: schedulesData } = await supabase
      .from('schedules')
      .select('*')
      .eq('district', profileData?.district || '')
      .eq('published', true)
      .order('collection_day', { ascending: true })

    setSchedules(schedulesData || [])
    setLoading(false)
  }

  const getTodaySchedules = () => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })
    return schedules.filter(s => s.collection_day === today)
  }

  const todaySchedules = getTodaySchedules()

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

        <h1 className="text-2xl font-bold text-slate-800 mb-1">Collection Schedule</h1>
        <p className="text-slate-500 text-sm mb-6">
          District: {profile?.district || 'Not set'}
        </p>

        {todaySchedules.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-700 font-medium text-sm mb-2">
              Today's Collections
            </p>
            {todaySchedules.map(s => (
              <div key={s.id} className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${WASTE_TYPES[s.waste_type]?.bg} ${WASTE_TYPES[s.waste_type]?.color}`}>
                  {WASTE_TYPES[s.waste_type]?.label}
                </span>
                <span className="text-green-600 text-sm">at {s.collection_time}</span>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading schedule...</div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-lg">No schedules published yet</p>
            <p className="text-sm mt-1">Your district engineer will publish schedules soon</p>
          </div>
        ) : (
          <div className="space-y-4">
            {DAYS.map(day => {
              const daySchedules = schedules.filter(s => s.collection_day === day)
              if (daySchedules.length === 0) return null
              return (
                <Card key={day} className="border-0 shadow-sm">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-base text-slate-700">{day}</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="space-y-2">
                      {daySchedules.map(schedule => (
                        <div key={schedule.id} className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${WASTE_TYPES[schedule.waste_type]?.bg} ${WASTE_TYPES[schedule.waste_type]?.color}`}>
                            {WASTE_TYPES[schedule.waste_type]?.label}
                          </span>
                          <span className="text-slate-600 text-sm">
                            {schedule.collection_time}
                          </span>
                          <span className="text-slate-400 text-xs">
                            {FREQUENCIES[schedule.frequency]}
                          </span>
                          {schedule.notes && (
                            <span className="text-slate-400 text-xs">— {schedule.notes}</span>
                          )}
                        </div>
                      ))}
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