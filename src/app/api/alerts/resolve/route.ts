import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    const { alert_id, resolved_by } = await req.json()

    const { data, error } = await supabase
        .from('exception_alerts')
        .update({
            is_resolved: true,
            resolved_by,
            resolved_at: new Date().toISOString(),
        })
        .eq('id', alert_id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ alert: data })
}