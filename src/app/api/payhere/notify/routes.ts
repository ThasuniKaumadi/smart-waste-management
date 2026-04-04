import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    const body = await req.formData()

    const merchant_id = body.get('merchant_id') as string
    const order_id = body.get('order_id') as string
    const payhere_amount = body.get('payhere_amount') as string
    const payhere_currency = body.get('payhere_currency') as string
    const status_code = body.get('status_code') as string
    const md5sig = body.get('md5sig') as string
    const payment_id = body.get('payment_id') as string

    // Verify MD5 signature
    const secret = process.env.PAYHERE_MERCHANT_SECRET!
    const hashedSecret = crypto.createHash('md5').update(secret).digest('hex').toUpperCase()
    const expectedSig = crypto
        .createHash('md5')
        .update(`${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${hashedSecret}`)
        .digest('hex')
        .toUpperCase()

    if (md5sig !== expectedSig) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // status_code 2 = success
    if (status_code === '2') {
        await supabase
            .from('billing_records')
            .update({
                status: 'paid',
                payhere_payment_id: payment_id,
                paid_at: new Date().toISOString(),
            })
            .eq('payhere_order_id', order_id)
    } else if (status_code === '-1') {
        await supabase
            .from('billing_records')
            .update({ status: 'cancelled' })
            .eq('payhere_order_id', order_id)
    } else if (status_code === '-2') {
        await supabase
            .from('billing_records')
            .update({ status: 'failed' })
            .eq('payhere_order_id', order_id)
    }

    return NextResponse.json({ success: true })
}