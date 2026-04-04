import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    const { code } = await req.json()

    const { data: handoff, error } = await supabase
        .from('route_handoffs')
        .select(`
      *,
      route:route_id(
        id, route_name, district, vehicle_number,
        date, waste_type, status
      ),
      driver:driver_id(full_name, phone)
    `)
        .eq('handoff_code', code)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single()

    if (error || !handoff) {
        return NextResponse.json(
            { error: 'Invalid or expired code. Please ask the driver for a new code.' },
            { status: 404 }
        )
    }

    // Get stop counts
    const { count: totalStops } = await supabase
        .from('collection_stops')
        .select('*', { count: 'exact', head: true })
        .eq('route_id', handoff.route_id)

    const { count: completedStops } = await supabase
        .from('collection_stops')
        .select('*', { count: 'exact', head: true })
        .eq('route_id', handoff.route_id)
        .eq('status', 'completed')

    return NextResponse.json({
        handoff,
        totalStops,
        completedStops,
    })
}