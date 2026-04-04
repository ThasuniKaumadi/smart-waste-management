import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Rate per bin collection in LKR
const RATE_PER_BIN = 250
const BASE_RATE = 500

export async function POST(req: NextRequest) {
    const { collection_event_id, commercial_id, bin_count } = await req.json()

    // Check if billing already exists
    const { data: existing } = await supabase
        .from('billing_records')
        .select('id')
        .eq('collection_event_id', collection_event_id)
        .single()

    if (existing) {
        return NextResponse.json({ error: 'Billing already exists' }, { status: 400 })
    }

    const bins = bin_count || 1
    const amount = BASE_RATE + (bins * RATE_PER_BIN)

    const { data, error } = await supabase
        .from('billing_records')
        .insert({
            commercial_id,
            collection_event_id,
            amount,
            currency: 'LKR',
            status: 'pending',
            description: `Waste Collection Service - ${bins} bin${bins > 1 ? 's' : ''}`,
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ billing: data })
}