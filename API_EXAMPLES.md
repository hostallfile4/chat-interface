# API Examples - Real Requests & Responses

## 1. Admin Configuration Endpoints

### GET /api/admin/config
**Purpose**: Fetch current API configuration and cache status

**Request**:
```bash
curl -X GET http://localhost:3000/api/admin/config
```

**Response (200 OK)**:
```json
{
  "success": true,
  "apiUrl": "https://new.worldbussnessearning.com/v1",
  "cacheExpiry": "2024-07-07T23:39:00.000Z"
}
```

**Response (500 Error)**:
```json
{
  "success": false,
  "error": "Failed to fetch config"
}
```

---

### POST /api/admin/config
**Purpose**: Save new external API configuration with validation

**Request**:
```bash
curl -X POST http://localhost:3000/api/admin/config \
  -H "Content-Type: application/json" \
  -d '{
    "apiUrl": "https://new.worldbussnessearning.com/v1"
  }'
```

**Response (200 Success)**:
```json
{
  "success": true,
  "message": "API configuration saved successfully",
  "apiUrl": "https://new.worldbussnessearning.com/v1"
}
```

**Response (400 Invalid URL)**:
```json
{
  "success": false,
  "error": "Invalid URL format"
}
```

**Response (400 Connection Failed)**:
```json
{
  "success": false,
  "error": "Failed to connect to external API. Status: 404"
}
```

**Response (400 API Unreachable)**:
```json
{
  "success": false,
  "error": "Cannot reach external API: fetch failed"
}
```

---

## 2. Model Management Endpoint

### GET /api/models
**Purpose**: Get available models with caching logic

**Request**:
```bash
curl -X GET http://localhost:3000/api/models
```

**Response (200 - Cached Models)**:
```json
{
  "success": true,
  "models": [
    {
      "id": "gpt-4",
      "object": "model",
      "created": 1687882411,
      "owned_by": "openai"
    },
    {
      "id": "gpt-3.5-turbo",
      "object": "model",
      "created": 1677649963,
      "owned_by": "openai"
    },
    {
      "id": "claude-3-sonnet",
      "object": "model",
      "created": 1700000000,
      "owned_by": "anthropic"
    }
  ],
  "source": "cache",
  "expiresAt": "2024-07-07T23:39:00.000Z"
}
```

**Response (200 - Fresh from API)**:
```json
{
  "success": true,
  "models": [
    {
      "id": "gpt-4",
      "object": "model",
      "created": 1687882411,
      "owned_by": "openai"
    }
  ],
  "source": "external",
  "expiresAt": "2024-07-07T23:39:00.000Z"
}
```

**Response (400 - Not Configured)**:
```json
{
  "success": false,
  "error": "API URL not configured. Please visit /admin to configure.",
  "models": []
}
```

**Response (500 - External API Error)**:
```json
{
  "success": false,
  "error": "Failed to fetch models: External API returned status 500",
  "models": []
}
```

---

## 3. Streaming Chat Endpoint

### POST /api/chat/stream
**Purpose**: Stream chat responses in real-time using Server-Sent Events

**Request**:
```bash
curl -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, how are you?",
    "model": "gpt-4",
    "sessionId": "session_1720292400000"
  }'
```

**Response (200 - SSE Stream)**:
```
{"type":"content","content":"Hello"}
{"type":"content","content":"! "}
{"type":"content","content":"I"}
{"type":"content","content":"'"}
{"type":"content","content":"m"}
{"type":"content","content":" "}
{"type":"content","content":"doing"}
{"type":"content","content":" "}
{"type":"content","content":"great"}
{"type":"content","content":"!"}
{"type":"done"}
```

**Response with Thinking**:
```
{"type":"thinking","thinking":"User is greeting me. I should respond warmly."}
{"type":"content","content":"Hello"}
{"type":"content","content":"! "}
{"type":"content","content":"I"}
{"type":"content","content":"'"}
{"type":"content","content":"m"}
{"type":"content","content":" "}
{"type":"content","content":"doing"}
{"type":"content","content":" "}
{"type":"content","content":"great"}
{"type":"content","content":"!"}
{"type":"done"}
```

**Response (400 - Missing Fields)**:
```json
{
  "error": "Missing required fields: message, model, sessionId"
}
```

**Response (400 - API Not Configured)**:
```json
{
  "error": "API not configured. Visit /admin to setup."
}
```

**Response (500 - Stream Error)**:
```
{"type":"error","content":"Streaming error: Connection timeout"}
```

---

## 4. Text-to-Speech Endpoint

### POST /api/tts/bengali
**Purpose**: Prepare text for TTS and detect language

**Request (English)**:
```bash
curl -X POST http://localhost:3000/api/tts/bengali \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test",
    "language": "en-US"
  }'
```

**Response (English)**:
```json
{
  "success": true,
  "text": "Hello, this is a test",
  "language": "en-US",
  "isBengali": false,
  "method": "web-speech-api",
  "message": "Use Web Speech API on client side for TTS",
  "voices": ["default"]
}
```

**Request (Bengali)**:
```bash
curl -X POST http://localhost:3000/api/tts/bengali \
  -H "Content-Type: application/json" \
  -d '{
    "text": "নমস্কার, এটি একটি পরীক্ষা"
  }'
```

**Response (Bengali - Auto-Detected)**:
```json
{
  "success": true,
  "text": "নমস্কার, এটি একটি পরীক্ষা",
  "language": "bn-BD",
  "isBengali": true,
  "method": "web-speech-api",
  "message": "Use Web Speech API on client side for TTS",
  "voices": ["default"]
}
```

