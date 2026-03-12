'use client'

import { useRouter } from 'next/navigation'
import { PINSetup } from '@/components/auth/PINSetup'

export default function PINPage() {
  const router = useRouter()

  const handleComplete = () => {
    router.push('/pos')
  }

  const handleCancel = () => {
    router.push('/pos')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-lg bg-primary">
            <svg
              className="h-8 w-8 text-primary-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
        </div>

        {/* PIN Setup Card */}
        <div className="bg-card rounded-lg border border-border shadow-lg p-8">
          <PINSetup onComplete={handleComplete} onCancel={handleCancel} />
        </div>
      </div>
    </div>
  )
}
