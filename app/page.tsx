"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  Menu,
  Send,
  Plus,
  Settings,
  Copy,
  Check,
  Trash2,
  LogOut,
  Sun,
  Moon,
  X,
  Loader2,
  ChevronDown,
} from "lucide-react"
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
  cleanupExpiredProfiles,
  saveAppConfig,
  getAppConfig,
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
  const [userId, setUserId] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [currentSession, setCurrentSession] = useState<UserSession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("dark")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showConsent, setShowConsent] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showModelsDropdown, setShowModelsDropdown] = useState(false)
  const [selectedModel, setSelectedModel] = useState("")
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([])
  const [personalContext, setPersonalContext] = useState("")
  const [profileContextEdit, setProfileContextEdit] = useState("")
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [savedMessage, setSavedMessage] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load models on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        const cachedConfig = getAppConfig()
        if (cachedConfig?.models.length) {
          setModels(cachedConfig.models)
          if (!selectedModel && cachedConfig.models.length > 0) {
            setSelectedModel(cachedConfig.models[0].id)
          }
          return
        }

        const response = await fetch("https://z.missionbarisal.site/v1/models")
        if (response.ok) {
          const data = await response.json()
          const modelList = data.data.map((m: any) => ({
            id: m.id,
            name: m.id.split(":")[0].replace("-", " ").toUpperCase(),
          }))
          setModels(modelList)
          saveAppConfig({ apiUrl: "https://z.missionbarisal.site/v1", models: modelList })
          if (!selectedModel && modelList.length > 0) {
            setSelectedModel(modelList[0].id)
          }
        }
      } catch (error) {
        console.error("[app] Failed to load models:", error)
      }
    }

    loadModels()
    cleanupExpiredProfiles()
  }, [selectedModel])

  // Initialize user
  useEffect(() => {
    const initializeUser = () => {
      const existingUserId = getCurrentUserId()

      if (existingUserId) {
        const profile = getUserProfile(existingUserId)
        if (profile) {
          setUserId(existingUserId)
          setUserProfile(profile)
          setPersonalContext(profile.personalContext)
          setProfileContextEdit(profile.personalContext)
          loadUserSessions(existingUserId)
          return
        }
      }

      if (!hasConsentBeenShown()) {
        setShowConsent(true)
      }
    }

    initializeUser()
  }, [])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const loadUserSessions = (userIdToLoad: string) => {
    const userSessions = getUserSessions(userIdToLoad)
    setSessions(userSessions)
    if (userSessions.length > 0) {
      setCurrentSession(userSessions[0])
      setMessages(
        userSessions[0].messages.map((msg) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }))
      )
    }
  }

  const handleConsent = () => {
    const profile = createUserProfile("")
    setUserId(profile.userId)
    setUserProfile(profile)
    setPersonalContext("")
    setProfileContextEdit("")
    setShowConsent(false)
    setSessions([])
    setMessages([])
    setCurrentSession(null)
  }

  const handleNewChat = () => {
    if (!userId) return
    const newSession = createUserSession(userId, "New Chat")
    setCurrentSession(newSession)
    setMessages([])
    setSessions([newSession, ...sessions])
    setSidebarOpen(false)
  }

  const handleSelectSession = (session: UserSession) => {
    setCurrentSession(session)
    setMessages(
      session.messages.map((msg) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }))
    )
    setSidebarOpen(false)
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
    setShowConsent(true)
  }

  const handleSaveProfile = () => {
    if (!userId) return
    setIsSavingProfile(true)
    const updated = updateUserProfile(userId, profileContextEdit)
    if (updated) {
      setUserProfile(updated)
      setPersonalContext(updated.personalContext)
      setSavedMessage(true)
      setTimeout(() => setSavedMessage(false), 2000)
    }
    setIsSavingProfile(false)
  }

  const handleStreamingResponse = async (messageId: string, userInput: string) => {
    if (!userId || !currentSession) return

    try {
      const response = await fetch("https://z.missionbarisal.site/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: "user",
              content:
                personalContext.trim() && personalContext.trim() !== ""
                  ? `[Context: ${personalContext}]\n\n${userInput}`
                  : userInput,
            },
          ],
          stream: true,
        }),
      })

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
          if (!line.trim() || !line.startsWith("data:")) continue
          try {
            const jsonStr = line.substring(5).trim()
            if (jsonStr === "[DONE]") break
            const data = JSON.parse(jsonStr)
            const content = data.choices?.[0]?.delta?.content || ""
            if (content) {
              fullContent += content
              setMessages((prev) =>
                prev.map((msg) => (msg.id === messageId ? { ...msg, content: fullContent } : msg))
              )
            }
          } catch (error) {
            // Ignore parse errors
          }
        }
      }

      // Save session
      if (currentSession && userId) {
        const updatedMessages = [...messages]
        const msgIndex = updatedMessages.findIndex((m) => m.id === messageId)
        if (msgIndex !== -1) {
          updatedMessages[msgIndex].content = fullContent
        }
        updateUserSession(userId, currentSession.sessionId, { messages: updatedMessages })
      }
    } catch (error) {
      console.error("[app] Streaming error:", error)
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

    updateUserSession(userId, currentSession.sessionId, { messages: newMessages })
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

  const bgClass = theme === "dark" ? "bg-slate-950 text-white" : "bg-white text-slate-900"
  const cardClass = theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"
  const textMutedClass = theme === "dark" ? "text-slate-400" : "text-slate-500"

  return (
    <div className={`flex h-screen w-full overflow-hidden ${bgClass}`}>
      {/* Sidebar */}
      <div
        className={`fixed md:relative z-40 h-full w-64 md:w-64 md:flex flex-col transition-all duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${cardClass} border-r`}
      >
        <div className="p-3 sm:p-4 space-y-2">
          <Button
            onClick={handleNewChat}
            disabled={!userId}
            className="w-full justify-start text-sm h-9 bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 sm:px-3 space-y-1">
          {sessions.length === 0 ? (
            <div className={`text-xs ${textMutedClass} p-2 text-center`}>No conversations yet</div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.sessionId}
                className={`group flex items-center gap-2 p-2 rounded cursor-pointer text-sm transition-colors ${
                  currentSession?.sessionId === session.sessionId
                    ? theme === "dark"
                      ? "bg-slate-800"
                      : "bg-slate-100"
                    : theme === "dark"
                      ? "hover:bg-slate-800"
                      : "hover:bg-slate-100"
                }`}
                onClick={() => handleSelectSession(session)}
              >
                <div className="flex-1 truncate">{session.title}</div>
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
            ))
          )}
        </div>

        <div className={`p-3 border-t ${theme === "dark" ? "border-slate-800" : "border-slate-200"} space-y-2`}>
          <Button
            onClick={() => {
              setShowProfile(true)
              setSidebarOpen(false)
            }}
            disabled={!userId}
            variant="outline"
            className="w-full justify-start h-9 text-sm"
          >
            <Settings className="w-4 h-4 mr-2" />
            Profile
          </Button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Chat */}
      <div className="flex-1 flex flex-col w-full md:w-auto">
        {/* Header */}
        <div className={`flex items-center justify-between p-3 sm:p-4 border-b ${cardClass}`}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 hover:bg-slate-700/20 rounded"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex-1 flex items-center justify-center md:justify-start">
            <div className="relative">
              <button
                onClick={() => setShowModelsDropdown(!showModelsDropdown)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded border transition-colors ${
                  theme === "dark"
                    ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
                    : "bg-white border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="max-w-[120px] sm:max-w-[180px] truncate text-xs sm:text-sm">
                  {models.find((m) => m.id === selectedModel)?.name || "Select Model"}
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showModelsDropdown && (
                <div
                  className={`absolute top-full left-0 mt-1 w-48 sm:w-64 rounded border shadow-lg z-50 max-h-64 overflow-y-auto ${cardClass}`}
                >
                  {models.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id)
                        setShowModelsDropdown(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700/20 transition-colors ${
                        selectedModel === model.id ? "bg-blue-600/20" : ""
                      }`}
                    >
                      {model.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 hover:bg-slate-700/20 rounded"
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setShowProfile(true)}
              className="p-2 hover:bg-slate-700/20 rounded"
            >
              <span className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
                {userId?.substring(5, 6)}
              </span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${cardClass}`}>
                <span className="text-xl">💬</span>
              </div>
              <h2 className="text-lg sm:text-2xl font-bold mb-1 sm:mb-2">Start a Conversation</h2>
              <p className={`text-xs sm:text-sm ${textMutedClass}`}>
                Select a model and ask me anything.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs sm:max-w-md lg:max-w-lg px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : theme === "dark"
                        ? "bg-slate-800 text-slate-100"
                        : "bg-slate-100 text-slate-900"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content || "Generating..."}</p>
                  {msg.role === "assistant" && msg.content && (
                    <button
                      onClick={() => handleCopyMessage(msg.content, msg.id)}
                      className="mt-2 text-xs opacity-70 hover:opacity-100 flex items-center gap-1"
                    >
                      {msg.copying ? (
                        <>
                          <Check className="w-3 h-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
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
        <div className={`p-3 sm:p-4 border-t ${cardClass}`}>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              disabled={isLoading || !currentSession}
              className="flex-1 text-sm"
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading || !currentSession}
              className="bg-blue-600 hover:bg-blue-700 px-2 sm:px-4"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Consent Modal */}
      {showConsent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className={`w-full max-w-sm ${cardClass} p-6 space-y-4`}>
            <h2 className="text-lg sm:text-xl font-bold">Welcome</h2>
            <p className={`text-sm ${textMutedClass}`}>
              This chat stores your conversations locally. An anonymous user ID will be generated
              for this session. No login required.
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className={`w-full max-w-sm ${cardClass} p-4 sm:p-6 space-y-4 max-h-96 overflow-y-auto`}>
            <div className="flex justify-between items-center">
              <h2 className="text-lg sm:text-xl font-bold">Profile & Settings</h2>
              <button
                onClick={() => setShowProfile(false)}
                className="p-1 hover:bg-slate-700/20 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {userId && (
              <>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold mb-2">User ID</label>
                  <div className={`p-2 rounded text-xs font-mono break-all ${cardClass}`}>
                    {userId}
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold mb-2">Personal Context</label>
                  <textarea
                    value={profileContextEdit}
                    onChange={(e) => setProfileContextEdit(e.target.value)}
                    placeholder="Add your preferences or instructions..."
                    className={`w-full h-20 px-3 py-2 text-xs sm:text-sm rounded border transition-colors resize-none ${
                      theme === "dark"
                        ? "bg-slate-800 border-slate-700"
                        : "bg-white border-slate-300"
                    }`}
                  />
                  <p className={`text-xs mt-1 ${textMutedClass}`}>
                    This will be added to your messages to personalize responses.
                  </p>
                </div>

                {savedMessage && (
                  <div className="bg-green-600/20 border border-green-600/50 text-green-600 px-3 py-2 rounded text-xs">
                    Saved successfully
                  </div>
                )}

                <div className="space-y-2">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-sm h-9"
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Context"
                    )}
                  </Button>

                  <Button
                    onClick={handleDeleteAllSessions}
                    variant="outline"
                    className="w-full justify-start h-9 text-xs sm:text-sm text-red-500 border-red-500/20 hover:bg-red-600/10"
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Delete All Conversations
                  </Button>

                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="w-full justify-start h-9 text-xs sm:text-sm text-red-500 border-red-500/20 hover:bg-red-600/10"
                  >
                    <LogOut className="w-3 h-3 mr-2" />
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
