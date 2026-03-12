/**
 * Device Detection and Utilities
 * Generate device ID, detect device type/name, etc.
 */

/**
 * Generate a unique device ID
 * Uses localStorage to persist the ID across sessions
 */
export function generateDeviceId(): string {
  if (typeof window === 'undefined') {
    return `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  let deviceId = localStorage.getItem('device_id')

  if (!deviceId) {
    // Generate new device ID if not exists
    deviceId = `${Date.now()}-${Math.random().toString(36).substr(2, 16)}`
    localStorage.setItem('device_id', deviceId)
  }

  return deviceId
}

/**
 * Clear the stored device ID
 * Call this on logout to generate new ID on next login
 */
export function clearDeviceId(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('device_id')
  }
}

/**
 * Detect device type from user agent
 */
export function detectDeviceType(): 'desktop' | 'tablet' | 'mobile' {
  if (typeof window === 'undefined') return 'desktop'

  const ua = navigator.userAgent.toLowerCase()

  if (/ipad|android(?!.*mobi)/.test(ua)) {
    return 'tablet'
  }

  if (
    /mobile|android|webos|iphone|ipod|blackberry|iemobile|opera mini/.test(ua)
  ) {
    return 'mobile'
  }

  return 'desktop'
}

/**
 * Detect browser name from user agent
 */
export function detectBrowser(): string {
  if (typeof window === 'undefined') return 'unknown'

  const ua = navigator.userAgent
  let browser = 'unknown'

  if (/firefox/i.test(ua)) {
    browser = 'Firefox'
  } else if (/chrome/i.test(ua) && !/edge/i.test(ua)) {
    browser = 'Chrome'
  } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    browser = 'Safari'
  } else if (/edge|edg/i.test(ua)) {
    browser = 'Edge'
  } else if (/opr|opera/i.test(ua)) {
    browser = 'Opera'
  }

  return browser
}

/**
 * Detect OS from user agent
 */
export function detectOS(): string {
  if (typeof window === 'undefined') return 'unknown'

  const ua = navigator.userAgent
  let os = 'unknown'

  if (/windows/i.test(ua)) {
    os = 'Windows'
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'macOS'
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = 'iOS'
  } else if (/android/i.test(ua)) {
    os = 'Android'
  } else if (/linux/i.test(ua)) {
    os = 'Linux'
  }

  return os
}

/**
 * Generate a friendly device name
 * E.g., "Chrome on Windows", "Safari on iOS"
 */
export function generateDeviceName(): string {
  if (typeof window === 'undefined') return 'Unknown Device'

  const browser = detectBrowser()
  const os = detectOS()
  const deviceType = detectDeviceType()

  if (browser === 'unknown' || os === 'unknown') {
    return 'Unknown Device'
  }

  return `${browser} on ${os}`
}

/**
 * Get detailed device info for session metadata
 */
export function getDeviceInfo(): {
  device_id: string
  device_name: string
  device_type: string
  browser: string
  os: string
  user_agent: string
} {
  return {
    device_id: generateDeviceId(),
    device_name: generateDeviceName(),
    device_type: detectDeviceType(),
    browser: detectBrowser(),
    os: detectOS(),
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
  }
}
