"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  Mic,
  Volume2,
  VolumeX,
  Send,
  Moon,
  Sun,
  Plus,
  Trash2,
  Menu,
  X,
  ImagePlus,
  Loader,
  ChevronDown,
  LogOut,
  Settings,
  User,
  BookOpen,
} from "lucide-react"
import { useTheme } from "next-themes"
import Link from "next/link"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  image?: string
  thinking?: string
  isStreaming?: boolean
}

interface ChatSession {
  id: string
  title: string
  messages: Message[]
  modelId: string
  createdAt: Date
  updatedAt: Date
}

export default function ChatInterface() {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)
  const [synthesis, setSynthesis] = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [availableModels, setAvailableModels] = useState<any[]>([])
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { theme, setTheme } = useTheme()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const currentSession = chatSessions.find((session) => session.id === currentSessionId)
  const messages = currentSession?.messages || []

  // Load sessions from localStorage on mount
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const stored = localStorage.getItem("chat_sessions")
        if (stored) {
          const sessions = JSON.parse(stored)
          setChatSessions(sessions)
          if (sessions.length > 0) {
            setCurrentSessionId(sessions[0].id)
          }
        }

        // Fetch available models
        const modelsRes = await fetch("/api/models")
        const modelsData = await modelsRes.json()
        if (modelsData.success && modelsData.models.length > 0) {
          setAvailableModels(modelsData.models)
          setSelectedModel(modelsData.models[0].id || modelsData.models[0])
        }
      } catch (error) {
        console.error("[v0] Error loading sessions or models:", error)
      }

      if (chatSessions.length === 0) {
        createNewChat()
      }
    }

    loadSessions()
  }, [])

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (chatSessions.length > 0) {
      localStorage.setItem("chat_sessions", JSON.stringify(chatSessions))
    }
  }, [chatSessions])

  // Scroll to bottom when messages update
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
    }, 0)
  }

  const createNewChat = () => {
    const newId = `session_${Date.now()}`
    const newSession: ChatSession = {
      id: newId,
      title: "New Chat",
      messages: [],
      modelId: selectedModel || "gpt-4",
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setChatSessions((prev) => [newSession, ...prev])
    setCurrentSessionId(newId)
  }

  const deleteSession = (sessionId: string) => {
    setChatSessions((prev) => prev.filter((s) => s.id !== sessionId))
    if (currentSessionId === sessionId) {
      const remaining = chatSessions.filter((s) => s.id !== sessionId)
      if (remaining.length > 0) {
        setCurrentSessionId(remaining[0].id)
      } else {
        createNewChat()
      }
    }
  }

  const startListening = () => {
    if (recognition) {
      setIsListening(true)
      recognition.start()
    }
  }

  const stopListening = () => {
    if (recognition) {
      setIsListening(false)
      recognition.stop()
    }
  }

  const speakMessage = (text: string) => {
    if (!synthesis) return

    window.speechSynthesis.cancel()

    const isBengali = /[\u0980-\u09FF]/.test(text)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = isBengali ? "bn-BD" : "en-US"
    utterance.rate = 0.95

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)

    synthesis.speak(utterance)
  }

  const stopSpeaking = () => {
    if (synthesis) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }

  const generateChatTitle = (firstMessage: string) => {
    return firstMessage.slice(0, 50).trim() + (firstMessage.length > 50 ? "..." : "")
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setSelectedImage(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleStreamingResponse = async (messageId: string, userInput: string, model: string) => {
    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userInput,
          model: model,
          sessionId: currentSessionId,
        }),
      })

      if (!response.body) {
        console.error("[v0] No response body from streaming API")
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ""
      let thinkingContent = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === "thinking" && data.thinking) {
                thinkingContent = data.thinking
              } else if (data.type === "content" && data.content) {
                fullContent += data.content

                setChatSessions((prev) =>
                  prev.map((session) => {
                    if (session.id === currentSessionId) {
                      return {
                        ...session,
                        messages: session.messages.map((msg) =>
                          msg.id === messageId
                            ? {
                                ...msg,
                                content: fullContent,
                                thinking: thinkingContent,
                                isStreaming: true,
                              }
                            : msg
                        ),
                      }
                    }
                    return session
                  })
                )
              }
            } catch (e) {
              // Ignore parsing errors for non-JSON lines
            }
          }
        }
      }

      // Mark streaming as complete
      setChatSessions((prev) =>
        prev.map((session) => {
          if (session.id === currentSessionId) {
            return {
              ...session,
              messages: session.messages.map((msg) =>
                msg.id === messageId ? { ...msg, isStreaming: false } : msg
              ),
            }
          }
          return session
        })
      )
    } catch (error) {
      console.error("[v0] Streaming error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !currentSessionId) return

    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      content: input.trim(),
      role: "user",
      timestamp: new Date(),
      image: selectedImage || undefined,
    }

    // Update session with user message
    setChatSessions((prev) =>
      prev.map((session) => {
        if (session.id === currentSessionId) {
          const updatedMessages = [...session.messages, userMessage]
          return {
            ...session,
            messages: updatedMessages,
            title:
              session.messages.length === 0
                ? generateChatTitle(userMessage.content)
                : session.title,
            updatedAt: new Date(),
            modelId: selectedModel,
          }
        }
        return session
      })
    )

    setInput("")
    setSelectedImage(null)
    setIsLoading(true)

    // Add user message
    setChatSessions((prev) =>
      prev.map((session) => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: [...session.messages, userMessage],
            title: session.messages.length === 0 ? userMessage.content.slice(0, 30) : session.title,
            updatedAt: new Date(),
          }
        }
        return session
      })
    )

    // Create streaming assistant message placeholder
    const assistantMessageId = `msg_${Date.now()}_assistant`
    setInput("")
    setSelectedImage(null)
    setIsLoading(true)

    // Add user message
    setChatSessions((prev) =>
      prev.map((session) => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: [...session.messages, userMessage],
            title: session.messages.length === 0 ? userMessage.content.slice(0, 30) : session.title,
            updatedAt: new Date(),
          }
        }
        return session
      })
    )

    // Create streaming assistant message placeholder
    const assistantMessagePlaceholder: Message = {
      id: assistantMessageId,
      content: "",
      role: "assistant",
      timestamp: new Date(),
      isStreaming: true,
    }

    setChatSessions((prev) =>
      prev.map((session) => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: [...session.messages, assistantMessagePlaceholder],
          }
        }
        return session
      })
    )

    // Start streaming response
    handleStreamingResponse(assistantMessageId, userMessage.content, selectedModel || "gpt-4")
  }

  useEffect(() => {
    // Initialize speech recognition
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
      const recognitionInstance = new SpeechRecognition()
      recognitionInstance.continuous = false
      recognitionInstance.interimResults = false
      recognitionInstance.lang = "en-US"

      recognitionInstance.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setInput((prev) => prev + (prev ? " " : "") + transcript)
        setIsListening(false)
      }

      recognitionInstance.onerror = () => {
        setIsListening(false)
      }

      recognitionInstance.onend = () => {
        setIsListening(false)
      }

      setRecognition(recognitionInstance)
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setSynthesis(window.speechSynthesis)
    }
  }, [])

  return (
    <div className="h-screen flex bg-slate-950">
      {/* Sidebar */}
      <div
        className={`fixed lg:static inset-0 w-64 bg-slate-900 border-r border-slate-700 flex flex-col transition-transform z-40 lg:z-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h1 className="text-white font-bold text-sm">Chat History</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-300 hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* New Chat Button */}
        <div className="p-4 border-b border-slate-700">
          <Button
            onClick={createNewChat}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white justify-start gap-2"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {chatSessions.map((session) => (
            <div
              key={session.id}
              className={`p-3 rounded-lg cursor-pointer group transition-colors ${
                session.id === currentSessionId
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:bg-slate-800"
              }`}
              onClick={() => {
                setCurrentSessionId(session.id)
                setSidebarOpen(false)
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{session.title}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(session.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteSession(session.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-slate-700 p-4 space-y-2">
          <Link href="/admin" className="w-full">
            <Button variant="outline" className="w-full border-slate-600 text-slate-300 justify-start gap-2">
              <BookOpen className="h-4 w-4" />
              Admin Panel
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen">
        {/* Header */}
        <header className="border-b border-slate-700 p-4 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-300 hover:text-white"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-white font-semibold">Chat Assistant</h2>
              <p className="text-slate-400 text-xs">Bengali & English Support</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Model Selector */}
            <div className="relative">
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-800 gap-2"
                onClick={() => setShowModelDropdown(!showModelDropdown)}
              >
                {availableModels.find((m) => m.id === selectedModel)?.id || selectedModel || "Select Model"}
                <ChevronDown className="h-4 w-4" />
              </Button>

              {showModelDropdown && availableModels.length > 0 && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded shadow-lg z-50">
                  {availableModels.slice(0, 5).map((model: any) => (
                    <button
                      key={model.id || model}
                      className={`w-full text-left px-4 py-2 border-b border-slate-700 last:border-b-0 hover:bg-slate-700 transition-colors text-sm ${
                        selectedModel === model.id ? "bg-slate-700 text-blue-400" : "text-slate-300"
                      }`}
                      onClick={() => {
                        setSelectedModel(model.id || model)
                        setShowModelDropdown(false)
                      }}
                    >
                      {model.id || model}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="text-slate-300 hover:text-white"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            {/* User Menu */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="text-slate-300 hover:text-white"
              >
                <User className="h-5 w-5" />
              </Button>

              {showUserMenu && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded shadow-lg z-50">
                  <button className="w-full text-left px-4 py-2 border-b border-slate-700 hover:bg-slate-700 flex items-center gap-2 text-slate-300 text-sm">
                    <User className="h-4 w-4" />
                    Profile
                  </button>
                  <button className="w-full text-left px-4 py-2 border-b border-slate-700 hover:bg-slate-700 flex items-center gap-2 text-slate-300 text-sm">
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                  <button className="w-full text-left px-4 py-2 hover:bg-slate-700 flex items-center gap-2 text-red-400 text-sm">
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-2xl font-bold text-slate-200 mb-2">Start a Conversation</h2>
              <p className="text-slate-400 max-w-sm">
                Select a model and ask me anything. I support Bengali and English languages.
              </p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-xs">AI</span>
                    </div>
                  )}

                  <div
                    className={`flex flex-col gap-2 max-w-[80%] sm:max-w-[70%] ${
                      message.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    {message.image && (
                      <div className="rounded-lg overflow-hidden">
                        <img src={message.image} alt="Uploaded" className="max-w-xs h-auto" />
                      </div>
                    )}

                    <Card
                      className={`px-4 py-3 rounded-lg ${
                        message.role === "user"
                          ? "bg-blue-600 text-white border-0"
                          : "bg-slate-800 text-slate-100 border-slate-700"
                      }`}
                    >
                      {message.thinking && (
                        <details className="mb-2 pb-2 border-b border-slate-700">
                          <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-300 font-medium">
                            💭 Thinking Process
                          </summary>
                          <p className="text-xs text-slate-500 mt-2 italic whitespace-pre-wrap">{message.thinking}</p>
                        </details>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content || (message.isStreaming ? "Generating response..." : "")}
                      </p>
                      {message.isStreaming && (
                        <span className="inline-block ml-1 h-4 w-1 bg-slate-400 animate-pulse" />
                      )}
                    </Card>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {message.role === "assistant" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1 text-slate-500 hover:text-slate-300"
                          onClick={() => (isSpeaking ? stopSpeaking() : speakMessage(message.content))}
                        >
                          {isSpeaking ? (
                            <VolumeX className="h-3 w-3" />
                          ) : (
                            <Volume2 className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {message.role === "user" && (
                    <div className="w-8 h-8 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-xs">You</span>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-700 bg-slate-900 p-4">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-2">
            {selectedImage && (
              <div className="flex gap-2 items-center px-3 py-2 bg-slate-800 rounded">
                <img src={selectedImage} alt="Selected" className="h-10 w-10 rounded object-cover" />
                <span className="text-sm text-slate-300 flex-1">Image selected</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedImage(null)}
                  className="h-6 px-2"
                >
                  Remove
                </Button>
              </div>
            )}

            <div className="flex gap-2 items-end">
              <div className="flex-1 relative flex items-center">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me anything..."
                  disabled={isLoading}
                  className="px-4 py-3 pr-20 text-sm bg-slate-800 border-slate-700 text-white placeholder-slate-500 rounded-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && input.trim()) {
                      e.preventDefault()
                      handleSubmit(e as any)
                    }
                  }}
                />

                <div className="absolute right-1 flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isLoading}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-slate-200"
                  >
                    <ImagePlus className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={isListening ? stopListening : startListening}
                    disabled={isLoading}
                    className={`h-8 w-8 p-0 ${
                      isListening ? "bg-red-500/20 text-red-400" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="h-10 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-none"
              >
                {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>

            <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />

            <div className="text-xs text-slate-500 px-1">
              {isListening ? <span className="text-blue-400 animate-pulse">Listening...</span> : <span>Shift + Enter for new line</span>}
            </div>
          </form>
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
