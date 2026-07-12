"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { ArrowLeft, RefreshCw, CheckCircle, AlertCircle, Loader } from "lucide-react"
import Link from "next/link"

interface ConfigData {
  apiUrl: string
  cacheExpiry: string
}

interface ModelData {
  success: boolean
  models: any[]
  source: "cache" | "external"
  expiresAt: string
}

export default function AdminPanel() {
  const [apiUrl, setApiUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [config, setConfig] = useState<ConfigData | null>(null)
  const [models, setModels] = useState<ModelData | null>(null)

  // Fetch current config on mount
  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/admin/config", { method: "GET" })
      const data = await response.json()
      setConfig(data)
      if (data.apiUrl) {
        setApiUrl(data.apiUrl)
      }
    } catch (error) {
      console.error("[v0] Error fetching config:", error)
      setMessage({ type: "error", text: "Failed to fetch configuration" })
    }
  }

  const handleSaveConfig = async () => {
    if (!apiUrl.trim()) {
      setMessage({ type: "error", text: "Please enter an API URL" })
      return
    }

    // Validate URL format
    try {
      new URL(apiUrl.trim())
    } catch (e) {
      setMessage({ type: "error", text: "Invalid URL format. Please enter a valid URL starting with http:// or https://" })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiUrl: apiUrl.trim() }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: "success", text: "✓ Configuration saved successfully!" })
        setConfig({ apiUrl: data.apiUrl, cacheExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
        // Clear models to force re-fetch
        setModels(null)
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save configuration" })
      }
    } catch (error) {
      console.error("[v0] Error saving config:", error)
      setMessage({ type: "error", text: "Error saving configuration: " + String(error) })
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async () => {
    if (!apiUrl.trim()) {
      setMessage({ type: "error", text: "Please save a configuration first" })
      return
    }

    setTestLoading(true)
    try {
      const response = await fetch("/api/models", { method: "GET" })
      const data = await response.json()

      if (data.success) {
        setModels(data)
        const sourceLabel = data.source === "cache" ? "📦 From Cache (24h)" : "🌐 Fresh from API"
        const expiryTime = new Date(data.expiresAt).toLocaleString()
        setMessage({
          type: "success",
          text: `✓ Connected! Found ${data.models.length} models (${sourceLabel}). Cache expires: ${expiryTime}`,
        })
      } else {
        setMessage({ type: "error", text: data.error || "Connection failed" })
      }
    } catch (error) {
      console.error("[v0] Error testing connection:", error)
      setMessage({ type: "error", text: "Connection test failed. Ensure API URL is correct and endpoint is reachable." })
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
            <p className="text-slate-400 text-sm">Configure external API and manage models</p>
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
              message.type === "success"
                ? "bg-green-500/10 border border-green-500/20 text-green-300"
                : "bg-red-500/10 border border-red-500/20 text-red-300"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
            )}
            <span className="text-sm">{message.text}</span>
          </div>
        )}

        {/* Configuration Card */}
        <Card className="bg-slate-800 border-slate-700 p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">External API Configuration</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">API URL</label>
              <Input
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://new.worldbussnessearning.com/v1"
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
              />
              <p className="text-slate-400 text-xs mt-2">
                Enter the base URL of your external API. Models will be fetched from {"{url}"}/models
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSaveConfig}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Configuration"
                )}
              </Button>

              <Button
                onClick={handleTestConnection}
                disabled={testLoading}
                variant="outline"
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                {testLoading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin mr-2" />
                    Testing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Test & Fetch Models
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Models Display Card */}
        {models && (
          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Cached Models</h2>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  models.source === "cache"
                    ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                    : "bg-green-500/20 text-green-300 border border-green-500/30"
                }`}
              >
                {models.source === "cache" ? "From Cache (24h)" : "Fresh from API"}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <p className="text-slate-300 text-sm">
                <span className="font-semibold">{models.models.length}</span> models available
              </p>
              <p className="text-slate-400 text-xs">
                Cache expires: {new Date(models.expiresAt).toLocaleString()}
              </p>
            </div>

            <div className="bg-slate-900 rounded p-3 max-h-48 overflow-y-auto">
              <div className="space-y-2">
                {models.models.slice(0, 10).map((model: any, idx: number) => (
                  <div key={idx} className="text-slate-300 text-sm p-2 bg-slate-800 rounded">
                    <span className="font-mono">{model.id || model.name || `Model ${idx + 1}`}</span>
                  </div>
                ))}
                {models.models.length > 10 && (
                  <div className="text-slate-400 text-xs p-2 text-center">
                    +{models.models.length - 10} more models
                  </div>
                )}
              </div>
            </div>

            <p className="text-slate-400 text-xs mt-4">
              These models will appear in the chat interface dropdown selector
            </p>
          </Card>
        )}

        {/* Info Cards */}
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <Card className="bg-slate-700/50 border-slate-600 p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <span>⚙️ Configuration Steps</span>
            </h3>
            <ol className="text-xs text-slate-400 space-y-2">
              <li className="flex gap-2"><span className="text-blue-400 font-bold">1.</span> Enter your API URL above</li>
              <li className="flex gap-2"><span className="text-blue-400 font-bold">2.</span> Click "Save Configuration"</li>
              <li className="flex gap-2"><span className="text-blue-400 font-bold">3.</span> Click "Test & Fetch Models"</li>
              <li className="flex gap-2"><span className="text-blue-400 font-bold">4.</span> Models appear in chat dropdown</li>
            </ol>
          </Card>

          <Card className="bg-slate-700/50 border-slate-600 p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <span>💾 Caching System</span>
            </h3>
            <div className="text-xs text-slate-400 space-y-2">
              <p className="flex items-center gap-2">
                <span className="text-yellow-400">📦</span> First request: Fetches from API
              </p>
              <p className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Next 24 hours: Uses cached models
              </p>
              <p className="flex items-center gap-2">
                <span className="text-blue-400">🔄</span> After 24 hours: Auto-refreshes cache
              </p>
            </div>
          </Card>
        </div>

        <Card className="bg-slate-700/50 border-slate-600 p-4 mt-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
            <span>📝 API Requirements</span>
          </h3>
          <p className="text-xs text-slate-400 mb-3">Your API endpoint should respond to:</p>
          <div className="bg-slate-900 rounded p-3 text-xs font-mono text-slate-300 overflow-x-auto">
            <div>GET {"{url}"}/models</div>
            <div className="text-slate-500 mt-2 text-xs">Returns: {`{ "models": [{"id": "model-1", ...}] }`}</div>
          </div>
        </Card>
      </div>
    </div>
  )
}
