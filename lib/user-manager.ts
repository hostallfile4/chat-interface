/**
 * User Management System
 * Manages ephemeral user profiles with localStorage persistence
 * Auto-expires after 24 hours
 */

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
  messages: Array<{
    id: string
    content: string
    role: "user" | "assistant"
    timestamp: string
  }>
}

export interface AppConfig {
  apiUrl: string
  models: Array<{ id: string; name: string }>
}

const STORAGE_PREFIX = "chat_"
const USER_PREFIX = "user_"
const SESSION_PREFIX = "session_"
const CONSENT_KEY = "consent_shown"
const CURRENT_USER_KEY = "current_user"
const CONFIG_KEY = "app_config"
const CLEANUP_KEY = "cleanup_done"

/**
 * Generate a unique user ID
 */
export function generateUserId(): string {
  return `${USER_PREFIX}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create a new user profile with optional personal context
 */
export function createUserProfile(personalContext: string = ""): UserProfile {
  const userId = generateUserId()
  const now = Date.now()
  const expiresAt = now + 24 * 60 * 60 * 1000 // 24 hours

  const profile: UserProfile = {
    userId,
    createdAt: now,
    expiresAt,
    personalContext: personalContext.trim(),
    consentGiven: true,
  }

  // Save profile
  localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(profile))

  // Mark consent as shown
  localStorage.setItem(`${STORAGE_PREFIX}${CONSENT_KEY}`, JSON.stringify({ shown: true, timestamp: now }))

  // Set as current user
  localStorage.setItem(`${STORAGE_PREFIX}${CURRENT_USER_KEY}`, userId)

  return profile
}

/**
 * Get user profile by ID
 */
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
  } catch (error) {
    console.error("[app] Error loading user profile:", error)
    return null
  }
}

/**
 * Update user's personal context
 */
export function updateUserProfile(userId: string, personalContext: string): UserProfile | null {
  const profile = getUserProfile(userId)
  if (!profile) return null

  profile.personalContext = personalContext.trim()
  profile.lastActivity = Date.now()
  localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(profile))

  return profile
}

/**
 * Add activity timestamp to user profile
 */
export function updateUserActivity(userId: string): void {
  const profile = getUserProfile(userId)
  if (profile) {
    profile.lastActivity = Date.now()
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(profile))
  }
}

/**
 * Delete user profile and all their sessions
 */
export function deleteUserProfile(userId: string): void {
  // Delete profile
  localStorage.removeItem(`${STORAGE_PREFIX}${userId}`)

  // Delete all sessions
  const keys = Object.keys(localStorage)
  keys.forEach((key) => {
    if (key.includes(`${STORAGE_PREFIX}${SESSION_PREFIX}${userId}`)) {
      localStorage.removeItem(key)
    }
  })

  // Clear current user if it was this user
  const currentUser = localStorage.getItem(`${STORAGE_PREFIX}${CURRENT_USER_KEY}`)
  if (currentUser === userId) {
    localStorage.removeItem(`${STORAGE_PREFIX}${CURRENT_USER_KEY}`)
  }
}

/**
 * Create a new chat session
 */
export function createUserSession(userId: string, title: string = "New Chat"): UserSession {
  const sessionId = `${SESSION_PREFIX}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = Date.now()

  const session: UserSession = {
    sessionId,
    userId,
    title,
    createdAt: now,
    lastActivity: now,
    messages: [],
  }

  localStorage.setItem(`${STORAGE_PREFIX}${sessionId}`, JSON.stringify(session))
  return session
}

/**
 * Get all sessions for a user
 */
