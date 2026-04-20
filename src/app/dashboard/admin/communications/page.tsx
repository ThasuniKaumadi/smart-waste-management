'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const ADMIN_NAV = [
  { label: 'Overview',             href: '/dashboard/admin',                      icon: 'dashboard',         section: 'Main' },
  { label: 'Users',                href: '/dashboard/admin/users',                icon: 'manage_accounts',   section: 'Management' },
  { label: 'Supervisors',          href: '/dashboard/admin/supervisors',           icon: 'supervisor_account',section: 'Management' },
  { label: 'Zones',                href: '/dashboard/admin/zones',                icon: 'map',               section: 'Management' },
  { label: 'Contracts',            href: '/dashboard/admin/contracts',            icon: 'description',       section: 'Management' },
  { label: 'Billing',              href: '/dashboard/admin/billing',              icon: 'payments',          section: 'Finance' },
  { label: 'Contractor Billing',   href: '/dashboard/admin/billing-contractor',   icon: 'receipt_long',      section: 'Finance' },
  { label: 'Commercial Analytics', href: '/dashboard/admin/commercial-analytics', icon: 'store',             section: 'Finance' },
  { label: 'Recycler Analytics',   href: '/dashboard/admin/recycler-analytics',   icon: 'recycling',         section: 'Finance' },
  { label: 'Blockchain',           href: '/dashboard/admin/blockchain',           icon: 'link',              section: 'Analytics' },
  { label: 'Performance',          href: '/dashboard/admin/performance',          icon: 'analytics',         section: 'Analytics' },
  { label: 'Incidents',            href: '/dashboard/admin/incidents',            icon: 'warning',           section: 'Analytics' },
  { label: 'Disposal',             href: '/dashboard/admin/disposal',             icon: 'delete_sweep',      section: 'Analytics' },
  { label: 'Announcements',        href: '/dashboard/admin/announcements',        icon: 'campaign',          section: 'Communications' },
  { label: 'Communications',       href: '/dashboard/admin/communications',       icon: 'chat',              section: 'Communications' },
]

type Thread = {
    id: string
    contractor_id: string
    subject: string
    category: string
    status: string
    last_message_at: string
    created_at: string
    contractor?: { full_name: string; organisation_name: string }
}

type Message = {
    id: string
    thread_id: string
    sender_id: string
    content: string
    is_read: boolean
    created_at: string
}

type FormalRequest = {
    id: string
    contractor_id: string
    type: string
    subject: string
    description: string
    status: string
    admin_notes: string
    created_at: string
    contractor?: { full_name: string; organisation_name: string }
}

function categoryStyle(category: string) {
    switch (category) {
        case 'contract': return { bg: '#f0fdf4', color: '#00450d' }
        case 'billing': return { bg: '#f0f9ff', color: '#0369a1' }
        case 'operations': return { bg: '#fefce8', color: '#92400e' }
        case 'complaint': return { bg: '#fef2f2', color: '#ba1a1a' }
        case 'request': return { bg: '#f5f3ff', color: '#7c3aed' }
        default: return { bg: '#f8fafc', color: '#64748b' }
    }
}

function requestStatusStyle(status: string) {
    switch (status) {
        case 'submitted': return { bg: '#f0f9ff', color: '#0369a1' }
        case 'under_review': return { bg: '#fefce8', color: '#92400e' }
        case 'approved': return { bg: '#f0fdf4', color: '#00450d' }
        case 'rejected': return { bg: '#fef2f2', color: '#ba1a1a' }
        default: return { bg: '#f8fafc', color: '#64748b' }
    }
}

const EMPTY_ANNOUNCEMENT_FORM = {
    title: '',
    content: '',
    target_role: 'contractor',
    priority: 'normal',
    expires_at: '',
}

