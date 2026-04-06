import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
    try {
        const body = await req.formData()
        const merchantId = body.get('merchant_id') as string
        const orderId = body.get('order_id') as string
        const paymentId = body.get('payment_id') as string
        const payhereMd5 = body.get('md5sig') as string
        const statusCode = body.get('status_code') as string
        const paymentAmount = body.get('payhere_amount') as string
        const payhereСurrency = body.get('payhere_currency') as string

        const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET!

        // Verify hash
        const localMd5 = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase()
        const hashStr = `${merchantId}${orderId}${paymentAmount}${payhereСurrency}${statusCode}${localMd5}`
        const hash = crypto.createHash('md5').update(hashStr).digest('hex').toUpperCase()

        if (hash !== payhereMd5) {
            return NextResponse.json({ error: 'Invalid hash' }, { status: 400 })
        }

        // Status 2 = success
        if (statusCode === '2') {
            const supabase = createClient()

            // Mark invoice as paid
            const { data: invoice } = await supabase
                .from('invoices')
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    payhere_payment_id: paymentId,
                })
                .eq('payhere_order_id', orderId)
                .select('commercial_id')
                .single()

            // Reinstate service if was suspended
            if (invoice?.commercial_id) {
                await supabase
                    .from('profiles')
                    .update({ billing_suspended: false, billing_suspended_at: null })
                    .eq('id', invoice.commercial_id)
                    .eq('billing_suspended', true)
            }
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}