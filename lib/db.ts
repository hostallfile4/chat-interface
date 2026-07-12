import { neon } from "@neondatabase/serverless"

export const sql = neon(process.env.DATABASE_URL || "")

export async function initializeDatabase() {
  try {
    // Create tables if they don't exist
    await sql`
      CREATE TABLE IF NOT EXISTS api_config (
        id SERIAL PRIMARY KEY,
        api_url TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(id)
      );
    `

    await sql`
      CREATE TABLE IF NOT EXISTS model_cache (
        id SERIAL PRIMARY KEY,
        models JSONB NOT NULL,
        cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE,
        UNIQUE(id)
      );
    `

    await sql`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        model_id TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `

    await sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        thinking_process JSONB,
        image_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);`

    console.log("[v0] Database initialized successfully")
  } catch (error) {
    console.error("[v0] Database initialization error:", error)
  }
}

export async function getApiConfig() {
  try {
    const result = await sql`SELECT api_url FROM api_config ORDER BY id LIMIT 1;`
    return result[0]?.api_url || null
  } catch (error) {
    console.error("[v0] Error fetching API config:", error)
    return null
  }
}

export async function setApiConfig(apiUrl: string) {
  try {
    await sql`DELETE FROM api_config WHERE id > 0;`
    await sql`INSERT INTO api_config (api_url) VALUES (${apiUrl});`
    return true
  } catch (error) {
    console.error("[v0] Error setting API config:", error)
    return false
  }
}

export async function getCachedModels() {
  try {
    const result = await sql`
      SELECT models, expires_at FROM model_cache 
      WHERE id = 1 AND expires_at > NOW()
      LIMIT 1;
    `
    return result[0] || null
  } catch (error) {
    console.error("[v0] Error fetching cached models:", error)
    return null
  }
}

export async function setCachedModels(models: any) {
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now

    await sql`DELETE FROM model_cache WHERE id > 0;`
    await sql`
      INSERT INTO model_cache (models, cached_at, expires_at)
      VALUES (${JSON.stringify(models)}, NOW(), ${expiresAt.toISOString()});
    `
    return true
  } catch (error) {
    console.error("[v0] Error setting cached models:", error)
    return false
  }
}

export async function saveSession(sessionId: string, title: string, modelId: string) {
  try {
    await sql`
      INSERT INTO chat_sessions (id, title, model_id)
      VALUES (${sessionId}, ${title}, ${modelId})
      ON CONFLICT (id) DO UPDATE SET 
        title = ${title},
        model_id = ${modelId},
        updated_at = NOW();
    `
    return true
  } catch (error) {
    console.error("[v0] Error saving session:", error)
    return false
  }
}

export async function saveMessage(
  messageId: string,
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  thinking?: any
) {
  try {
    await sql`
      INSERT INTO chat_messages (id, session_id, role, content, thinking_process)
      VALUES (${messageId}, ${sessionId}, ${role}, ${content}, ${thinking ? JSON.stringify(thinking) : null});
    `
    return true
  } catch (error) {
    console.error("[v0] Error saving message:", error)
    return false
  }
}

export async function getSessionMessages(sessionId: string) {
  try {
    const messages = await sql`
      SELECT id, role, content, thinking_process, created_at
      FROM chat_messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC;
    `
    return messages
  } catch (error) {
    console.error("[v0] Error fetching session messages:", error)
    return []
  }
}