export function getUserSessions(userId: string): UserSession[] {
  const sessions: UserSession[] = []
  const keys = Object.keys(localStorage)

  keys.forEach((key) => {
    if (key.includes(`${STORAGE_PREFIX}${SESSION_PREFIX}`) && key.includes(userId)) {
      try {
        const data = localStorage.getItem(key)
        if (data) {
          const session = JSON.parse(data) as UserSession
          sessions.push(session)
        }
      } catch (error) {
        console.error("[app] Error loading session:", error)
      }
    }
  })

  // Sort by last activity
  return sessions.sort((a, b) => b.lastActivity - a.lastActivity)
}

/**
 * Update a session
 */
export function updateUserSession(
  userId: string,
  sessionId: string,
  updates: Partial<UserSession>
): UserSession | null {
  const key = `${STORAGE_PREFIX}${sessionId}`
  const data = localStorage.getItem(key)
  if (!data) return null

  try {
    const session = JSON.parse(data) as UserSession
    Object.assign(session, updates, { lastActivity: Date.now() })
    localStorage.setItem(key, JSON.stringify(session))
    return session
  } catch (error) {
    console.error("[app] Error updating session:", error)
    return null
  }
}

/**
 * Delete a session
 */
export function deleteUserSession(userId: string, sessionId: string): void {
  const key = `${STORAGE_PREFIX}${sessionId}`
  localStorage.removeItem(key)
}

/**
 * Get current user ID
 */
export function getCurrentUserId(): string | null {
  return localStorage.getItem(`${STORAGE_PREFIX}${CURRENT_USER_KEY}`)
}

/**
 * Set current user ID
 */
export function setCurrentUserId(userId: string): void {
  localStorage.setItem(`${STORAGE_PREFIX}${CURRENT_USER_KEY}`, userId)
}

/**
 * Clear current user ID
 */
export function clearCurrentUserId(): void {
  localStorage.removeItem(`${STORAGE_PREFIX}${CURRENT_USER_KEY}`)
}

/**
 * Check if consent has been shown
 */
export function hasConsentBeenShown(): boolean {
  const consent = localStorage.getItem(`${STORAGE_PREFIX}${CONSENT_KEY}`)
  return consent !== null
}

/**
 * Get app configuration
 */
export function getAppConfig(): AppConfig | null {
  try {
    const config = localStorage.getItem(`${STORAGE_PREFIX}${CONFIG_KEY}`)
    return config ? JSON.parse(config) : null
  } catch (error) {
    console.error("[app] Error loading config:", error)
    return null
  }
}

/**
 * Save app configuration
 */
export function saveAppConfig(config: AppConfig): void {
  localStorage.setItem(`${STORAGE_PREFIX}${CONFIG_KEY}`, JSON.stringify(config))
}

/**
 * Clean up expired profiles
 */
export function cleanupExpiredProfiles(): void {
  const now = Date.now()
  const cleanupDoneToday = localStorage.getItem(`${STORAGE_PREFIX}${CLEANUP_KEY}`)

  // Only run cleanup once per day
  if (cleanupDoneToday) {
    const lastCleanup = JSON.parse(cleanupDoneToday).timestamp
    if (now - lastCleanup < 24 * 60 * 60 * 1000) {
      return
    }
  }

  const keys = Object.keys(localStorage)
  keys.forEach((key) => {
    if (key.startsWith(`${STORAGE_PREFIX}${USER_PREFIX}`)) {
      try {
        const data = localStorage.getItem(key)
        if (data) {
          const profile = JSON.parse(data) as UserProfile
          if (profile.expiresAt < now) {
            deleteUserProfile(profile.userId)
          }
        }
      } catch (error) {
        console.error("[app] Error during cleanup:", error)
      }
    }
  })

  // Mark cleanup as done
  localStorage.setItem(`${STORAGE_PREFIX}${CLEANUP_KEY}`, JSON.stringify({ timestamp: now }))
}

/**
 * Clear all data
 */
export function clearAllData(): void {
  const keys = Object.keys(localStorage)
  keys.forEach((key) => {
    if (key.startsWith(STORAGE_PREFIX)) {
      localStorage.removeItem(key)
    }
  })
}
