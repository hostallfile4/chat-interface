import { NextRequest, NextResponse } from "next/server"
import { getApiConfig, getCachedModels, setCachedModels, initializeDatabase } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase()

    // Check if we have valid cached models
    const cached = await getCachedModels()

    if (cached) {
      console.log("[v0] Returning cached models")
      return NextResponse.json({
        success: true,
        models: cached.models,
        source: "cache",
        expiresAt: cached.expires_at,
      })
    }

    // Get the configured API URL
    const apiUrl = await getApiConfig()

    if (!apiUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "API URL not configured. Please visit /admin to configure.",
          models: [],
        },
        { status: 400 }
      )
    }

    console.log("[v0] Fetching models from external API:", apiUrl)

    // Fetch models from external API
    const externalResponse = await fetch(apiUrl + "/models", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })

    if (!externalResponse.ok) {
      throw new Error(`External API returned status ${externalResponse.status}`)
    }

    const externalData = await externalResponse.json()
    const models = externalData.data || externalData.models || externalData || []

    // Cache the models for 24 hours
    await setCachedModels(models)

    console.log("[v0] Models cached successfully. Count:", models.length)

    return NextResponse.json({
      success: true,
      models: models,
      source: "external",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
  } catch (error) {
    console.error("[v0] Error fetching models:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch models: " + String(error),
        models: [],
      },
      { status: 500 }
    )
  }
}
