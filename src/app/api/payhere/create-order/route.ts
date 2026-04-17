import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    try {
        const { invoice_id } = await req.json()

        if (!invoice_id) {
            return NextResponse.json({ error: 'invoice_id is required' }, { status: 400 })
        }

        // Fetch the billing record
        const { data: invoice, error: invoiceError } = await supabase
            .from('billing_records')
            .select('*, profiles:commercial_id(*)')
            .eq('id', invoice_id)
            .single()

        if (invoiceError || !invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
        }

        const merchantId = process.env.PAYHERE_MERCHANT_ID || '1230268'
        const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET || ''
        const sandbox = process.env.PAYHERE_SANDBOX !== 'false'

        const orderId = `INV-${invoice_id.slice(0, 8).toUpperCase()}`
        const amount = Number(invoice.amount).toFixed(2)
        const currency = invoice.currency || 'LKR'

        // Generate PayHere hash: MD5(merchant_id + order_id + amount + currency + MD5(secret).toUpperCase())
        const secretHash = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase()
        const hashString = `${merchantId}${orderId}${amount}${currency}${secretHash}`
        const hash = crypto.createHash('md5').update(hashString).digest('hex').toUpperCase()

        // Get profile details for PayHere
        const profile = invoice.profiles as any
        const fullName = profile?.full_name || profile?.organisation_name || 'Test User'
        const nameParts = fullName.split(' ')
        const firstName = nameParts[0] || 'Test'
        const lastName = nameParts.slice(1).join(' ') || 'User'

        return NextResponse.json({
            sandbox,
            merchant_id: merchantId,
            order_id: orderId,
            items: invoice.description || 'Waste Collection Service',
            amount,
            currency,
            hash,
            first_name: firstName,
            last_name: lastName,
            email: profile?.email || 'test@test.com',
            phone: profile?.phone || '0771234567',
            address: profile?.address || 'CMC District',
            city: profile?.district || 'Colombo',
            country: 'Sri Lanka',
        })
    } catch (err) {
        console.error('create-order error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}