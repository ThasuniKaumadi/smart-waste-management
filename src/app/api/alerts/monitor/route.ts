import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { createExceptionAlert } from '@/lib/alerts'

// Called by the driver location page every time GPS is updated.
// Checks for: stationary vehicle, route deviation, skip-without-reason.
// Safe to call frequently — deduplicates by checking for unresolved alerts of same type+route.

const STATIONARY_THRESHOLD_MINUTES = 15   // alert if no movement for this long
const DEVIATION_THRESHOLD_METERS = 500  // alert if vehicle >500m from nearest stop

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function alertAlreadyOpen(supabase: any, type: string, routeId: string): Promise<boolean> {
    const { data } = await supabase
        .from('exception_alerts')
        .select('id')
        .eq('alert_type', type)
        .eq('route_id', routeId)
        .eq('resolved', false)
        .limit(1)
    return (data?.length || 0) > 0
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { route_id, driver_id, latitude, longitude } = body

        if (!route_id || !driver_id) {
            return NextResponse.json({ error: 'route_id and driver_id required' }, { status: 400 })
        }

        const supabase = createClient()
        const triggered: string[] = []

        // ── 1. Stationary vehicle check ──────────────────────────────────────────
        const { data: prevLoc } = await supabase
            .from('vehicle_locations')
            .select('latitude, longitude, updated_at')
            .eq('route_id', route_id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (prevLoc && latitude != null && longitude != null) {
            const distMoved = haversineMeters(prevLoc.latitude, prevLoc.longitude, latitude, longitude)
            const minutesSinceUpdate = (Date.now() - new Date(prevLoc.updated_at).getTime()) / 60000

            if (distMoved < 50 && minutesSinceUpdate >= STATIONARY_THRESHOLD_MINUTES) {
                const already = await alertAlreadyOpen(supabase, 'stationary_vehicle', route_id)
                if (!already) {
                    await createExceptionAlert({
                        type: 'stationary_vehicle',
                        title: 'Vehicle stationary',
                        message: `Vehicle on route has not moved for ${Math.round(minutesSinceUpdate)} minutes.`,
                        severity: 'high',
                        route_id,
                        driver_id,
                    })
                    triggered.push('stationary_vehicle')
                }
            }
        }

        // ── 2. Route deviation check ─────────────────────────────────────────────
        if (latitude != null && longitude != null) {
            const { data: pendingStops } = await supabase
                .from('collection_stops')
                .select('latitude, longitude, road_name, address')
                .eq('route_id', route_id)
                .eq('status', 'pending')
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)

            if (pendingStops && pendingStops.length > 0) {
                const minDist = Math.min(
                    ...pendingStops.map((s: any) => haversineMeters(latitude, longitude, s.latitude, s.longitude))
                )
                if (minDist > DEVIATION_THRESHOLD_METERS) {
                    const already = await alertAlreadyOpen(supabase, 'deviation', route_id)
                    if (!already) {
                        await createExceptionAlert({
                            type: 'deviation',
                            title: 'Route deviation detected',
                            message: `Vehicle is ${Math.round(minDist)}m from the nearest pending stop — possible off-route deviation.`,
                            severity: 'medium',
                            route_id,
                            driver_id,
                        })
                        triggered.push('deviation')
                    }
                }
            }
        }

        // ── 3. Skip without reason check ────────────────────────────────────────
        const { data: badSkips } = await supabase
            .from('collection_stops')
            .select('id, road_name, address')
            .eq('route_id', route_id)
            .eq('status', 'skipped')
            .is('skip_reason', null)

        if (badSkips && badSkips.length > 0) {
            const already = await alertAlreadyOpen(supabase, 'skip', route_id)
            if (!already) {
                const stopNames = badSkips.map((s: any) => s.road_name || s.address).join(', ')
                await createExceptionAlert({
                    type: 'skip',
                    title: 'Stop skipped without reason',
                    message: `${badSkips.length} stop(s) skipped with no reason recorded: ${stopNames}`,
                    severity: 'high',
                    route_id,
                    driver_id,
                })
                triggered.push('skip_no_reason')
            }
        }

        return NextResponse.json({ triggered })
    } catch (err: any) {
        console.error('Alert monitor error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}