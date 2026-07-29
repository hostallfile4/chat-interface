export interface UserProfile {
  userId: string
  createdAt: number
  expiresAt: number
  personalContext: string
  consentGiven: boolean
}

export interface UserSession {
  sessionId: string
  userId: string
  title: string
  createdAt: number
  lastActivity: number
  messages: any[]
}

const USER_KEY_PREFIX = "chat_user_"
const SESSION_KEY_PREFIX = "chat_session_"
const CONSENT_KEY = "chat_consent_shown"
const STORAGE_PREFIX = "chat_"

export function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function createUserProfile(personalContext: string = ""): UserProfile {
  const userId = generateUserId()
  const now = Date.now()
  const expiresAt = now + 24 * 60 * 60 * 1000 // 24 hours

  const profile: UserProfile = {
    userId,
    createdAt: now,
    expiresAt,
    personalContext,
    consentGiven: true,
  }

  localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(profile))
  localStorage.setItem(CONSENT_KEY, JSON.stringify({ shown: true, timestamp: now }))

  return profile
}

export function getUserProfile(userId: string): UserProfile | null {
  try {
    const data = localStorage.getItem(`${STORAGE_PREFIX}${userId}`)
    if (!data) return null

    const profile = JSON.parse(data) as UserProfile

    // Check if expired
    if (profile.expiresAt < Date.now()) {
      deleteUserProfile(userId)
      return null
    }

    return profile
  } catch (e) {
    console.error("[v0] Error loading user profile:", e)
    return null
  }
}

export function updateUserProfile(userId: string, personalContext: string): UserProfile | null {
  const profile = getUserProfile(userId)
  if (!profile) return null

  profile.personalContext = personalContext
  localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(profile))

  return profile
}

export function deleteUserProfile(userId: string): void {
  localStorage.removeItem(`${STORAGE_PREFIX}${userId}`)

  // Delete all sessions for this user
  const keys = Object.keys(localStorage)
  keys.forEach((key) => {
    if (key.startsWith(`${SESSION_KEY_PREFIX}${userId}_`)) {
      localStorage.removeItem(key)
    }
  })
}

export function createUserSession(userId: string, title: string = "New Chat"): UserSession {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = Date.now()

  const session: UserSession = {
    sessionId,
    userId,
    title,
    createdAt: now,
    lastActivity: now,
    messages: [],
  }

  localStorage.setItem(`${SESSION_KEY_PREFIX}${userId}_${sessionId}`, JSON.stringify(session))

  return session
}

export function getUserSessions(userId: string): UserSession[] {
  try {
    const sessions: UserSession[] = []
    const keys = Object.keys(localStorage)

    keys.forEach((key) => {
      if (key.startsWith(`${SESSION_KEY_PREFIX}${userId}_`)) {
        const data = localStorage.getItem(key)
        if (data) {
          sessions.push(JSON.parse(data) as UserSession)
        }
      }
    })

    return sessions.sort((a, b) => b.lastActivity - a.lastActivity)
  } catch (e) {
    console.error("[v0] Error loading user sessions:", e)
    return []
  }
}

export function updateUserSession(userId: string, sessionId: string, updates: Partial<UserSession>): UserSession | null {
  try {
    const data = localStorage.getItem(`${SESSION_KEY_PREFIX}${userId}_${sessionId}`)
    if (!data) return null

    const session = JSON.parse(data) as UserSession
    const updated = { ...session, ...updates, lastActivity: Date.now() }

    localStorage.setItem(`${SESSION_KEY_PREFIX}${userId}_${sessionId}`, JSON.stringify(updated))

    return updated
  } catch (e) {
    console.error("[v0] Error updating session:", e)
    return null
  }
}

export function deleteUserSession(userId: string, sessionId: string): void {
  localStorage.removeItem(`${SESSION_KEY_PREFIX}${userId}_${sessionId}`)
}

export function hasConsentBeenShown(): boolean {
  try {
    const data = localStorage.getItem(CONSENT_KEY)
    return data ? JSON.parse(data).shown === true : false
  } catch {
    return false
  }
}

export function getCurrentUserId(): string | null {
  try {
    const userId = localStorage.getItem(`${STORAGE_PREFIX}current_user_id`)
    if (userId) {
      const profile = getUserProfile(userId)
      if (profile) return userId
      // If profile expired, clear it
      localStorage.removeItem(`${STORAGE_PREFIX}current_user_id`)
    }
    return null
  } catch {
    return null
  }
}

export function setCurrentUserId(userId: string): void {
  localStorage.setItem(`${STORAGE_PREFIX}current_user_id`, userId)
}

export function clearCurrentUserId(): void {
  localStorage.removeItem(`${STORAGE_PREFIX}current_user_id`)
}
