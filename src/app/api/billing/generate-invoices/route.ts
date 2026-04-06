import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}))
        const commercial_id = body?.commercial_id || null

        const supabase = createClient()

        if (commercial_id) {
            // Generate for specific commercial
            const { data, error } = await supabase.rpc('generate_invoice_for_commercial', {
                p_commercial_id: commercial_id,
                p_period_end: new Date().toISOString().split('T')[0],
            })
            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            return NextResponse.json({ count: data || 0 })
        } else {
            // Generate for all
            const { data, error } = await supabase.rpc('generate_invoices_for_period', {
                p_period_end: new Date().toISOString().split('T')[0],
            })
            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            return NextResponse.json({ count: data || 0 })
        }
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}