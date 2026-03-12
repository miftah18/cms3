'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/store/authStore'

interface PINSetupProps {
  onComplete: () => void
  onCancel?: () => void
}

export function PINSetup({ onComplete, onCancel }: PINSetupProps) {
  const { setupOfflineToken, isLoading, error, clearError } = useAuthStore()

  const [step, setStep] = useState<'password' | 'pin' | 'confirm'>('password')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    clearError()

    if (!password) {
      setLocalError('Password is required')
      return
    }

    try {
      await setupOfflineToken(password)
      setStep('pin')
      setPassword('')
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to verify password')
    }
  }

  const handlePINSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (!pin || pin.length !== 6) {
      setLocalError('PIN must be 6 digits')
      return
    }

    if (!/^\d+$/.test(pin)) {
      setLocalError('PIN must contain only numbers')
      return
    }

    setStep('confirm')
  }

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (pin !== pinConfirm) {
      setLocalError('PINs do not match')
      return
    }

    // PIN successfully set
    onComplete()
  }

  const displayError = localError || error

  return (
    <div className="w-full space-y-6">
      {displayError && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3">
          <p className="text-sm font-medium text-destructive">{displayError}</p>
        </div>
      )}

      {/* Password Step */}
      {step === 'password' && (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">Verify Your Password</h3>
            <p className="text-sm text-muted-foreground">
              We need to verify your password to set up offline access
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="pwd" className="text-sm font-medium">
              Password
            </label>
            <input
              id="pwd"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground w-full h-10 disabled:opacity-50"
          >
            {isLoading ? 'Verifying...' : 'Continue'}
          </button>
        </form>
      )}

      {/* PIN Setup Step */}
      {step === 'pin' && (
        <form onSubmit={handlePINSubmit} className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">Create a 6-Digit PIN</h3>
            <p className="text-sm text-muted-foreground">
              You will use this PIN for quick offline authentication
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="pin" className="text-sm font-medium">
              PIN (6 digits)
            </label>
            <input
              id="pin"
              type="password"
              placeholder="000000"
              value={pin}
              onChange={(e) => setPin(e.target.value.slice(0, 6))}
              maxLength={6}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-center text-lg tracking-widest"
              required
              pattern="\d{6}"
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground w-full h-10"
          >
            Next
          </button>
        </form>
      )}

      {/* PIN Confirm Step */}
      {step === 'confirm' && (
        <form onSubmit={handleConfirmSubmit} className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">Confirm Your PIN</h3>
            <p className="text-sm text-muted-foreground">
              Re-enter your PIN to confirm
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-pin" className="text-sm font-medium">
              PIN (6 digits)
            </label>
            <input
              id="confirm-pin"
              type="password"
              placeholder="000000"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.slice(0, 6))}
              maxLength={6}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-center text-lg tracking-widest"
              required
              pattern="\d{6}"
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground w-full h-10"
          >
            Complete Setup
          </button>
        </form>
      )}

      {/* Cancel Button */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="w-full text-sm text-muted-foreground hover:text-foreground"
        >
          Skip for now
        </button>
      )}
    </div>
  )
}