export default function AdminCommunicationsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [threads, setThreads] = useState<Thread[]>([])
    const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
    const [threadMessages, setThreadMessages] = useState<Message[]>([])
    const [requests, setRequests] = useState<FormalRequest[]>([])
    const [selectedRequest, setSelectedRequest] = useState<FormalRequest | null>(null)
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [newMessage, setNewMessage] = useState('')
    const [activeTab, setActiveTab] = useState<'messages' | 'requests' | 'announcements'>('messages')
    const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
    const [announcementForm, setAnnouncementForm] = useState(EMPTY_ANNOUNCEMENT_FORM)
    const [adminNote, setAdminNote] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => { loadData() }, [])
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [threadMessages])

    async function loadData() {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)

        const { data: threadsData } = await supabase
            .from('message_threads')
            .select('*, contractor:profiles!message_threads_contractor_id_fkey(full_name, organisation_name)')
            .order('last_message_at', { ascending: false })
        setThreads(threadsData || [])

        const { data: requestsData } = await supabase
            .from('formal_requests')
            .select('*, contractor:profiles!formal_requests_contractor_id_fkey(full_name, organisation_name)')
            .order('created_at', { ascending: false })
        setRequests(requestsData || [])

        setLoading(false)
    }

    async function loadThreadMessages(thread: Thread) {
        const supabase = createClient()
        const { data: messagesData } = await supabase
            .from('messages')
            .select('*')
            .eq('thread_id', thread.id)
            .order('created_at', { ascending: true })
        setThreadMessages(messagesData || [])
        setSelectedThread(thread)
    }

    async function sendMessage() {
        if (!newMessage.trim() || !selectedThread) return
        setSending(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase.from('messages').insert({
            thread_id: selectedThread.id,
            sender_id: user.id,
            content: newMessage.trim(),
        })

        // Update thread status to in_progress
        await supabase.from('message_threads')
            .update({ status: 'in_progress' })
            .eq('id', selectedThread.id)
            .eq('status', 'open')

        setNewMessage('')
        loadThreadMessages(selectedThread)
        setSending(false)
    }

    async function resolveThread(threadId: string) {
        const supabase = createClient()
        await supabase.from('message_threads')
            .update({ status: 'resolved' })
            .eq('id', threadId)
        setSuccessMsg('Thread marked as resolved.')
        setSelectedThread(null)
        loadData()
    }

    async function reviewRequest(requestId: string, newStatus: string) {
        setSubmitting(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase.from('formal_requests')
            .update({
                status: newStatus,
                admin_notes: adminNote,
                reviewed_by: user.id,
                reviewed_at: new Date().toISOString(),
            })
            .eq('id', requestId)

        setSuccessMsg(`Request ${newStatus}.`)
        setSelectedRequest(null)
        setAdminNote('')
        loadData()
        setSubmitting(false)
    }

    async function createAnnouncement() {
        if (!announcementForm.title || !announcementForm.content) return
        setSubmitting(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase.from('announcements').insert({
            created_by: user.id,
            title: announcementForm.title,
            content: announcementForm.content,
            target_role: announcementForm.target_role,
            priority: announcementForm.priority,
            expires_at: announcementForm.expires_at || null,
            is_active: true,
        })

        setSuccessMsg('Announcement published successfully.')
        setShowAnnouncementForm(false)
        setAnnouncementForm(EMPTY_ANNOUNCEMENT_FORM)
        setSubmitting(false)
    }

    const pendingRequests = requests.filter(r => r.status === 'submitted').length
    const openThreads = threads.filter(t => t.status === 'open').length

    return (
        <DashboardLayout
            role="Admin"
            userName={profile?.full_name || ''}
            navItems={ADMIN_NAV}
            primaryAction={{ label: 'Add User', href: '/dashboard/admin/users', icon: 'person_add' }}
        >
            <style>{`
        .material-symbols-outlined { font-family:'Material Symbols Outlined'; font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; display:inline-block; vertical-align:middle; line-height:1; }
        .font-headline { font-family:'Manrope',sans-serif; }
        .bento-card { background:white; border-radius:16px; box-shadow:0 10px 40px -10px rgba(24,28,34,0.08); border:1px solid rgba(0,69,13,0.04); overflow:hidden; }
        .status-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:99px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
        .tab-btn { padding:10px 20px; border-radius:10px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; border:none; transition:all 0.2s; }
        .tab-active { background:#00450d; color:white; }
        .tab-inactive { background:transparent; color:#717a6d; }
        .tab-inactive:hover { background:#f0fdf4; color:#00450d; }
        .thread-row { padding:16px 20px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:14px; cursor:pointer; transition:background 0.15s; }
        .thread-row:hover { background:#f9fafb; }
        .thread-row:last-child { border-bottom:none; }
        .thread-row-active { background:#f0fdf4 !important; border-left:3px solid #00450d; }
        .message-bubble-sent { background:#00450d; color:white; border-radius:16px 16px 4px 16px; padding:12px 16px; max-width:75%; align-self:flex-end; }
        .message-bubble-received { background:#f8fafc; color:#181c22; border-radius:16px 16px 16px 4px; padding:12px 16px; max-width:75%; align-self:flex-start; border:1px solid rgba(0,69,13,0.06); }
        .request-row { padding:16px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; cursor:pointer; transition:background 0.15s; }
        .request-row:hover { background:#f9fafb; }
        .request-row:last-child { border-bottom:none; }
        .form-input { width:100%; padding:10px 14px; border-radius:10px; border:1.5px solid rgba(0,69,13,0.15); font-size:14px; outline:none; font-family:'Inter',sans-serif; transition:border-color 0.2s; background:white; color:#181c22; }
        .form-input:focus { border-color:#00450d; }
        .form-label { font-size:12px; font-weight:700; color:#717a6d; font-family:'Manrope',sans-serif; letter-spacing:0.05em; text-transform:uppercase; display:block; margin-bottom:6px; }
        .btn-primary { background:#00450d; color:white; border:none; padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:opacity 0.2s; }
        .btn-primary:hover { opacity:0.88; }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-secondary { background:white; color:#00450d; border:1.5px solid rgba(0,69,13,0.2); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-secondary:hover { background:#f0fdf4; }
        .btn-danger { background:#fef2f2; color:#ba1a1a; border:1.5px solid rgba(186,26,26,0.15); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; }
        .btn-danger:hover { background:#ffdad6; }
        @keyframes staggerIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .s1 { animation:staggerIn 0.5s ease 0.05s both; }
        .s2 { animation:staggerIn 0.5s ease 0.10s both; }
        .s3 { animation:staggerIn 0.5s ease 0.15s both; }
        .s4 { animation:staggerIn 0.5s ease 0.20s both; }
      `}</style>

            {/* Hero */}
            <section className="mb-10 s1">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="font-headline font-extrabold tracking-tight"
                            style={{ fontSize: '48px', color: '#181c22', lineHeight: 1.1 }}>
                            Communications <span style={{ color: '#1b5e20' }}>Hub</span>
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: '#717a6d', fontFamily: 'Inter, sans-serif' }}>
                            Manage contractor messages, requests and announcements
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {openThreads > 0 && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
                                style={{ background: '#f0f9ff', border: '1px solid rgba(3,105,161,0.15)' }}>
                                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#38bdf8' }} />
                                <span className="text-sm font-bold" style={{ color: '#0369a1', fontFamily: 'Manrope, sans-serif' }}>
                                    {openThreads} open thread{openThreads > 1 ? 's' : ''}
                                </span>
                            </div>
                        )}
                        {pendingRequests > 0 && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
                                style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)' }}>
                                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#ef4444' }} />
                                <span className="text-sm font-bold" style={{ color: '#ba1a1a', fontFamily: 'Manrope, sans-serif' }}>
                                    {pendingRequests} pending request{pendingRequests > 1 ? 's' : ''}
                                </span>
                            </div>
                        )}
                        <button className="btn-primary" onClick={() => setShowAnnouncementForm(true)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>campaign</span>
                            New Announcement
                        </button>
                    </div>
                </div>
            </section>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: '#00450d', borderTopColor: 'transparent' }} />
                </div>
            ) : (
                <>
                    {successMsg && (
                        <div className="mb-6 p-4 rounded-xl flex items-center gap-3"
                            style={{ background: '#f0fdf4', border: '1px solid rgba(0,69,13,0.15)' }}>
                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '20px' }}>check_circle</span>
                            <p className="text-sm font-medium" style={{ color: '#00450d' }}>{successMsg}</p>
                            <button onClick={() => setSuccessMsg('')} className="ml-auto"
                                style={{ color: '#00450d', background: 'none', border: 'none', cursor: 'pointer' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                            </button>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex items-center gap-2 mb-6 s2">
                        <button className={`tab-btn ${activeTab === 'messages' ? 'tab-active' : 'tab-inactive'}`}
                            onClick={() => setActiveTab('messages')}>
                            Messages ({threads.length})
                            {openThreads > 0 && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold"
                                    style={{ background: activeTab === 'messages' ? 'rgba(255,255,255,0.2)' : '#f0f9ff', color: activeTab === 'messages' ? 'white' : '#0369a1' }}>
                                    {openThreads}
                                </span>
                            )}
                        </button>
                        <button className={`tab-btn ${activeTab === 'requests' ? 'tab-active' : 'tab-inactive'}`}
                            onClick={() => setActiveTab('requests')}>
                            Requests ({requests.length})
                            {pendingRequests > 0 && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold"
                                    style={{ background: activeTab === 'requests' ? 'rgba(255,255,255,0.2)' : '#fef2f2', color: activeTab === 'requests' ? 'white' : '#ba1a1a' }}>
                                    {pendingRequests}
                                </span>
                            )}
                        </button>
                        <button className={`tab-btn ${activeTab === 'announcements' ? 'tab-active' : 'tab-inactive'}`}
                            onClick={() => setActiveTab('announcements')}>
                            Announcements
                        </button>
                    </div>

                    {/* Messages Tab */}
                    {activeTab === 'messages' && (
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 s3">
                            {/* Thread list */}
                            <div className="bento-card md:col-span-4">
                                <div className="px-5 py-4"
                                    style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                    <h3 className="font-headline font-bold text-base" style={{ color: '#181c22' }}>
                                        All Conversations
                                    </h3>
                                </div>
                                {threads.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                                        <span className="material-symbols-outlined mb-3" style={{ color: '#00450d', fontSize: '32px' }}>chat</span>
                                        <p className="text-sm font-medium" style={{ color: '#181c22' }}>No messages yet</p>
                                    </div>
                                ) : (
                                    threads.map(thread => {
                                        const cs = categoryStyle(thread.category)
                                        const isActive = selectedThread?.id === thread.id
                                        const contractorName = thread.contractor?.organisation_name || thread.contractor?.full_name || 'Unknown'
                                        return (
                                            <div key={thread.id}
                                                className={`thread-row ${isActive ? 'thread-row-active' : ''}`}
                                                onClick={() => loadThreadMessages(thread)}>
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                    style={{ background: cs.bg }}>
                                                    <span className="material-symbols-outlined" style={{ color: cs.color, fontSize: '18px' }}>chat</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold truncate" style={{ color: '#181c22' }}>{thread.subject}</p>
                                                    <p className="text-xs truncate" style={{ color: '#717a6d' }}>{contractorName}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="status-badge" style={{ background: cs.bg, color: cs.color, padding: '2px 8px', fontSize: '10px' }}>
                                                            {thread.category}
                                                        </span>
                                                        <span className="text-xs" style={{ color: '#94a3b8' }}>
                                                            {new Date(thread.last_message_at).toLocaleDateString('en-GB')}
                                                        </span>
                                                    </div>
                                                </div>
                                                {thread.status === 'open' && (
                                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#38bdf8' }} />
                                                )}
                                            </div>
                                        )
                                    })
                                )}
                            </div>

                            {/* Message view */}
                            <div className="bento-card md:col-span-8 flex flex-col" style={{ minHeight: '500px' }}>
                                {!selectedThread ? (
                                    <div className="flex flex-col items-center justify-center flex-1 py-16 text-center">
                                        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                            style={{ background: '#f0fdf4' }}>
                                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>forum</span>
                                        </div>
                                        <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>
                                            Select a conversation
                                        </p>
                                        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
                                            Choose a thread from the left to view and reply
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Thread header */}
                                        <div className="px-6 py-4 flex items-center gap-4"
                                            style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-headline font-bold text-base" style={{ color: '#181c22' }}>
                                                    {selectedThread.subject}
                                                </p>
                                                <p className="text-xs mt-0.5" style={{ color: '#717a6d' }}>
                                                    {selectedThread.contractor?.organisation_name || selectedThread.contractor?.full_name}
                                                </p>
                                            </div>
                                            {selectedThread.status !== 'resolved' && (
                                                <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: '12px' }}
                                                    onClick={() => resolveThread(selectedThread.id)}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>
                                                    Resolve
                                                </button>
                                            )}
                                            <button onClick={() => setSelectedThread(null)}
                                                style={{ background: '#f8fafc', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}>
                                                <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '18px' }}>close</span>
                                            </button>
                                        </div>

                                        {/* Messages */}
                                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4" style={{ maxHeight: '400px' }}>
                                            {threadMessages.map(msg => {
                                                const isSender = msg.sender_id === profile?.id
                                                return (
                                                    <div key={msg.id} className={`flex flex-col ${isSender ? 'items-end' : 'items-start'}`}>
                                                        <div className={isSender ? 'message-bubble-sent' : 'message-bubble-received'}>
                                                            <p className="text-sm leading-relaxed"
                                                                style={{ fontFamily: 'Inter, sans-serif', color: isSender ? 'white' : '#181c22' }}>
                                                                {msg.content}
                                                            </p>
                                                        </div>
                                                        <p className="text-xs mt-1 px-1" style={{ color: '#94a3b8' }}>
                                                            {isSender ? 'You (CMC)' : 'Contractor'} · {new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                )
                                            })}
                                            <div ref={messagesEndRef} />
                                        </div>

                                        {/* Message input */}
                                        <div className="px-6 py-4 flex items-end gap-3"
                                            style={{ borderTop: '1px solid rgba(0,69,13,0.06)' }}>
                                            <textarea
                                                className="form-input flex-1"
                                                rows={2}
                                                placeholder="Type your reply..."
                                                value={newMessage}
                                                onChange={e => setNewMessage(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault()
                                                        sendMessage()
                                                    }
                                                }}
                                                style={{ resize: 'none' }} />
                                            <button className="btn-primary flex-shrink-0"
                                                style={{ padding: '10px 16px' }}
                                                onClick={sendMessage}
                                                disabled={sending || !newMessage.trim()}>
                                                {sending ? (
                                                    <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                        style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                                ) : (
                                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>send</span>
                                                )}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Requests Tab */}
                    {activeTab === 'requests' && (
                        <div className="bento-card s3">
                            {requests.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                        style={{ background: '#f0fdf4' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>assignment</span>
                                    </div>
                                    <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No requests</p>
                                    <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Contractor formal requests will appear here</p>
                                </div>
                            ) : (
                                requests.map(req => {
                                    const rs = requestStatusStyle(req.status)
                                    const contractorName = req.contractor?.organisation_name || req.contractor?.full_name || 'Unknown'
                                    return (
                                        <div key={req.id} className="request-row"
                                            onClick={() => { setSelectedRequest(req); setAdminNote(req.admin_notes || '') }}>
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: rs.bg }}>
                                                <span className="material-symbols-outlined" style={{ color: rs.color, fontSize: '20px' }}>
                                                    assignment
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-sm font-bold truncate" style={{ color: '#181c22' }}>{req.subject}</p>
                                                    <span className="status-badge" style={{ background: rs.bg, color: rs.color }}>
                                                        {req.status.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <p className="text-xs" style={{ color: '#717a6d' }}>
                                                    {contractorName} · {req.type.replace(/_/g, ' ')} · {new Date(req.created_at).toLocaleDateString('en-GB')}
                                                </p>
                                            </div>
                                            <span className="material-symbols-outlined" style={{ color: '#94a3b8', fontSize: '18px' }}>
                                                chevron_right
                                            </span>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}

                    {/* Announcements Tab */}
                    {activeTab === 'announcements' && (
                        <div className="s3">
                            <div className="flex justify-end mb-4">
                                <button className="btn-primary" onClick={() => setShowAnnouncementForm(true)}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>campaign</span>
                                    New Announcement
                                </button>
                            </div>
                            <div className="bento-card">
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                        style={{ background: '#f0fdf4' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>campaign</span>
                                    </div>
                                    <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>Broadcast to contractors</p>
                                    <p className="text-sm mt-1 mb-6" style={{ color: '#94a3b8' }}>
                                        Create announcements visible to all contractors
                                    </p>
                                    <button className="btn-primary" onClick={() => setShowAnnouncementForm(true)}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                                        Create Announcement
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Request Review Modal */}
                    {selectedRequest && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>
                                            {selectedRequest.subject}
                                        </h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>
                                            {selectedRequest.contractor?.organisation_name || selectedRequest.contractor?.full_name} · {selectedRequest.type.replace(/_/g, ' ')}
                                        </p>
                                    </div>
                                    <button onClick={() => setSelectedRequest(null)}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>

                                <div className="p-4 rounded-xl mb-6" style={{ background: '#f8fafc' }}>
                                    <p className="text-xs font-bold uppercase mb-2"
                                        style={{ color: '#94a3b8', letterSpacing: '0.08em', fontFamily: 'Manrope, sans-serif' }}>
                                        Description
                                    </p>
                                    <p className="text-sm leading-relaxed" style={{ color: '#4b5563' }}>
                                        {selectedRequest.description}
                                    </p>
                                </div>

                                <div className="mb-6">
                                    <label className="form-label">Admin Notes</label>
                                    <textarea className="form-input" rows={3}
                                        placeholder="Add notes or conditions..."
                                        value={adminNote}
                                        onChange={e => setAdminNote(e.target.value)}
                                        style={{ resize: 'vertical' }} />
                                </div>

                                {selectedRequest.status === 'submitted' || selectedRequest.status === 'under_review' ? (
                                    <div className="flex gap-3">
                                        <button className="btn-danger flex-1 justify-center"
                                            onClick={() => reviewRequest(selectedRequest.id, 'rejected')}
                                            disabled={submitting}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                                            Reject
                                        </button>
                                        <button className="btn-secondary flex-1 justify-center"
                                            onClick={() => reviewRequest(selectedRequest.id, 'under_review')}
                                            disabled={submitting}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>pending</span>
                                            Review
                                        </button>
                                        <button className="btn-primary flex-1 justify-center"
                                            onClick={() => reviewRequest(selectedRequest.id, 'approved')}
                                            disabled={submitting}>
                                            {submitting ? (
                                                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                    style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                                                    Approve
                                                </>
                                            )}
                                        </button>
                                    </div>
                                ) : (
                                    <button className="btn-secondary w-full justify-center"
                                        onClick={() => setSelectedRequest(null)}>
                                        Close
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Create Announcement Modal */}
                    {showAnnouncementForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>New Announcement</h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>Broadcast a message to contractors</p>
                                    </div>
                                    <button onClick={() => setShowAnnouncementForm(false)}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="form-label">Title *</label>
                                        <input className="form-input" placeholder="Announcement title"
                                            value={announcementForm.title}
                                            onChange={e => setAnnouncementForm(f => ({ ...f, title: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="form-label">Content *</label>
                                        <textarea className="form-input" rows={5}
                                            placeholder="Write your announcement..."
                                            value={announcementForm.content}
                                            onChange={e => setAnnouncementForm(f => ({ ...f, content: e.target.value }))}
                                            style={{ resize: 'vertical' }} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label">Target Role</label>
                                            <select className="form-input"
                                                value={announcementForm.target_role}
                                                onChange={e => setAnnouncementForm(f => ({ ...f, target_role: e.target.value }))}>
                                                <option value="contractor">Contractors</option>
                                                <option value="driver">Drivers</option>
                                                <option value="supervisor">Supervisors</option>
                                                <option value="all">All Roles</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="form-label">Priority</label>
                                            <select className="form-input"
                                                value={announcementForm.priority}
                                                onChange={e => setAnnouncementForm(f => ({ ...f, priority: e.target.value }))}>
                                                <option value="low">Low</option>
                                                <option value="normal">Normal</option>
                                                <option value="high">High</option>
                                                <option value="urgent">Urgent</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="form-label">Expires At (optional)</label>
                                        <input type="date" className="form-input"
                                            value={announcementForm.expires_at}
                                            onChange={e => setAnnouncementForm(f => ({ ...f, expires_at: e.target.value }))} />
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button className="btn-secondary flex-1 justify-center"
                                        onClick={() => setShowAnnouncementForm(false)}>
                                        Cancel
                                    </button>
                                    <button className="btn-primary flex-1 justify-center"
                                        onClick={createAnnouncement} disabled={submitting}>
                                        {submitting ? (
                                            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>campaign</span>
                                                Publish
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </DashboardLayout>
    )
}