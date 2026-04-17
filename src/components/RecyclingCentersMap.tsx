'use client'

import { useState, useCallback } from 'react'
import { useJsApiLoader, GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'

const COLOMBO_CENTER = { lat: 6.9271, lng: 79.8612 }

const RECYCLING_CENTERS = [
    {
        id: 1,
        name: 'Karadiyana Solid Waste Management Complex',
        address: 'Karadiyana, Piliyandala',
        district: 'District 3',
        types: ['General Waste', 'Compost', 'Recyclables'],
        hours: 'Mon–Sat: 7:00 AM – 5:00 PM',
        phone: '+94 11 281 0000',
        lat: 6.8270,
        lng: 79.9080,
        color: '#00450d',
    },
    {
        id: 2,
        name: 'CMC Recycling Centre – Kolonnawa',
        address: 'Kolonnawa, Colombo East',
        district: 'District 2B',
        types: ['Plastic', 'Paper', 'Glass', 'Metal'],
        hours: 'Mon–Fri: 8:00 AM – 4:00 PM',
        phone: '+94 11 258 3333',
        lat: 6.9200,
        lng: 79.9050,
        color: '#00450d',
    },
    {
        id: 3,
        name: 'Abans Environmental Services – Recycling Hub',
        address: 'Borella, Colombo 8',
        district: 'District 4',
        types: ['E-Waste', 'Plastic', 'Paper'],
        hours: 'Mon–Sat: 9:00 AM – 6:00 PM',
        phone: '+94 11 269 4888',
        lat: 6.9200,
        lng: 79.8750,
        color: '#00450d',
    },
    {
        id: 4,
        name: 'Burns Trading Recycling Point',
        address: 'Maradana, Colombo 10',
        district: 'District 2A',
        types: ['Scrap Metal', 'Paper', 'Plastic'],
        hours: 'Mon–Fri: 7:30 AM – 5:00 PM',
        phone: '+94 11 243 7700',
        lat: 6.9310,
        lng: 79.8670,
        color: '#00450d',
    },
    {
        id: 5,
        name: 'Carekleen Drop-off Centre – Nugegoda',
        address: 'Nugegoda, Colombo 10',
        district: 'District 1',
        types: ['Organic', 'Plastic', 'Glass'],
        hours: 'Mon–Sun: 8:00 AM – 8:00 PM',
        phone: '+94 11 281 5500',
        lat: 6.8743,
        lng: 79.8877,
        color: '#00450d',
    },
    {
        id: 6,
        name: 'Dematagoda Transfer Station',
        address: 'Dematagoda, Colombo 9',
        district: 'District 2B',
        types: ['General Waste', 'Bulky Items'],
        hours: 'Mon–Sat: 6:00 AM – 6:00 PM',
        phone: '+94 11 267 4400',
        lat: 6.9380,
        lng: 79.8760,
        color: '#00450d',
    },
]

const TYPE_COLORS: Record<string, string> = {
    'General Waste': 'bg-gray-100 text-gray-700',
    'Compost': 'bg-lime-100 text-lime-700',
    'Recyclables': 'bg-blue-100 text-blue-700',
    'Plastic': 'bg-yellow-100 text-yellow-700',
    'Paper': 'bg-orange-100 text-orange-700',
    'Glass': 'bg-cyan-100 text-cyan-700',
    'Metal': 'bg-zinc-100 text-zinc-700',
    'E-Waste': 'bg-purple-100 text-purple-700',
    'Scrap Metal': 'bg-slate-100 text-slate-700',
    'Organic': 'bg-green-100 text-green-700',
    'Bulky Items': 'bg-red-100 text-red-700',
}

interface Props {
    googleMapsApiKey: string
}

export default function RecyclingCentersMap({ googleMapsApiKey }: Props) {
    const [view, setView] = useState<'map' | 'carousel'>('map')
    const [selected, setSelected] = useState<typeof RECYCLING_CENTERS[0] | null>(null)
    const [carouselIndex, setCarouselIndex] = useState(0)
    const [map, setMap] = useState<google.maps.Map | null>(null)

    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey,
        id: 'recycling-map-script',
    })

    const onLoad = useCallback((m: google.maps.Map) => setMap(m), [])

    const prev = () => setCarouselIndex(i => (i - 1 + RECYCLING_CENTERS.length) % RECYCLING_CENTERS.length)
    const next = () => setCarouselIndex(i => (i + 1) % RECYCLING_CENTERS.length)

    const visibleCards = () => {
        const total = RECYCLING_CENTERS.length
        return [
            RECYCLING_CENTERS[(carouselIndex) % total],
            RECYCLING_CENTERS[(carouselIndex + 1) % total],
            RECYCLING_CENTERS[(carouselIndex + 2) % total],
        ]
    }

    return (
        <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'white', border: '1px solid #e5e7eb' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm"
                        style={{ background: '#00450d' }}
                    >
                        ♻
                    </span>
                    <div>
                        <h3 className="font-semibold text-gray-800 text-sm leading-tight">Recycling Centres</h3>
                        <p className="text-xs text-gray-400">Colombo Municipal Council</p>
                    </div>
                </div>
                {/* Toggle */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    <button
                        onClick={() => setView('map')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${view === 'map' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
                            }`}
                    >
                        🗺 Map
                    </button>
                    <button
                        onClick={() => setView('carousel')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${view === 'carousel' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
                            }`}
                    >
                        ☰ List
                    </button>
                </div>
            </div>

            {/* Map View */}
            {view === 'map' && (
                <div className="relative" style={{ height: 340 }}>
                    {isLoaded ? (
                        <GoogleMap
                            mapContainerStyle={{ width: '100%', height: '100%' }}
                            center={COLOMBO_CENTER}
                            zoom={12}
                            onLoad={onLoad}
                            options={{
                                styles: [
                                    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                                    { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
                                ],
                                zoomControl: true,
                                streetViewControl: false,
                                mapTypeControl: false,
                                fullscreenControl: false,
                            }}
                        >
                            {RECYCLING_CENTERS.map(center => (
                                <Marker
                                    key={center.id}
                                    position={{ lat: center.lat, lng: center.lng }}
                                    onClick={() => setSelected(center)}
                                    icon={{
                                        path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z',
                                        fillColor: '#00450d',
                                        fillOpacity: 1,
                                        strokeColor: '#fff',
                                        strokeWeight: 1.5,
                                        scale: 1.8,
                                        anchor: new google.maps.Point(12, 22),
                                    }}
                                />
                            ))}

                            {selected && (
                                <InfoWindow
                                    position={{ lat: selected.lat, lng: selected.lng }}
                                    onCloseClick={() => setSelected(null)}
                                >
                                    <div style={{ maxWidth: 220, fontFamily: 'Inter, sans-serif' }}>
                                        <p style={{ fontWeight: 700, fontSize: 13, color: '#00450d', marginBottom: 2 }}>
                                            {selected.name}
                                        </p>
                                        <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{selected.address}</p>
                                        <p style={{ fontSize: 11, color: '#374151', marginBottom: 2 }}>🕐 {selected.hours}</p>
                                        <p style={{ fontSize: 11, color: '#374151', marginBottom: 4 }}>📞 {selected.phone}</p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                            {selected.types.map(t => (
                                                <span
                                                    key={t}
                                                    style={{
                                                        background: '#f0fdf4',
                                                        color: '#00450d',
                                                        borderRadius: 4,
                                                        padding: '1px 6px',
                                                        fontSize: 10,
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </InfoWindow>
                            )}
                        </GoogleMap>
                    ) : (
                        <div className="flex items-center justify-center h-full bg-gray-50">
                            <div className="text-center">
                                <div
                                    className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2"
                                    style={{ borderColor: '#00450d', borderTopColor: 'transparent' }}
                                />
                                <p className="text-xs text-gray-400">Loading map…</p>
                            </div>
                        </div>
                    )}

                    {/* Legend */}
                    <div className="absolute bottom-3 left-3 bg-white rounded-lg shadow px-3 py-2 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full inline-block" style={{ background: '#00450d' }} />
                        <span className="text-xs text-gray-600">Recycling Centre</span>
                    </div>
                </div>
            )}

            {/* Carousel / List View */}
            {view === 'carousel' && (
                <div className="p-4">
                    {/* 3-card carousel */}
                    <div className="relative">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {visibleCards().map((center, idx) => (
                                <div
                                    key={`${center.id}-${idx}`}
                                    className="rounded-xl p-4 border border-gray-100 hover:border-green-200 transition-all cursor-pointer"
                                    style={{ background: '#f9fafb' }}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <span
                                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                            style={{ background: '#e6f4ea', color: '#00450d' }}
                                        >
                                            {center.district}
                                        </span>
                                    </div>
                                    <h4 className="font-semibold text-gray-800 text-sm leading-tight mb-1">
                                        {center.name}
                                    </h4>
                                    <p className="text-xs text-gray-400 mb-3">{center.address}</p>
                                    <div className="space-y-1 mb-3">
                                        <p className="text-xs text-gray-600 flex items-center gap-1">
                                            <span>🕐</span> {center.hours}
                                        </p>
                                        <p className="text-xs text-gray-600 flex items-center gap-1">
                                            <span>📞</span> {center.phone}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {center.types.map(t => (
                                            <span
                                                key={t}
                                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[t] ?? 'bg-gray-100 text-gray-600'}`}
                                            >
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Nav arrows */}
                        <div className="flex items-center justify-between mt-4">
                            <button
                                onClick={prev}
                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition"
                            >
                                ← Prev
                            </button>
                            {/* Dot indicators */}
                            <div className="flex gap-1.5">
                                {RECYCLING_CENTERS.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCarouselIndex(i)}
                                        className={`w-1.5 h-1.5 rounded-full transition-all ${i === carouselIndex ? 'w-4' : ''
                                            }`}
                                        style={{ background: i === carouselIndex ? '#00450d' : '#d1d5db' }}
                                    />
                                ))}
                            </div>
                            <button
                                onClick={next}
                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition"
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-400">{RECYCLING_CENTERS.length} centres across Colombo</span>
                <span className="text-xs" style={{ color: '#00450d' }}>
                    ♻ Reduce · Reuse · Recycle
                </span>
            </div>
        </div>
    )
}