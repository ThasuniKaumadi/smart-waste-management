'use client'

import { useState, useRef, useEffect } from 'react'
import { ALL_WARDS, getDistrictFromWard } from '@/lib/districts'

interface WardSelectorProps {
    value: string
    onChange: (ward: string, district: string) => void
    placeholder?: string
}

export default function WardSelector({ value, onChange, placeholder = 'Search your ward...' }: WardSelectorProps) {
    const [query, setQuery] = useState(value || '')
    const [open, setOpen] = useState(false)
    const [filtered, setFiltered] = useState(ALL_WARDS)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (value) setQuery(value)
    }, [value])

    useEffect(() => {
        const q = query.toLowerCase().trim()
        if (!q) {
            setFiltered(ALL_WARDS)
        } else {
            setFiltered(ALL_WARDS.filter(w =>
                w.ward.toLowerCase().includes(q) ||
                w.district.toLowerCase().includes(q)
            ))
        }
    }, [query])

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
                // If typed text doesn't match a ward, reset
                const match = ALL_WARDS.find(w => w.ward.toLowerCase() === query.toLowerCase())
                if (!match) { setQuery(value || ''); }
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [query, value])

    function handleSelect(ward: string) {
        const district = getDistrictFromWard(ward)
        setQuery(ward)
        setOpen(false)
        onChange(ward, district)
    }

    // Group filtered by district
    const grouped: Record<string, string[]> = {}
    filtered.forEach(({ ward, district }) => {
        if (!grouped[district]) grouped[district] = []
        grouped[district].push(ward)
    })

    return (
        <div ref={ref} style={{ position: 'relative', width: '100%' }}>
            <style>{`
        .ward-input {
          width: 100%;
          padding: 12px 40px 12px 16px;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          font-size: 14px;
          color: #181c22;
          font-family: 'Inter', sans-serif;
          background: #fafafa;
          transition: all 0.2s ease;
          outline: none;
          box-sizing: border-box;
        }
        .ward-input:focus {
          border-color: #00450d;
          background: white;
          box-shadow: 0 0 0 3px rgba(0,69,13,0.08);
        }
        .ward-input::placeholder { color: #9ca3af; }

        .ward-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0; right: 0;
          background: white;
          border: 1px solid rgba(0,69,13,0.1);
          border-radius: 12px;
          box-shadow: 0 20px 40px -10px rgba(0,0,0,0.12);
          z-index: 100;
          max-height: 280px;
          overflow-y: auto;
          padding: 6px;
        }
        .ward-dropdown::-webkit-scrollbar { width: 4px; }
        .ward-dropdown::-webkit-scrollbar-track { background: transparent; }
        .ward-dropdown::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 99px; }

        .ward-group-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #94a3b8;
          font-family: 'Manrope', sans-serif;
          padding: 8px 10px 4px;
        }

        .ward-option {
          padding: 9px 12px;
          border-radius: 8px;
          font-size: 14px;
          color: #181c22;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: background 0.15s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ward-option:hover { background: #f0fdf4; color: #00450d; }

        .ward-empty {
          padding: 24px;
          text-align: center;
          font-size: 13px;
          color: #94a3b8;
          font-family: 'Inter', sans-serif;
        }
      `}</style>

            <div style={{ position: 'relative' }}>
                <input
                    type="text"
                    className="ward-input"
                    placeholder={placeholder}
                    value={query}
                    onChange={e => { setQuery(e.target.value); setOpen(true) }}
                    onFocus={() => setOpen(true)}
                />
                <span style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)',
                    fontFamily: 'Material Symbols Outlined',
                    fontSize: '18px', color: '#94a3b8',
                    fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                    pointerEvents: 'none',
                }}>
                    search
                </span>
            </div>

            {open && (
                <div className="ward-dropdown">
                    {Object.keys(grouped).length === 0 ? (
                        <div className="ward-empty">No wards found for &quot;{query}&quot;</div>
                    ) : (
                        Object.entries(grouped).map(([district, wards]) => (
                            <div key={district}>
                                <div className="ward-group-label">{district}</div>
                                {wards.map(ward => (
                                    <div key={ward} className="ward-option" onClick={() => handleSelect(ward)}>
                                        <span style={{
                                            fontFamily: 'Material Symbols Outlined',
                                            fontSize: '14px', color: '#00450d',
                                            fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                                        }}>location_on</span>
                                        {ward}
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}