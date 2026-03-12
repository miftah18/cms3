'use client'

import React, { useEffect } from 'react'
import { AuthInitializer } from './auth/AuthInitializer'
import { OfflineBanner } from './layout/OfflineBanner'
import { NetworkStatusProvider } from '@/lib/providers/NetworkStatusProvider'
import { SyncProvider } from '@/lib/providers/SyncProvider'

/**
 * Root Providers Component
 * Wraps the entire app with necessary providers and initializers
 */
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Register service worker for offline support
    if ('serviceWorker' in navigator && process.env.NEXT_PUBLIC_ENABLE_PWA === 'true') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[v0] Service Worker registered:', registration)
        })
        .catch((error) => {
          console.error('[v0] Service Worker registration failed:', error)
        })
    }

    // Prevent pinch zoom on iOS
    document.addEventListener('gesturestart', (e) => {
      e.preventDefault()
    })

    return () => {
      document.removeEventListener('gesturestart', (e) => {
        e.preventDefault()
      })
    }
  }, [])

  return (
    <NetworkStatusProvider>
      <SyncProvider>
        <AuthInitializer>
          <OfflineBanner />
          {children}
        </AuthInitializer>
      </SyncProvider>
    </NetworkStatusProvider>
  )
}
