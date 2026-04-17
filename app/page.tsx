"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Mic, Volume2, VolumeX, Send, Moon, Sun, Plus, MessageSquare, Trash2, Menu, X, ImagePlus, Loader, ChevronDown, LogOut, Settings, User } from "lucide-react"
import { useTheme } from "next-themes"
import Image from "next/image"
import type { SpeechRecognition, SpeechSynthesis } from "web-speech-api"

const AI_MODELS = [
  { id: "gpt-4", name: "GPT-4", description: "Most capable" },
  { id: "gpt-3.5", name: "GPT-3.5", description: "Fast and efficient" },
  { id: "claude", name: "Claude", description: "Thoughtful responses" },
]

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  image?: string
}

interface ChatSession {
  id: string
  title: string
  messages: Message[]
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
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null)
  const [synthesis, setSynthesis] = useState<SpeechSynthesis | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState("gpt-4")
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { theme, setTheme } = useTheme()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const currentSession = chatSessions.find((session) => session.id === currentSessionId)
  const messages = currentSession?.messages || []

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

  useEffect(() => {
    // Initialize speech recognition
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
      const recognitionInstance = new SpeechRecognition()
      recognitionInstance.continuous = false
      recognitionInstance.interimResults = false
      recognitionInstance.lang = "en-US"

      recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setInput((prev) => prev + " " + transcript)
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

    if (chatSessions.length === 0) {
      createNewChat()
    }

    scrollToBottom()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
      }, 0)
    }
  }

  const createNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setChatSessions((prev) => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
    setSidebarOpen(false)
  }

  const switchToChat = (sessionId: string) => {
    setCurrentSessionId(sessionId)
    setSidebarOpen(false)
  }

  const deleteChat = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setChatSessions((prev) => prev.filter((session) => session.id !== sessionId))
    if (currentSessionId === sessionId) {
      const remainingSessions = chatSessions.filter((session) => session.id !== sessionId)
      if (remainingSessions.length > 0) {
        setCurrentSessionId(remainingSessions[0].id)
      } else {
        createNewChat()
      }
    }
  }

  const generateChatTitle = (firstMessage: string): string => {
    return firstMessage.length > 30 ? firstMessage.substring(0, 30) + "..." : firstMessage
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !currentSessionId) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      role: "user",
      timestamp: new Date(),
      image: selectedImage || undefined,
    }

    setChatSessions((prev) =>
      prev.map((session) => {
        if (session.id === currentSessionId) {
          const updatedMessages = [...session.messages, userMessage]
          return {
            ...session,
            messages: updatedMessages,
            title: session.messages.length === 0 ? generateChatTitle(userMessage.content) : session.title,
            updatedAt: new Date(),
          }
        }
        return session
      }),
    )

    setInput("")
    setSelectedImage(null)
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          image: selectedImage,
          history: messages,
        }),
      })

      if (!response.ok) throw new Error("Failed to get response")

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        role: "assistant",
        timestamp: new Date(),
      }

      setChatSessions((prev) =>
        prev.map((session) => {
          if (session.id === currentSessionId) {
            return {
              ...session,
              messages: [...session.messages, assistantMessage],
              updatedAt: new Date(),
            }
          }
          return session
        }),
      )
    } catch (error) {
      console.error("Chat error:", error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, an error occurred. Please try again.",
        role: "assistant",
        timestamp: new Date(),
      }
      setChatSessions((prev) =>
        prev.map((session) => {
          if (session.id === currentSessionId) {
            return {
              ...session,
              messages: [...session.messages, errorMessage],
              updatedAt: new Date(),
            }
          }
          return session
        }),
      )
    } finally {
      setIsLoading(false)
    }
  }

  const startListening = () => {
    if (recognition && !isListening) {
      setIsListening(true)
      recognition.start()
    }
  }

  const stopListening = () => {
    if (recognition && isListening) {
      recognition.stop()
      setIsListening(false)
    }
  }

  const speakMessage = (text: string) => {
    if (synthesis && !isSpeaking) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = text.match(/[\u0980-\u09FF]/) ? "bn-BD" : "en-US"
      utterance.rate = 0.9
      utterance.pitch = 1

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)

      synthesis.speak(utterance)
    }
  }

  const stopSpeaking = () => {
    if (synthesis && isSpeaking) {
      synthesis.cancel()
      setIsSpeaking(false)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <div
        className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 w-80 bg-card border-r border-border transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Chat History</h2>
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <Button onClick={createNewChat} className="w-full mt-3 justify-start bg-transparent" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>

          {/* Chat Sessions List */}
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-2">
              {chatSessions.map((session) => (
                <div
                  key={session.id}
                  className={`group flex items-center gap-2 p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors ${
                    currentSessionId === session.id ? "bg-muted" : ""
                  }`}
                  onClick={() => switchToChat(session.id)}
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{session.title}</p>
                    <p className="text-xs text-muted-foreground">{session.updatedAt.toLocaleDateString()}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                    onClick={(e) => deleteChat(session.id, e)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="border-b border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="relative">
            <Button
              variant="outline"
              className="flex items-center gap-2 rounded-none border-gray-300"
              onClick={() => setShowModelDropdown(!showModelDropdown)}
            >
              {AI_MODELS.find(m => m.id === selectedModel)?.name}
              <ChevronDown className="h-4 w-4" />
            </Button>
            
            {showModelDropdown && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-300 rounded-none shadow-lg z-50">
                {AI_MODELS.map(model => (
                  <button
                    key={model.id}
                    className={`w-full text-left px-4 py-3 border-b border-gray-200 last:border-b-0 hover:bg-gray-100 transition-colors ${
                      selectedModel === model.id ? "bg-gray-100" : ""
                    }`}
                    onClick={() => {
                      setSelectedModel(model.id)
                      setShowModelDropdown(false)
                    }}
                  >
                    <div className="font-medium">{model.name}</div>
                    <div className="text-xs text-gray-600">{model.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <User className="h-5 w-5" />
              </Button>
              
              {showUserMenu && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-300 rounded-none shadow-lg z-50">
                  <button className="w-full text-left px-4 py-3 border-b border-gray-200 hover:bg-gray-100 flex items-center gap-2 transition-colors">
                    <User className="h-4 w-4" />
                    Profile
                  </button>
                  <button className="w-full text-left px-4 py-3 border-b border-gray-200 hover:bg-gray-100 flex items-center gap-2 transition-colors">
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                  <button className="w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center gap-2 text-red-600 transition-colors">
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Chat Messages */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div ref={scrollAreaRef} className="p-4 space-y-4 max-w-4xl mx-auto">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">💬</span>
                </div>
                <h2 className="text-xl font-semibold mb-2">Welcome!</h2>
                <p className="text-muted-foreground">I'm your Bengali & English AI assistant. Ask me anything!</p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2`}
              >
                {message.role === "assistant" && (
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                    <span className="text-white font-bold text-sm">AI</span>
                  </div>
                )}

                <div
                  className={`flex flex-col gap-3 max-w-[85%] sm:max-w-[70%] ${message.role === "user" ? "items-end" : "items-start"}`}
                >
                  {message.image && (
                    <div className="rounded-xl overflow-hidden shadow-md border border-border">
                      <img src={message.image} alt="Uploaded image" className="max-w-xs h-auto" />
                    </div>
                  )}
                  <Card
                    className={`px-5 py-3 rounded-2xl shadow-sm transition-all ${
                      message.role === "user"
                        ? "bg-blue-600 text-white rounded-br-none"
                        : "bg-muted text-foreground rounded-bl-none border border-border"
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
                  </Card>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                    <span>{message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    {message.role === "assistant" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1 text-muted-foreground hover:text-foreground"
                        onClick={() => (isSpeaking ? stopSpeaking() : speakMessage(message.content))}
                      >
                        {isSpeaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                      </Button>
                    )}
                  </div>
                </div>

                {message.role === "user" && (
                  <div className="w-10 h-10 bg-gradient-to-br from-slate-300 to-slate-400 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                    <span className="text-sm font-semibold text-slate-700">You</span>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-primary-foreground font-bold text-xs">AI</span>
                </div>
                <Card className="p-4 bg-card">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                    <span className="text-sm text-muted-foreground">Typing...</span>
                  </div>
                </Card>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t border-border bg-background p-3 sm:p-4">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-2">
            {selectedImage && (
              <div className="flex gap-2 items-center px-3 py-2 bg-muted rounded-lg">
                <img src={selectedImage} alt="Selected" className="h-12 w-12 rounded-md object-cover" />
                <span className="text-sm text-muted-foreground flex-1">Image selected</span>
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
                  className="px-4 py-3 pr-20 text-sm border border-gray-300 focus:border-gray-500 focus:outline-none transition-colors rounded-none"
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
                    className="h-8 w-8 p-0 hover:bg-gray-200"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isLoading}
                    title="Upload image"
                  >
                    <ImagePlus className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`h-8 w-8 p-0 transition-colors ${
                      isListening ? "bg-red-100 text-red-600" : "hover:bg-gray-200"
                    }`}
                    onClick={isListening ? stopListening : startListening}
                    disabled={isLoading}
                    title={isListening ? "Stop listening" : "Start listening"}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="h-10 px-3 bg-gray-700 hover:bg-gray-800 text-white transition-all rounded-none"
              >
                {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />

            <div className="text-xs text-muted-foreground px-3">
              {isListening ? (
                <span className="text-blue-600 font-medium animate-pulse">Listening...</span>
              ) : (
                <span>Shift + Enter for new line</span>
              )}
            </div>
          </form>
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}
