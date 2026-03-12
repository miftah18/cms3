import { Metadata } from 'next'
import { SessionManager } from '@/components/auth/SessionManager'

export const metadata: Metadata = {
  title: 'Active Sessions | Settings',
  description: 'Manage your active sessions and logged-in devices',
}

export default function SessionsPage() {
  return (
    <div className="container py-8">
      <div className="max-w-2xl">
        <SessionManager />
      </div>
    </div>
  )
}
