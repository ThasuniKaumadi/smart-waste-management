'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'

const CONTRACTOR_NAV = [
    { label: 'Overview', href: '/dashboard/contractor', icon: 'dashboard' },
    { label: 'Routes', href: '/dashboard/contractor/routes', icon: 'route' },
    { label: 'Drivers', href: '/dashboard/contractor/drivers', icon: 'people' },
    { label: 'Breakdowns', href: '/dashboard/contractor/breakdowns', icon: 'car_crash' },
    { label: 'Contracts', href: '/dashboard/contractor/contracts', icon: 'description' },
    { label: 'Fleet', href: '/dashboard/contractor/fleet', icon: 'local_shipping' },
    { label: 'Billing', href: '/dashboard/contractor/billing', icon: 'receipt_long' },
    { label: 'Incidents', href: '/dashboard/contractor/incidents', icon: 'warning' },
    { label: 'Messages', href: '/dashboard/contractor/messages', icon: 'chat' },
    { label: 'Zones', href: '/dashboard/contractor/zones', icon: 'map' },
    { label: 'Staff', href: '/dashboard/contractor/staff', icon: 'badge' },
]

type Thread = {
    id: string
    contractor_id: string
    subject: string
    category: string
    status: string
    last_message_at: string
    created_at: string
}

type Message = {
    id: string
    thread_id: string
    sender_id: string
    content: string
    is_read: boolean
    created_at: string
}

type Announcement = {
    id: string
    title: string
    content: string
    priority: string
    published_at: string
}

