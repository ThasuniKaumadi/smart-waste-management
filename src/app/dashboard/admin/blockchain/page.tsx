'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function BlockchainViewerPage() {
  const [collections, setCollections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('collection_events')
        .select('*')
        .not('blockchain_tx', 'is', null)
        .order('created_at', { ascending: false })
      setCollections(data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <Link href="/dashboard/admin" className="text-blue-600 hover:underline text-sm">
        Back to Dashboard
      </Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-4 mb-6">Blockchain Logs</h1>
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
        <p className="text-purple-700 text-sm font-medium">
          Contract: 0x5fddc7920b5b9c7f7c9fed119d05640cef9daa05
        </p>
        <a
          href="https://amoy.polygonscan.com/address/0x5fddc7920b5b9c7f7c9fed119d05640cef9daa05"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-600 text-xs hover:underline"
        >
          View on Polygonscan
        </a>
      </div>
      {loading && <p className="text-slate-400">Loading...</p>}
      {!loading && collections.length === 0 && (
        <p className="text-slate-400 text-center py-8">No blockchain records yet</p>
      )}
      {!loading && collections.map((e) => (
        <div key={e.id} className="bg-white rounded-lg p-4 mb-3 shadow-sm border-l-4 border-l-purple-500">
          <div className="flex justify-between items-start">
            <div>
              <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full mr-2">
                {e.status}
              </span>
              <span className="text-slate-800 text-sm font-medium">{e.address}</span>
              <p className="text-slate-400 text-xs mt-1 font-mono">
                TX: {e.blockchain_tx ? e.blockchain_tx.slice(0, 30) + '...' : 'N/A'}
              </p>
            </div>
            <p className="text-slate-400 text-xs">
              {new Date(e.created_at).toLocaleDateString('en-GB')}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
