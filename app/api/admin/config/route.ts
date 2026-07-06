import { NextRequest, NextResponse } from "next/server"
import { getApiConfig, setApiConfig, initializeDatabase } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase()
    const apiUrl = await getApiConfig()

    return NextResponse.json({
      success: true,
      apiUrl: apiUrl || "",
      cacheExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
  } catch (error) {
    console.error("[v0] Error getting admin config:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch config" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase()
    const { apiUrl } = await request.json()

    if (!apiUrl || typeof apiUrl !== "string") {
      return NextResponse.json({ success: false, error: "Invalid API URL" }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(apiUrl)
    } catch {
      return NextResponse.json({ success: false, error: "Invalid URL format" }, { status: 400 })
    }

    // Test connection to external API
    try {
      const testResponse = await fetch(apiUrl + "/models", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })

      if (!testResponse.ok) {
        return NextResponse.json(
          { success: false, error: "Failed to connect to external API. Status: " + testResponse.status },
          { status: 400 }
        )
      }
    } catch (fetchError) {
      return NextResponse.json(
        { success: false, error: "Cannot reach external API: " + String(fetchError) },
        { status: 400 }
      )
    }

    // Save the configuration
    const saved = await setApiConfig(apiUrl)

    if (!saved) {
      return NextResponse.json({ success: false, error: "Failed to save configuration" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "API configuration saved successfully",
      apiUrl: apiUrl,
    })
  } catch (error) {
    console.error("[v0] Error saving admin config:", error)
    return NextResponse.json({ success: false, error: "Failed to save config" }, { status: 500 })
  }
}
