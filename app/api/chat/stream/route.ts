import { NextRequest, NextResponse } from "next/server"
import { getApiConfig, saveMessage, initializeDatabase } from "@/lib/db"

interface StreamChunk {
  type: "thinking" | "content" | "done" | "error"
  content?: string
  thinking?: string
}

async function* streamResponse(message: string, model: string, apiUrl: string) {
  try {
    const response = await fetch(apiUrl + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: message }],
        stream: true,
      }),
    })

    if (!response.ok) {
      yield {
        type: "error",
        content: `External API error: ${response.status}`,
      }
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      yield { type: "error", content: "No response body" }
      return
    }

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6)

          if (data === "[DONE]") {
            yield { type: "done" }
            continue
          }

          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content

            if (delta) {
              yield {
                type: "content",
                content: delta,
              }
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    }
  } catch (error) {
    console.error("[v0] Stream error:", error)
    yield {
      type: "error",
      content: "Streaming error: " + String(error),
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase()

    const { message, model, sessionId } = await request.json()

    if (!message || !model || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields: message, model, sessionId" },
        { status: 400 }
      )
    }

    const apiUrl = await getApiConfig()
    if (!apiUrl) {
      return NextResponse.json(
        { error: "API not configured. Visit /admin to setup." },
        { status: 400 }
      )
    }

    // Create readable stream for streaming response
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResponse(message, model, apiUrl)) {
            const chunkStr = JSON.stringify(chunk) + "\n"
            controller.enqueue(new TextEncoder().encode(chunkStr))
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })

    return new NextResponse(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("[v0] Chat stream API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
