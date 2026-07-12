import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { text, language = "en-US" } = await request.json()

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

    // Detect Bengali language
    const isBengali = /[\u0980-\u09FF]/.test(text)
    const lang = isBengali ? "bn-BD" : language

    // Return metadata for client-side TTS using Web Speech API
    // The client will handle actual speech synthesis using the browser's capabilities
    return NextResponse.json({
      success: true,
      text: text,
      language: lang,
      isBengali: isBengali,
      method: "web-speech-api",
      message: "Use Web Speech API on client side for TTS",
      voices: ["default"], // Browser will select best available voice
    })
  } catch (error) {
    console.error("[v0] TTS error:", error)
    return NextResponse.json({ error: "TTS processing failed" }, { status: 500 })
  }
}

// Alternative endpoint for external TTS service fallback
export async function GET(request: NextRequest) {
  try {
    const text = request.nextUrl.searchParams.get("text")
    const language = request.nextUrl.searchParams.get("language") || "en-US"

    if (!text) {
      return NextResponse.json({ error: "Text parameter required" }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      text: text,
      language: language,
      method: "web-speech-api",
    })
  } catch (error) {
    console.error("[v0] TTS GET error:", error)
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 })
  }
}
