import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    const body = await req.json()
    const {
        handoff_id, operator_id, operator_type, route_id, driver_id,
        date_dispatched, time_dispatched, vehicle_number, disposal_location,
        waste_type, material_type, actual_quantity, unit, processing_method,
        condition, is_rejected, rejection_reason, rejection_notes, rate_per_unit,
    } = body

    // Calculate payment for recyclers
    const total_amount = operator_type === 'recycling_partner' && actual_quantity && rate_per_unit
        ? actual_quantity * rate_per_unit
        : null

    const { data: intake, error } = await supabase
        .from('waste_intake_logs')
        .insert({
            handoff_id, operator_id, operator_type, route_id, driver_id,
            date_dispatched, time_dispatched, vehicle_number, disposal_location,
            waste_type, material_type, actual_quantity, unit, processing_method,
            condition, is_rejected, rejection_reason, rejection_notes,
            rate_per_unit, total_amount,
            payment_status: operator_type === 'recycling_partner' ? 'pending' : null,
            received_at: new Date().toISOString(),
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Mark handoff as accepted or rejected
    await supabase
        .from('route_handoffs')
        .update({ status: is_rejected ? 'rejected' : 'accepted' })
        .eq('id', handoff_id)

    // Create billing record for recycler payment to CMC
    if (operator_type === 'recycling_partner' && total_amount && !is_rejected) {
        await supabase.from('billing_records').insert({
            commercial_id: operator_id,
            amount: total_amount,
            currency: 'LKR',
            status: 'pending',
            description: `Waste intake payment — ${actual_quantity}${unit} of ${material_type || waste_type}`,
        })
    }

    // Fire exception alert if rejected
    if (is_rejected) {
        await supabase.from('exception_alerts').insert({
            type: 'stop_skipped',
            title: 'Waste Rejected at Facility',
            message: `${operator_type === 'recycling_partner' ? 'Recycling partner' : 'Facility operator'} rejected waste from route. Reason: ${rejection_reason?.replace(/_/g, ' ')}. Vehicle: ${vehicle_number}.`,
            severity: 'high',
            route_id,
            driver_id,
        })
    }

    return NextResponse.json({ intake })
}