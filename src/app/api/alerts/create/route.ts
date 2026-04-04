import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    const body = await req.json()
    const { type, title, message, severity = 'medium', route_id, driver_id, collection_event_id, breakdown_report_id } = body

    const { data, error } = await supabase
        .from('exception_alerts')
        .insert({
            type,
            title,
            message,
            severity,
            route_id,
            driver_id,
            collection_event_id,
            breakdown_report_id,
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ alert: data })
}