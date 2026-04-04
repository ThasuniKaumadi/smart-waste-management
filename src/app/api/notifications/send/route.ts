import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FCM_URL = 'https://fcm.googleapis.com/v1/projects/smart-waste-management-454ac/messages:send'

/**
 * Send a push notification to specific roles or user IDs.
 *
 * POST body:
 * {
 *   roles?: string[]        // e.g. ['supervisor', 'district_engineer']
 *   user_ids?: string[]     // specific users
 *   title: string
 *   body: string
 *   type?: string           // alert type for routing
 *   url?: string            // URL to open on click
 * }
 */
export async function POST(req: NextRequest) {
    try {
        const { roles, user_ids, title, body, type, url } = await req.json()

        if (!title || !body) {
            return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
        }

        // Build query to get FCM tokens
        let query = supabase.from('fcm_tokens').select('token, user_id')

        if (user_ids?.length) {
            query = query.in('user_id', user_ids)
        } else if (roles?.length) {
            query = query.in('role', roles)
        } else {
            return NextResponse.json({ error: 'roles or user_ids required' }, { status: 400 })
        }

        const { data: tokens, error } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        if (!tokens || tokens.length === 0) {
            return NextResponse.json({ sent: 0, message: 'No registered tokens for these recipients' })
        }

        // Get Firebase access token via service account
        const accessToken = await getFirebaseAccessToken()
        if (!accessToken) {
            return NextResponse.json({ error: 'Failed to get Firebase access token' }, { status: 500 })
        }

        // Send to each token
        const results = await Promise.allSettled(
            tokens.map(({ token }) =>
                fetch(FCM_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({
                        message: {
                            token,
                            notification: { title, body },
                            data: {
                                type: type || 'general',
                                url: url || '/dashboard',
                            },
                            webpush: {
                                notification: {
                                    title,
                                    body,
                                    icon: '/icon-192.png',
                                    badge: '/icon-192.png',
                                    requireInteraction: true,
                                },
                                fcm_options: {
                                    link: url || '/dashboard',
                                },
                            },
                        },
                    }),
                }).then(r => r.json())
            )
        )

        const sent = results.filter(r => r.status === 'fulfilled').length
        const failed = results.filter(r => r.status === 'rejected').length

        return NextResponse.json({ sent, failed, total: tokens.length })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

/**
 * Get a short-lived Firebase access token using the service account credentials.
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON env variable.
 */
async function getFirebaseAccessToken(): Promise<string | null> {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}')
        if (!serviceAccount.private_key) return null

        // Build JWT for Google OAuth2
        const now = Math.floor(Date.now() / 1000)
        const header = { alg: 'RS256', typ: 'JWT' }
        const payload = {
            iss: serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/firebase.messaging',
            aud: 'https://oauth2.googleapis.com/token',
            iat: now,
            exp: now + 3600,
        }

        const encode = (obj: object) =>
            Buffer.from(JSON.stringify(obj)).toString('base64url')

        const signingInput = `${encode(header)}.${encode(payload)}`

        // Sign with private key using Web Crypto
        const privateKeyPem = serviceAccount.private_key
        const keyData = pemToArrayBuffer(privateKeyPem)
        const cryptoKey = await crypto.subtle.importKey(
            'pkcs8', keyData,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false, ['sign']
        )

        const signature = await crypto.subtle.sign(
            'RSASSA-PKCS1-v1_5',
            cryptoKey,
            new TextEncoder().encode(signingInput)
        )

        const jwt = `${signingInput}.${Buffer.from(signature).toString('base64url')}`

        // Exchange JWT for access token
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt,
            }),
        })

        const tokenData = await tokenRes.json()
        return tokenData.access_token || null
    } catch (err) {
        console.error('Firebase access token error:', err)
        return null
    }
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
    const b64 = pem
        .replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replace(/\n/g, '')
    const binary = atob(b64)
    const buffer = new ArrayBuffer(binary.length)
    const view = new Uint8Array(buffer)
    for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i)
    return buffer
}