import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(req: NextRequest) {
    const { route_id, driver_id, waste_type, estimated_quantity } = await req.json()

    // Check for existing pending handoff for this route
    const { data: existing } = await supabase
        .from('route_handoffs')
        .select('*')
        .eq('route_id', route_id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single()

    if (existing) {
        return NextResponse.json({ handoff: existing })
    }

    // Generate unique code
    let code = generateCode()
    let attempts = 0
    while (attempts < 5) {
        const { data: taken } = await supabase
            .from('route_handoffs')
            .select('id')
            .eq('handoff_code', code)
            .eq('status', 'pending')
            .single()
        if (!taken) break
        code = generateCode()
        attempts++
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    const { data, error } = await supabase
        .from('route_handoffs')
        .insert({
            handoff_code: code,
            route_id,
            driver_id,
            waste_type,
            estimated_quantity,
            expires_at: expiresAt,
            status: 'pending',
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ handoff: data })
}