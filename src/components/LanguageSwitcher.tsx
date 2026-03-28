'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const LANGUAGES = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'si', label: 'සිංහල', flag: '🇱🇰' },
    { code: 'ta', label: 'தமிழ்', flag: '🇱🇰' },
]

export default function LanguageSwitcher() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [current, setCurrent] = useState(() => {
        if (typeof window !== 'undefined') {
            const match = document.cookie.match(/locale=([^;]+)/)
            return match ? match[1] : 'en'
        }
        return 'en'
    })

    function switchLanguage(code: string) {
        document.cookie = `locale=${code};path=/;max-age=31536000`
        setCurrent(code)
        setOpen(false)
        router.refresh()
    }

    const currentLang = LANGUAGES.find(l => l.code === current) || LANGUAGES[0]

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-sm px-3 py-1.5 rounded-lg transition-colors shadow-sm"
            >
                <span>{currentLang.flag}</span>
                <span>{currentLang.label}</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div className="absolute right-0 top-10 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 min-w-32">
                    {LANGUAGES.map(lang => (
                        <button
                            key={lang.code}
                            onClick={() => switchLanguage(lang.code)}
                            className={`w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50 text-left ${current === lang.code ? 'text-blue-600 font-medium' : 'text-slate-700'
                                }`}
                        >
                            <span>{lang.flag}</span>
                            <span>{lang.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}