type FormalRequest = {
    id: string
    type: string
    subject: string
    description: string
    status: string
    admin_notes: string
    created_at: string
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

function threadStatusStyle(status: string) {
    switch (status) {
        case 'open': return { bg: '#f0f9ff', color: '#0369a1' }
        case 'in_progress': return { bg: '#fefce8', color: '#92400e' }
        case 'resolved': return { bg: '#f0fdf4', color: '#00450d' }
        case 'closed': return { bg: '#f8fafc', color: '#64748b' }
        default: return { bg: '#f8fafc', color: '#64748b' }
    }
}

function priorityStyle(priority: string) {
    switch (priority) {
        case 'urgent': return { bg: '#fef2f2', color: '#ba1a1a', dot: '#ef4444' }
        case 'high': return { bg: '#fff7ed', color: '#c2410c', dot: '#ea580c' }
        case 'normal': return { bg: '#f0f9ff', color: '#0369a1', dot: '#38bdf8' }
        case 'low': return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8' }
        default: return { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8' }
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

const EMPTY_THREAD_FORM = {
    subject: '',
    category: 'general',
    message: '',
}

const EMPTY_REQUEST_FORM = {
    type: 'route_change',
    subject: '',
    description: '',
}

export default function ContractorMessagesPage() {
    const [profile, setProfile] = useState<any>(null)
    const [threads, setThreads] = useState<Thread[]>([])
    const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
    const [threadMessages, setThreadMessages] = useState<Message[]>([])
    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [requests, setRequests] = useState<FormalRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [newMessage, setNewMessage] = useState('')
    const [activeTab, setActiveTab] = useState<'messages' | 'announcements' | 'requests'>('messages')
    const [showThreadForm, setShowThreadForm] = useState(false)
    const [showRequestForm, setShowRequestForm] = useState(false)
    const [threadForm, setThreadForm] = useState(EMPTY_THREAD_FORM)
    const [requestForm, setRequestForm] = useState(EMPTY_REQUEST_FORM)
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
            .select('*')
            .eq('contractor_id', user.id)
            .order('last_message_at', { ascending: false })
        setThreads(threadsData || [])

        const { data: announcementsData } = await supabase
            .from('announcements')
            .select('*')
            .eq('is_active', true)
            .in('target_role', ['contractor', 'all'])
            .order('published_at', { ascending: false })
        setAnnouncements(announcementsData || [])

        const { data: requestsData } = await supabase
            .from('formal_requests')
            .select('*')
            .eq('contractor_id', user.id)
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

        // Mark messages as read
        await supabase.from('messages')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('thread_id', thread.id)
            .eq('is_read', false)
            .neq('sender_id', (await supabase.auth.getUser()).data.user?.id)

        setSelectedThread(thread)
    }

    async function sendMessage() {
        if (!newMessage.trim() || !selectedThread) return
        setSending(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('messages').insert({
            thread_id: selectedThread.id,
            sender_id: user.id,
            content: newMessage.trim(),
        })

        if (!error) {
            setNewMessage('')
            loadThreadMessages(selectedThread)
        }
        setSending(false)
    }

    async function createThread() {
        if (!threadForm.subject || !threadForm.message) {
            setErrorMsg('Subject and message are required.')
            return
        }
        setSubmitting(true)
        setErrorMsg('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: newThread, error } = await supabase
            .from('message_threads')
            .insert({
                contractor_id: user.id,
                subject: threadForm.subject,
                category: threadForm.category,
                status: 'open',
            })
            .select()
            .single()

        if (error || !newThread) {
            setErrorMsg('Failed to create thread: ' + error?.message)
            setSubmitting(false)
            return
        }

        await supabase.from('messages').insert({
            thread_id: newThread.id,
            sender_id: user.id,
            content: threadForm.message,
        })

        setSuccessMsg('Message sent to CMC successfully.')
        setShowThreadForm(false)
        setThreadForm(EMPTY_THREAD_FORM)
        loadData()
        setSubmitting(false)
    }

    async function submitRequest() {
        if (!requestForm.subject || !requestForm.description) {
            setErrorMsg('Subject and description are required.')
            return
        }
        setSubmitting(true)
        setErrorMsg('')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('formal_requests').insert({
            contractor_id: user.id,
            type: requestForm.type,
            subject: requestForm.subject,
            description: requestForm.description,
            status: 'submitted',
        })

        if (error) {
            setErrorMsg('Failed to submit request: ' + error.message)
        } else {
            setSuccessMsg('Formal request submitted to CMC.')
            setShowRequestForm(false)
            setRequestForm(EMPTY_REQUEST_FORM)
            loadData()
        }
        setSubmitting(false)
    }

    const unreadCount = threads.length

    return (
        <DashboardLayout
            role="Contractor"
            userName={profile?.full_name || profile?.organisation_name || ''}
            navItems={CONTRACTOR_NAV}
            primaryAction={{ label: 'New Message', href: '#', icon: 'edit' }}
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
        .announcement-card { padding:20px 24px; border-bottom:1px solid rgba(0,69,13,0.04); transition:background 0.15s; }
        .announcement-card:hover { background:#f9fafb; }
        .announcement-card:last-child { border-bottom:none; }
        .request-row { padding:16px 24px; border-bottom:1px solid rgba(0,69,13,0.04); display:flex; align-items:center; gap:16px; transition:background 0.15s; }
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
                            CMC <span style={{ color: '#1b5e20' }}>Communications</span>
                        </h1>
                        <p className="mt-2 text-sm" style={{ color: '#717a6d', fontFamily: 'Inter, sans-serif' }}>
                            Messages, announcements and formal requests
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button className="btn-secondary"
                            onClick={() => { setShowRequestForm(true); setErrorMsg('') }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>assignment</span>
                            Formal Request
                        </button>
                        <button className="btn-primary"
                            onClick={() => { setShowThreadForm(true); setErrorMsg('') }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                            New Message
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

                    {/* Urgent announcements banner */}
                    {announcements.filter(a => a.priority === 'urgent').map(a => (
                        <div key={a.id} className="mb-4 p-4 rounded-xl flex items-start gap-3"
                            style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.2)' }}>
                            <span className="material-symbols-outlined flex-shrink-0" style={{ color: '#ba1a1a', fontSize: '20px' }}>
                                campaign
                            </span>
                            <div>
                                <p className="text-sm font-bold" style={{ color: '#ba1a1a' }}>{a.title}</p>
                                <p className="text-xs mt-1" style={{ color: '#ba1a1a', opacity: 0.8 }}>{a.content.slice(0, 120)}...</p>
                            </div>
                        </div>
                    ))}

                    {/* Tabs */}
                    <div className="flex items-center gap-2 mb-6 s2">
                        <button className={`tab-btn ${activeTab === 'messages' ? 'tab-active' : 'tab-inactive'}`}
                            onClick={() => setActiveTab('messages')}>
                            Messages ({threads.length})
                        </button>
                        <button className={`tab-btn ${activeTab === 'announcements' ? 'tab-active' : 'tab-inactive'}`}
                            onClick={() => setActiveTab('announcements')}>
                            Announcements
                            {announcements.length > 0 && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold"
                                    style={{ background: activeTab === 'announcements' ? 'rgba(255,255,255,0.2)' : '#f0fdf4', color: activeTab === 'announcements' ? 'white' : '#00450d' }}>
                                    {announcements.length}
                                </span>
                            )}
                        </button>
                        <button className={`tab-btn ${activeTab === 'requests' ? 'tab-active' : 'tab-inactive'}`}
                            onClick={() => setActiveTab('requests')}>
                            Requests ({requests.length})
                        </button>
                    </div>

                    {/* Messages Tab */}
                    {activeTab === 'messages' && (
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 s3">
                            {/* Thread list */}
                            <div className="bento-card md:col-span-4">
                                <div className="px-5 py-4 flex items-center justify-between"
                                    style={{ borderBottom: '1px solid rgba(0,69,13,0.06)' }}>
                                    <h3 className="font-headline font-bold text-base" style={{ color: '#181c22' }}>
                                        Conversations
                                    </h3>
                                    <button onClick={() => { setShowThreadForm(true); setErrorMsg('') }}
                                        style={{ background: '#f0fdf4', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '18px' }}>edit</span>
                                    </button>
                                </div>
                                {threads.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                                        <span className="material-symbols-outlined mb-3" style={{ color: '#00450d', fontSize: '32px' }}>chat</span>
                                        <p className="text-sm font-medium" style={{ color: '#181c22' }}>No messages yet</p>
                                        <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>Start a conversation with CMC</p>
                                    </div>
                                ) : (
                                    threads.map(thread => {
                                        const cs = categoryStyle(thread.category)
                                        const isActive = selectedThread?.id === thread.id
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
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="status-badge" style={{ background: cs.bg, color: cs.color, padding: '2px 8px', fontSize: '10px' }}>
                                                            {thread.category}
                                                        </span>
                                                        <span className="text-xs" style={{ color: '#94a3b8' }}>
                                                            {new Date(thread.last_message_at).toLocaleDateString('en-GB')}
                                                        </span>
                                                    </div>
                                                </div>
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
                                            Choose a thread from the left to view messages
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
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="status-badge"
                                                        style={{ background: categoryStyle(selectedThread.category).bg, color: categoryStyle(selectedThread.category).color, padding: '2px 8px', fontSize: '10px' }}>
                                                        {selectedThread.category}
                                                    </span>
                                                    <span className="status-badge"
                                                        style={{ background: threadStatusStyle(selectedThread.status).bg, color: threadStatusStyle(selectedThread.status).color, padding: '2px 8px', fontSize: '10px' }}>
                                                        {selectedThread.status}
                                                    </span>
                                                </div>
                                            </div>
                                            <button onClick={() => setSelectedThread(null)}
                                                style={{ background: '#f8fafc', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}>
                                                <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '18px' }}>close</span>
                                            </button>
                                        </div>

                                        {/* Messages */}
                                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4" style={{ maxHeight: '400px' }}>
                                            {threadMessages.length === 0 ? (
                                                <div className="flex items-center justify-center py-8">
                                                    <p className="text-sm" style={{ color: '#94a3b8' }}>No messages in this thread yet</p>
                                                </div>
                                            ) : (
                                                threadMessages.map(msg => {
                                                    const isSender = msg.sender_id === profile?.id
                                                    return (
                                                        <div key={msg.id} className={`flex flex-col ${isSender ? 'items-end' : 'items-start'}`}>
                                                            <div className={isSender ? 'message-bubble-sent' : 'message-bubble-received'}>
                                                                <p className="text-sm leading-relaxed"
                                                                    style={{ fontFamily: 'Inter, sans-serif', color: isSender ? 'white' : '#181c22' }}>
                                                                    {msg.content}
                                                                </p>
                                                            </div>
                                                            <p className="text-xs mt-1 px-1"
                                                                style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}>
                                                                {isSender ? 'You' : 'CMC'} · {new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                    )
                                                })
                                            )}
                                            <div ref={messagesEndRef} />
                                        </div>

                                        {/* Message input */}
                                        {selectedThread.status !== 'closed' && (
                                            <div className="px-6 py-4 flex items-end gap-3"
                                                style={{ borderTop: '1px solid rgba(0,69,13,0.06)' }}>
                                                <textarea
                                                    className="form-input flex-1"
                                                    rows={2}
                                                    placeholder="Type your message..."
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
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Announcements Tab */}
                    {activeTab === 'announcements' && (
                        <div className="bento-card s3">
                            {announcements.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                        style={{ background: '#f0fdf4' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>campaign</span>
                                    </div>
                                    <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No announcements</p>
                                    <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>CMC announcements will appear here</p>
                                </div>
                            ) : (
                                announcements.map(a => {
                                    const ps = priorityStyle(a.priority)
                                    return (
                                        <div key={a.id} className="announcement-card">
                                            <div className="flex items-start gap-4">
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                    style={{ background: ps.bg }}>
                                                    <span className="material-symbols-outlined" style={{ color: ps.color, fontSize: '20px' }}>
                                                        campaign
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                        <h3 className="font-headline font-bold text-base" style={{ color: '#181c22' }}>
                                                            {a.title}
                                                        </h3>
                                                        <span className="status-badge" style={{ background: ps.bg, color: ps.color }}>
                                                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: ps.dot }} />
                                                            {a.priority}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm leading-relaxed mb-3"
                                                        style={{ color: '#4b5563', fontFamily: 'Inter, sans-serif' }}>
                                                        {a.content}
                                                    </p>
                                                    <p className="text-xs" style={{ color: '#94a3b8' }}>
                                                        Published {new Date(a.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}

                    {/* Requests Tab */}
                    {activeTab === 'requests' && (
                        <div className="s3">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm" style={{ color: '#717a6d' }}>
                                    {requests.length} formal request{requests.length !== 1 ? 's' : ''} submitted
                                </p>
                                <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}
                                    onClick={() => { setShowRequestForm(true); setErrorMsg('') }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                                    New Request
                                </button>
                            </div>
                            <div className="bento-card">
                                {requests.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                                            style={{ background: '#f0fdf4' }}>
                                            <span className="material-symbols-outlined" style={{ color: '#00450d', fontSize: '32px' }}>assignment</span>
                                        </div>
                                        <p className="font-headline font-bold text-lg" style={{ color: '#181c22' }}>No requests yet</p>
                                        <p className="text-sm mt-1 mb-6" style={{ color: '#94a3b8' }}>
                                            Submit formal requests to CMC for route changes, resources, and more
                                        </p>
                                        <button className="btn-primary" onClick={() => setShowRequestForm(true)}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                                            New Request
                                        </button>
                                    </div>
                                ) : (
                                    requests.map(req => {
                                        const rs = requestStatusStyle(req.status)
                                        return (
                                            <div key={req.id} className="request-row">
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
                                                    <p className="text-xs truncate" style={{ color: '#717a6d' }}>{req.description}</p>
                                                    {req.admin_notes && (
                                                        <p className="text-xs mt-1 font-medium" style={{ color: '#0369a1' }}>
                                                            CMC: {req.admin_notes}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-xs" style={{ color: '#94a3b8' }}>
                                                        {new Date(req.created_at).toLocaleDateString('en-GB')}
                                                    </p>
                                                    <p className="text-xs font-medium mt-1 capitalize" style={{ color: '#717a6d' }}>
                                                        {req.type.replace(/_/g, ' ')}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* New Thread Modal */}
                    {showThreadForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>New Message</h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>Send a message to CMC</p>
                                    </div>
                                    <button onClick={() => { setShowThreadForm(false); setErrorMsg('') }}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>

                                {errorMsg && (
                                    <div className="mb-4 p-3 rounded-xl flex items-center gap-2"
                                        style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '16px' }}>error</span>
                                        <p className="text-xs font-medium" style={{ color: '#ba1a1a' }}>{errorMsg}</p>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div>
                                        <label className="form-label">Subject *</label>
                                        <input className="form-input" placeholder="Brief subject of your message"
                                            value={threadForm.subject}
                                            onChange={e => setThreadForm(f => ({ ...f, subject: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="form-label">Category</label>
                                        <select className="form-input"
                                            value={threadForm.category}
                                            onChange={e => setThreadForm(f => ({ ...f, category: e.target.value }))}>
                                            <option value="general">General</option>
                                            <option value="contract">Contract</option>
                                            <option value="billing">Billing</option>
                                            <option value="operations">Operations</option>
                                            <option value="complaint">Complaint</option>
                                            <option value="request">Request</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Message *</label>
                                        <textarea className="form-input" rows={5}
                                            placeholder="Type your message to CMC..."
                                            value={threadForm.message}
                                            onChange={e => setThreadForm(f => ({ ...f, message: e.target.value }))}
                                            style={{ resize: 'vertical' }} />
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button className="btn-secondary flex-1 justify-center"
                                        onClick={() => { setShowThreadForm(false); setErrorMsg('') }}>
                                        Cancel
                                    </button>
                                    <button className="btn-primary flex-1 justify-center"
                                        onClick={createThread} disabled={submitting}>
                                        {submitting ? (
                                            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span>
                                                Send Message
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Formal Request Modal */}
                    {showRequestForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                            <div className="w-full max-w-lg bento-card p-8">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="font-headline font-bold text-xl" style={{ color: '#181c22' }}>Formal Request</h3>
                                        <p className="text-xs mt-1" style={{ color: '#717a6d' }}>Submit a formal request to CMC</p>
                                    </div>
                                    <button onClick={() => { setShowRequestForm(false); setErrorMsg('') }}
                                        style={{ background: '#f8fafc', border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#64748b', fontSize: '20px' }}>close</span>
                                    </button>
                                </div>

                                {errorMsg && (
                                    <div className="mb-4 p-3 rounded-xl flex items-center gap-2"
                                        style={{ background: '#fef2f2', border: '1px solid rgba(186,26,26,0.15)' }}>
                                        <span className="material-symbols-outlined" style={{ color: '#ba1a1a', fontSize: '16px' }}>error</span>
                                        <p className="text-xs font-medium" style={{ color: '#ba1a1a' }}>{errorMsg}</p>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div>
                                        <label className="form-label">Request Type</label>
                                        <select className="form-input"
                                            value={requestForm.type}
                                            onChange={e => setRequestForm(f => ({ ...f, type: e.target.value }))}>
                                            <option value="route_change">Route Change</option>
                                            <option value="schedule_adjustment">Schedule Adjustment</option>
                                            <option value="resource_request">Resource Request</option>
                                            <option value="complaint_escalation">Complaint Escalation</option>
                                            <option value="zone_reassignment">Zone Reassignment</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Subject *</label>
                                        <input className="form-input" placeholder="Brief subject of your request"
                                            value={requestForm.subject}
                                            onChange={e => setRequestForm(f => ({ ...f, subject: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="form-label">Description *</label>
                                        <textarea className="form-input" rows={5}
                                            placeholder="Describe your request in detail..."
                                            value={requestForm.description}
                                            onChange={e => setRequestForm(f => ({ ...f, description: e.target.value }))}
                                            style={{ resize: 'vertical' }} />
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button className="btn-secondary flex-1 justify-center"
                                        onClick={() => { setShowRequestForm(false); setErrorMsg('') }}>
                                        Cancel
                                    </button>
                                    <button className="btn-primary flex-1 justify-center"
                                        onClick={submitRequest} disabled={submitting}>
                                        {submitting ? (
                                            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                                style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>send</span>
                                                Submit Request
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