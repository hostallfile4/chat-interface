"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Menu, Send, Plus, Settings, Copy, Check, Trash2, LogOut, Sun, Moon, Mic, Loader } from "lucide-react"
import {
  createUserProfile,
  getUserProfile,
  getUserSessions,
  createUserSession,
  updateUserSession,
  deleteUserSession,
  deleteUserProfile,
  updateUserProfile,
  getCurrentUserId,
  setCurrentUserId,
  clearCurrentUserId,
  hasConsentBeenShown,
  type UserProfile,
  type UserSession,
} from "@/lib/user-manager"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  copying?: boolean
}

export default function Home() {
  // User Management
  const [userId, setUserId] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [showConsent, setShowConsent] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [personalContext, setPersonalContext] = useState("")

  // Chat State
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [currentSession, setCurrentSession] = useState<UserSession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("dark")

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedModel, setSelectedModel] = useState("gpt-4")
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([])
  const [isListening, setIsListening] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Initialize user on mount
  useEffect(() => {
    const initializeUser = () => {
      const existingUserId = getCurrentUserId()

      if (existingUserId) {
        const profile = getUserProfile(existingUserId)
        if (profile) {
          setUserId(existingUserId)
          setUserProfile(profile)
          setPersonalContext(profile.personalContext)
          loadUserSessions(existingUserId)
          return
        }
      }

      // Check if consent was shown
      if (!hasConsentBeenShown()) {
        setShowConsent(true)
      } else {
        createNewUser()
      }
    }

    initializeUser()
  }, [])

  const createNewUser = () => {
    const profile = createUserProfile("")
    setUserId(profile.userId)
    setUserProfile(profile)
    setCurrentUserId(profile.userId)
    setSessions([])
    setShowConsent(false)
  }

  const loadUserSessions = (userIdToLoad: string) => {
    const userSessions = getUserSessions(userIdToLoad)
    setSessions(userSessions)
    if (userSessions.length > 0) {
      setCurrentSession(userSessions[0])
      setMessages(
        userSessions[0].messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }))
      )
    }
  }

  const handleConsent = () => {
    createNewUser()
  }

  const handleNewChat = () => {
    if (!userId) return

    const newSession = createUserSession(userId, "New Chat")
    setCurrentSession(newSession)
    setMessages([])
    setSessions([newSession, ...sessions])
  }

  const handleSelectSession = (session: UserSession) => {
    setCurrentSession(session)
    setMessages(
      session.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }))
    )
  }

  const handleDeleteSession = (sessionId: string) => {
    if (!userId) return
    deleteUserSession(userId, sessionId)
    setSessions(sessions.filter((s) => s.sessionId !== sessionId))
    if (currentSession?.sessionId === sessionId) {
      setCurrentSession(null)
      setMessages([])
    }
  }

  const handleDeleteAllSessions = () => {
    if (!userId || !confirm("Delete all conversations?")) return
    sessions.forEach((session) => deleteUserSession(userId, session.sessionId))
    setSessions([])
    setCurrentSession(null)
    setMessages([])
  }

  const handleLogout = () => {
    if (!userId || !confirm("Clear all data and start fresh?")) return
    deleteUserProfile(userId)
    clearCurrentUserId()
    setUserId(null)
    setUserProfile(null)
    setSessions([])
    setCurrentSession(null)
    setMessages([])
    setShowProfile(false)
    if (!hasConsentBeenShown()) {
      setShowConsent(true)
    }
  }

  const handleUpdatePersonalContext = (context: string) => {
    if (!userId) return
    const updated = updateUserProfile(userId, context)
    if (updated) {
      setUserProfile(updated)
      setPersonalContext(context)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleStreamingResponse = async (messageId: string, userInput: string) => {
    if (!userId || !currentSession) return

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userInput,
          model: selectedModel,
          sessionId: currentSession.sessionId,
          userId,
          userContext: personalContext,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, content: `Error: ${error.error || "Failed to get response"}` }
              : msg
          )
        )
        return
      }

      if (!response.body) return

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let fullContent = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const data = JSON.parse(line)
            if (data.type === "content" && data.content) {
              fullContent += data.content
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === messageId ? { ...msg, content: fullContent } : msg
                )
              )
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }

      // Save session
      if (currentSession) {
        const updatedMessages = [...messages]
        const msgIndex = updatedMessages.findIndex((m) => m.id === messageId)
        if (msgIndex !== -1) {
          updatedMessages[msgIndex].content = fullContent
        }
        updateUserSession(userId, currentSession.sessionId, { messages: updatedMessages })
      }
    } catch (error) {
      console.error("[v0] Streaming error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !currentSession || !userId) return

    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      content: input.trim(),
      role: "user",
      timestamp: new Date(),
    }

    const assistantMessage: Message = {
      id: `msg_${Date.now()}_assistant`,
      content: "",
      role: "assistant",
      timestamp: new Date(),
    }

    const newMessages = [...messages, userMessage, assistantMessage]
    setMessages(newMessages)
    setInput("")
    setIsLoading(true)

    // Save to session
    updateUserSession(userId, currentSession.sessionId, { messages: newMessages })

    // Start streaming
    handleStreamingResponse(assistantMessage.id, userMessage.content)
  }

  const handleCopyMessage = async (content: string, messageId: string) => {
    await navigator.clipboard.writeText(content)
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, copying: true } : msg))
    )
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, copying: false } : msg))
      )
    }, 2000)
  }

  return (
    <div className={`flex h-screen ${theme === "dark" ? "bg-slate-950" : "bg-slate-50"}`}>
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } transition-all duration-300 ${theme === "dark" ? "bg-slate-900" : "bg-white"} border-r ${
          theme === "dark" ? "border-slate-800" : "border-slate-200"
        } flex flex-col overflow-hidden`}
      >
        <div className="p-4 space-y-2">
          <Button
            onClick={handleNewChat}
            disabled={!userId}
            className="w-full justify-start text-sm h-9 bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          {sessions.map((session) => (
            <div
              key={session.sessionId}
              className={`group flex items-center gap-2 p-2 rounded cursor-pointer text-sm transition-colors ${
                currentSession?.sessionId === session.sessionId
                  ? theme === "dark" ? "bg-slate-800" : "bg-slate-100"
                  : theme === "dark" ? "hover:bg-slate-800" : "hover:bg-slate-100"
              }`}
              onClick={() => handleSelectSession(session)}
            >
              <div className={`flex-1 truncate ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                {session.title}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteSession(session.sessionId)
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-600/20 rounded"
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </button>
            </div>
          ))}
        </div>

        <div className={`p-3 border-t ${theme === "dark" ? "border-slate-800" : "border-slate-200"} space-y-2`}>
          <Button
            onClick={() => setShowProfile(true)}
            disabled={!userId}
            variant="outline"
            className="w-full justify-start h-9 text-sm"
          >
            <Settings className="w-4 h-4 mr-2" />
            Profile
          </Button>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div
          className={`flex items-center justify-between p-4 border-b ${
            theme === "dark" ? "border-slate-800" : "border-slate-200"
          } ${theme === "dark" ? "bg-slate-900" : "bg-white"}`}
        >
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-700/20 rounded">
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded text-white"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
              <option value="gpt-4">gpt-4</option>
              <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 hover:bg-slate-700/20 rounded"
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={() => setShowProfile(true)} className="p-2 hover:bg-slate-700/20 rounded">
              <span className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
                {userId?.charAt(5)}
              </span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                <span className="text-2xl">💬</span>
              </div>
              <h2 className="text-2xl font-bold mb-2">Start a Conversation</h2>
              <p className="text-slate-400">Select a model and ask me anything.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-md px-4 py-3 rounded-lg ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content || "Generating..."}</p>
                  {msg.role === "assistant" && msg.content && (
                    <button
                      onClick={() => handleCopyMessage(msg.content, msg.id)}
                      className="mt-2 text-xs opacity-70 hover:opacity-100"
                    >
                      {msg.copying ? (
                        <>
                          <Check className="w-3 h-3 inline mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 inline mr-1" />
                          Copy
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-800">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              disabled={isLoading || !currentSession}
              className="flex-1 bg-slate-800 border-slate-700 text-white placeholder-slate-500"
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading || !currentSession}
              className="bg-blue-600 hover:bg-blue-700 px-4"
            >
              {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </div>

      {/* Consent Modal */}
      {showConsent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96 bg-slate-900 border-slate-800 p-6 space-y-4">
            <h2 className="text-xl font-bold">Welcome</h2>
            <p className="text-slate-300">
              This chat stores your conversations locally. An anonymous ID will be generated for this session.
              No login required.
            </p>
            <div className="flex gap-2">
              <Button onClick={handleConsent} className="flex-1 bg-blue-600 hover:bg-blue-700">
                Continue
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96 bg-slate-900 border-slate-800 p-6 space-y-4 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Profile & Settings</h2>
              <button onClick={() => setShowProfile(false)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>

            {userId && (
              <>
                <div>
                  <label className="block text-sm font-semibold mb-2">User ID</label>
                  <div className="bg-slate-800 p-2 rounded text-xs font-mono text-slate-300 break-all">
                    {userId}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Personal Context</label>
                  <textarea
                    value={personalContext}
                    onChange={(e) => handleUpdatePersonalContext(e.target.value)}
                    placeholder="Enter your preferences or instructions..."
                    className="w-full h-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white placeholder-slate-500 resize-none"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    This will be added to your messages to personalize responses.
                  </p>
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={handleDeleteAllSessions}
                    variant="outline"
                    className="w-full justify-start h-9 text-sm text-red-500 border-red-500/20 hover:bg-red-600/10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All Conversations
                  </Button>
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="w-full justify-start h-9 text-sm text-red-500 border-red-500/20 hover:bg-red-600/10"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Clear & Start Fresh
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
