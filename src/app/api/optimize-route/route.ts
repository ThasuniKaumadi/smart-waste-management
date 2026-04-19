import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    if (!url) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
    }

    // Only allow Google Maps Directions API calls
    if (!url.startsWith('https://maps.googleapis.com/maps/api/directions/json')) {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    try {
        const res = await fetch(url)
        const data = await res.json()
        return NextResponse.json(data)
    } catch (err) {
        return NextResponse.json({ error: 'Failed to fetch from Google Maps' }, { status: 500 })
    }
}