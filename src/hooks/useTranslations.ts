'use client'

import { useState, useEffect } from 'react'

type Messages = Record<string, Record<string, string>>

export function useTranslations(namespace: string) {
    const [messages, setMessages] = useState<Record<string, string>>({})

    useEffect(() => {
        const match = document.cookie.match(/locale=([^;]+)/)
        const locale = match ? match[1] : 'en'

        import(`@/messages/${locale}.json`)
            .then(mod => {
                setMessages(mod.default[namespace] || {})
            })
            .catch(() => {
                import(`@/messages/en.json`)
                    .then(mod => setMessages(mod.default[namespace] || {}))
            })
    }, [namespace])

    function t(key: string): string {
        return messages[key] || key
    }

    return { t }
}