**Response (400 - Missing Text)**:
```json
{
  "error": "Text is required"
}
```

**Response (500 - Error)**:
```json
{
  "error": "TTS processing failed"
}
```

---

### GET /api/tts/bengali
**Purpose**: Query-based TTS endpoint (alternative to POST)

**Request**:
```bash
curl "http://localhost:3000/api/tts/bengali?text=Hello&language=en-US"
```

**Response (200)**:
```json
{
  "success": true,
  "text": "Hello",
  "language": "en-US",
  "method": "web-speech-api"
}
```

---

## 5. Complete Chat Flow Example

### Example: Full conversation flow

**Step 1: Configure API (Admin)**
```bash
POST /api/admin/config
{"apiUrl": "https://new.worldbussnessearning.com/v1"}

Response:
{"success": true, "message": "API configuration saved successfully"}
```

**Step 2: Fetch Models**
```bash
GET /api/models

Response:
{
  "success": true,
  "models": [{"id": "gpt-4", ...}],
  "source": "external",
  "expiresAt": "2024-07-07T23:39:00Z"
}
```

**Step 3: User sends message**
```bash
POST /api/chat/stream
{
  "message": "What is artificial intelligence?",
  "model": "gpt-4",
  "sessionId": "session_1234567890"
}
```

**Step 4: Stream response received**
```
{"type":"content","content":"Artificial"}
{"type":"content","content":" "}
{"type":"content","content":"intelligence"}
...
{"type":"done"}
```

**Step 5: User plays audio**
```bash
POST /api/tts/bengali
{"text": "Artificial intelligence is..."}

Response:
{"success": true, "language": "en-US", "method": "web-speech-api"}
```

**Step 6: Fetch cached models (24h later)**
```bash
GET /api/models

Response:
{
  "success": true,
  "models": [{"id": "gpt-4", ...}],
  "source": "cache",  # ← Changed to cache!
  "expiresAt": "2024-07-08T23:39:00Z"
}
```

---

## Testing with cURL

### Quick Test Script

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"

# Test 1: Get Config
echo "1. Getting config..."
curl -s $BASE_URL/api/admin/config | jq .

# Test 2: Save Config
echo -e "\n2. Saving config..."
curl -s -X POST $BASE_URL/api/admin/config \
  -H "Content-Type: application/json" \
  -d '{"apiUrl":"https://new.worldbussnessearning.com/v1"}' | jq .

# Test 3: Get Models
echo -e "\n3. Getting models..."
curl -s $BASE_URL/api/models | jq .

# Test 4: Stream Chat
echo -e "\n4. Testing streaming chat..."
curl -s -X POST $BASE_URL/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message":"Hello",
    "model":"gpt-4",
    "sessionId":"test_123"
  }' | head -5

# Test 5: TTS
echo -e "\n5. Testing TTS..."
curl -s -X POST $BASE_URL/api/tts/bengali \
  -H "Content-Type: application/json" \
  -d '{"text":"নমস্কার"}' | jq .

echo -e "\nTests complete!"
```

---

## Response Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Models fetched, config saved |
| 400 | Bad Request | Invalid URL, missing fields |
| 500 | Server Error | Database error, API unreachable |

---

## Real-World Test Cases

### Test Case 1: First-time User Flow
```
1. User visits /admin
2. Enters API URL
3. System tests connection
4. Models cached successfully
5. User sees "Connected! Found 5 models"
```

### Test Case 2: Cache Hit (After 24 Hours)
```
1. User visits /admin
2. Clicks "Test & Fetch Models"
3. Response shows source: "cache"
4. Expiry time shows: "24 hours from now"
5. No external API call made (verified in Network tab)
```

### Test Case 3: Cache Expiry
```
1. Wait 24 hours
2. User visits main chat
3. System fetches models
4. Response shows source: "external" (cache expired)
5. New models stored with fresh 24-hour expiry
```

### Test Case 4: Streaming Response
```
1. User sends message
2. Response streams in chunks
3. Each chunk arrives ~100-200ms apart
4. Full response in ~3-5 seconds
5. User sees words appearing in real-time
```

### Test Case 5: Bengali TTS
```
1. User types Bengali text
2. Clicks speaker icon
3. API detects Bengali (Unicode check)
4. Browser uses Bengali voice
5. Text spoken in Bengali language
```

---

## Error Scenarios

### Scenario 1: API Not Configured
```
User clicks "Get Models"
↓
System checks if API URL exists
↓
No URL found in database
↓
Response: {success: false, error: "API not configured"}
↓
Redirect user to /admin
```

### Scenario 2: Invalid URL
```
User enters "not-a-url" in /admin
↓
System validates URL format
↓
URL parse fails
↓
Response: {success: false, error: "Invalid URL format"}
↓
Admin sees error message
```

### Scenario 3: API Connection Failed
```
User enters "https://invalid-api.com/v1"
↓
System attempts fetch to /models endpoint
↓
Connection timeout or 404 response
↓
Response: {success: false, error: "Cannot reach external API"}
↓
Admin sees connection error
```

---

## Performance Analysis

### Cache Hit (Typical)
```
Request → Check database (10ms) → Cache valid → Return (< 50ms total)
```

### Cache Miss (Every 24 hours)
```
Request → Check cache (10ms) → Cache expired → Fetch API (2-5s) → Save DB (50ms) → Return (2-5s total)
```

### Streaming Response
```
Request → Stream starts (100ms) → First token (400ms) → Full response (3-10s)
```

---

See `IMPLEMENTATION_GUIDE.md` for complete documentation.
